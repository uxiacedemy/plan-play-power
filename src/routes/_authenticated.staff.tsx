import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, Trash2, UserCog, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { createStaff, listStaff, removeStaff } from "@/lib/staff.functions";
import { useRole } from "@/hooks/useRole";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff — MboaPOS" }] }),
  component: StaffPage,
});

function StaffPage() {
  const navigate = useNavigate();
  const { isOwner, loading } = useRole();
  const qc = useQueryClient();
  const fetchList = useServerFn(listStaff);
  const create = useServerFn(createStaff);
  const remove = useServerFn(removeStaff);

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"manager" | "cashier">("cashier");

  useEffect(() => {
    if (!loading && !isOwner) navigate({ to: "/pos" });
  }, [loading, isOwner, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["staff"],
    queryFn: () => fetchList(),
    enabled: isOwner,
  });

  const addMutation = useMutation({
    mutationFn: () => create({ data: { email, password, role } }),
    onSuccess: () => {
      toast.success("Staff added");
      setOpen(false);
      setEmail(""); setPassword(""); setRole("cashier");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add staff"),
  });

  const delMutation = useMutation({
    mutationFn: (member_id: string) => remove({ data: { member_id } }),
    onSuccess: () => {
      toast.success("Staff removed");
      qc.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove"),
  });

  if (!isOwner) return null;

  const members = data?.members ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Staff</h1>
          <p className="text-sm text-muted-foreground">{members.length} member{members.length === 1 ? "" : "s"}</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add staff</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add staff member</DialogTitle></DialogHeader>
            <form
              onSubmit={(e) => { e.preventDefault(); addMutation.mutate(); }}
              className="space-y-3"
            >
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Temporary password</Label>
                <Input type="text" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
                <p className="text-xs text-muted-foreground">Share it with them; they can change it later.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Select value={role} onValueChange={(v) => setRole(v as "manager" | "cashier")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cashier">Cashier — POS only</SelectItem>
                    <SelectItem value="manager">Manager — POS, products, reports</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={addMutation.isPending} className="w-full">
                  {addMutation.isPending ? "Adding…" : "Add staff"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : members.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No staff yet. Add a cashier or manager to share your shop.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {members.map((m: any) => (
            <div key={m.id} className="flex items-center gap-3 p-3 border-b border-border last:border-0">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-muted">
                {m.role === "manager" ? <ShieldCheck className="h-4 w-4" /> : <UserCog className="h-4 w-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{m.email ?? m.member_id}</div>
                <div className="text-xs text-muted-foreground capitalize">{m.role}</div>
              </div>
              <Button
                variant="ghost" size="icon" className="text-destructive"
                onClick={() => { if (confirm(`Remove ${m.email ?? "this user"}?`)) delMutation.mutate(m.member_id); }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
