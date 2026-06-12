import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const emailSchema = z.string().email().max(255);
const passwordSchema = z.string().min(6).max(128);
const roleSchema = z.enum(["manager", "cashier"]);

async function assertOwner(supabase: any) {
  const { data, error } = await supabase.rpc("current_user_role");
  if (error) throw new Error(error.message);
  if (data !== "owner") throw new Error("Only the shop owner can manage staff");
}

export const listStaff = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: members, error } = await supabase
      .from("shop_members")
      .select("id, member_id, role, created_at")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    if (!members || members.length === 0) return { members: [] as any[] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const enriched = await Promise.all(
      members.map(async (m: any) => {
        const { data } = await supabaseAdmin.auth.admin.getUserById(m.member_id);
        return { ...m, email: data?.user?.email ?? null };
      }),
    );
    return { members: enriched };
  });

export const createStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string; password: string; role: "manager" | "cashier" }) =>
    z.object({ email: emailSchema, password: passwordSchema, role: roleSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { invited: "true", shop_name: "Staff" },
    });
    if (createErr || !created.user) throw new Error(createErr?.message ?? "Could not create user");

    const { error: insErr } = await supabaseAdmin.from("shop_members").insert({
      owner_id: userId,
      member_id: created.user.id,
      role: data.role,
    });
    if (insErr) {
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      throw new Error(insErr.message);
    }

    return { ok: true, member_id: created.user.id };
  });

export const removeStaff = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { member_id: string }) =>
    z.object({ member_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertOwner(supabase);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error: findErr } = await supabaseAdmin
      .from("shop_members")
      .select("id, owner_id, member_id")
      .eq("member_id", data.member_id)
      .maybeSingle();
    if (findErr) throw new Error(findErr.message);
    if (!row || row.owner_id !== userId) throw new Error("Staff member not found");

    await supabaseAdmin.from("shop_members").delete().eq("id", row.id);
    await supabaseAdmin.auth.admin.deleteUser(data.member_id);
    return { ok: true };
  });

export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("current_user_role");
    if (error) throw new Error(error.message);
    return { role: (data as "owner" | "manager" | "cashier") ?? "owner" };
  });
