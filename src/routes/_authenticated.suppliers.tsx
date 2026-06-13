import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [{ title: "Suppliers — MboaPOS" }] }),
  component: SuppliersPage,
});

type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
};

type Form = { id?: string; name: string; phone: string; email: string; address: string; notes: string };
const empty: Form = { name: "", phone: "", email: "", address: "", notes: "" };

function SuppliersPage() {
  const qc = useQueryClient();
  const { canManageInventory } = useRole();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);

  const { data: suppliers = [], isLoading } = useQuery({
    queryKey: ["suppliers-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data as Supplier[];
    },
  });

  const save = useMutation({
    mutationFn: async (f: Form) => {
      if (!f.name.trim()) throw new Error("Name required");
      const payload = {
        name: f.name.trim(),
        phone: f.phone.trim() || null,
        email: f.email.trim() || null,
        address: f.address.trim() || null,
        notes: f.notes.trim() || null,
      };
      if (f.id) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("Not signed in");
        const { error } = await supabase.from("suppliers").insert({ ...payload, user_id: u.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["suppliers-full"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("suppliers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["suppliers-full"] });
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const openEdit = (s: Supplier) => {
    setForm({
      id: s.id, name: s.name, phone: s.phone ?? "", email: s.email ?? "",
      address: s.address ?? "", notes: s.notes ?? "",
    });
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suppliers</h1>
          <p className="text-sm text-muted-foreground">{suppliers.length} suppliers</p>
        </div>
        {canManageInventory && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add supplier</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} supplier</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(form); }} className="space-y-3">
                <Fld label="Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Fld label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                  <Fld label="Email" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                </div>
                <Fld label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
                <div className="space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={save.isPending} className="w-full">
                    {save.isPending ? "Saving…" : "Save"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : suppliers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No suppliers yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {suppliers.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-4 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{s.name}</h3>
                {canManageInventory && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(s)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => { if (confirm(`Delete ${s.name}?`)) remove.mutate(s.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
              {s.phone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" /> <a href={`tel:${s.phone}`} className="hover:underline">{s.phone}</a>
                </p>
              )}
              {s.email && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> <a href={`mailto:${s.email}`} className="hover:underline">{s.email}</a>
                </p>
              )}
              {s.address && <p className="text-xs text-muted-foreground">{s.address}</p>}
              {s.notes && <p className="text-xs mt-2">{s.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Fld({
  label, value, onChange, type = "text", required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
