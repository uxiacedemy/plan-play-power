import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Phone, Mail, MessageCircle, Star, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatXAF } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [{ title: "Customers — MboaPOS" }] }),
  component: CustomersPage,
});

type Customer = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  loyalty_points: number;
};

type CreditRow = {
  customer_id: string;
  entry_type: "charge" | "payment";
  amount: number;
};

type Form = { id?: string; name: string; phone: string; email: string; address: string; notes: string };
const empty: Form = { name: "", phone: "", email: "", address: "", notes: "" };

function CustomersPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(empty);
  const [search, setSearch] = useState("");
  const [active, setActive] = useState<Customer | null>(null);

  const { data: customers = [], isLoading } = useQuery({
    queryKey: ["customers-full"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id,name,phone,email,address,notes,loyalty_points")
        .order("name");
      if (error) throw error;
      return data as Customer[];
    },
  });

  const { data: balances = {} } = useQuery({
    queryKey: ["customer-balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_credits")
        .select("customer_id,entry_type,amount");
      if (error) throw error;
      const map: Record<string, number> = {};
      (data as CreditRow[]).forEach((r) => {
        const sign = r.entry_type === "charge" ? 1 : -1;
        map[r.customer_id] = (map[r.customer_id] ?? 0) + sign * Number(r.amount);
      });
      return map;
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
        const { error } = await supabase.from("customers").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("Not signed in");
        const { error } = await supabase.from("customers").insert({ ...payload, user_id: u.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["customers-full"] });
      qc.invalidateQueries({ queryKey: ["customers-min"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["customers-full"] });
      qc.invalidateQueries({ queryKey: ["customers-min"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const openEdit = (c: Customer) => {
    setForm({
      id: c.id, name: c.name,
      phone: c.phone ?? "", email: c.email ?? "",
      address: c.address ?? "", notes: c.notes ?? "",
    });
    setOpen(true);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q),
    );
  }, [customers, search]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">Customers</h1>
          <p className="text-sm text-muted-foreground">{customers.length} customers</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" /> Add</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} customer</DialogTitle></DialogHeader>
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
      </div>

      <Input
        placeholder="Search by name, phone, email…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          No customers yet.
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {filtered.map((c) => {
            const bal = balances[c.id] ?? 0;
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold truncate">{c.name}</h3>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span className="flex items-center gap-1"><Star className="h-3 w-3" /> {c.loyalty_points} pts</span>
                      <span className={`flex items-center gap-1 ${bal > 0 ? "text-destructive font-medium" : ""}`}>
                        <Wallet className="h-3 w-3" /> {bal > 0 ? `Owes ${formatXAF(bal)}` : "No debt"}
                      </span>
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                      onClick={() => { if (confirm(`Delete ${c.name}?`)) remove.mutate(c.id); }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {c.phone && (
                    <a href={`tel:${c.phone}`} className="flex items-center gap-1 hover:text-foreground">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </a>
                  )}
                  {c.email && (
                    <a href={`mailto:${c.email}`} className="flex items-center gap-1 hover:text-foreground">
                      <Mail className="h-3 w-3" /> {c.email}
                    </a>
                  )}
                  {c.phone && (
                    <a
                      href={whatsappLink(c.phone, c.name, bal)}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 hover:text-foreground"
                    >
                      <MessageCircle className="h-3 w-3" /> WhatsApp
                    </a>
                  )}
                </div>
                <Button size="sm" variant="outline" className="w-full" onClick={() => setActive(c)}>
                  View history & record payment
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <CustomerDetailDialog customer={active} balance={active ? balances[active.id] ?? 0 : 0} onClose={() => setActive(null)} />
    </div>
  );
}

function whatsappLink(phone: string, name: string, balance: number) {
  const clean = phone.replace(/[^\d]/g, "");
  const msg = balance > 0
    ? `Hello ${name}, friendly reminder your outstanding balance is ${formatXAF(balance)}. Thank you!`
    : `Hello ${name}, thank you for your business!`;
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`;
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

type Entry = {
  id: string;
  entry_type: "charge" | "payment";
  amount: number;
  payment_method: string | null;
  note: string | null;
  created_at: string;
  sale_id: string | null;
};

function CustomerDetailDialog({
  customer, balance, onClose,
}: { customer: Customer | null; balance: number; onClose: () => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [note, setNote] = useState("");

  const { data: entries = [] } = useQuery({
    queryKey: ["customer-credits", customer?.id],
    enabled: !!customer,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_credits")
        .select("id,entry_type,amount,payment_method,note,created_at,sale_id")
        .eq("customer_id", customer!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Entry[];
    },
  });

  const pay = useMutation({
    mutationFn: async () => {
      const amt = Number(amount);
      if (!amt || amt <= 0) throw new Error("Enter a positive amount");
      const { error } = await supabase.rpc("record_customer_payment", {
        _customer_id: customer!.id,
        _amount: amt,
        _payment_method: method,
        _note: note || undefined,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setAmount(""); setNote("");
      qc.invalidateQueries({ queryKey: ["customer-credits", customer?.id] });
      qc.invalidateQueries({ queryKey: ["customer-balances"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={!!customer} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {customer && (
          <>
            <DialogHeader>
              <DialogTitle>{customer.name}</DialogTitle>
            </DialogHeader>

            <div className="rounded-lg bg-muted/40 p-3 grid grid-cols-2 gap-2 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Balance</div>
                <div className={`font-bold ${balance > 0 ? "text-destructive" : ""}`}>
                  {balance > 0 ? formatXAF(balance) : "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Loyalty</div>
                <div className="font-bold">{customer.loyalty_points} pts</div>
              </div>
            </div>

            {balance > 0 && (
              <form
                onSubmit={(e) => { e.preventDefault(); pay.mutate(); }}
                className="rounded-lg border border-border p-3 space-y-2"
              >
                <h4 className="font-semibold text-sm">Record payment</h4>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number" min={0} placeholder="Amount XAF"
                    value={amount} onChange={(e) => setAmount(e.target.value)}
                  />
                  <Select value={method} onValueChange={setMethod}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="mtn_momo">MTN Mobile Money</SelectItem>
                      <SelectItem value="orange_money">Orange Money</SelectItem>
                      <SelectItem value="bank">Bank transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input placeholder="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
                <Button type="submit" disabled={pay.isPending} className="w-full">
                  {pay.isPending ? "Recording…" : "Record payment"}
                </Button>
              </form>
            )}

            <div>
              <h4 className="font-semibold text-sm mb-2">History</h4>
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries yet.</p>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {entries.map((e) => (
                    <div key={e.id} className="flex items-center justify-between text-sm border-b border-border py-1">
                      <div>
                        <div className="font-medium capitalize">
                          {e.entry_type === "charge" ? "Credit sale" : "Payment"}
                          {e.payment_method ? ` · ${e.payment_method}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleString()}
                          {e.note ? ` · ${e.note}` : ""}
                        </div>
                      </div>
                      <div className={`font-semibold ${e.entry_type === "charge" ? "text-destructive" : "text-primary"}`}>
                        {e.entry_type === "charge" ? "+" : "−"}{formatXAF(Number(e.amount))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
