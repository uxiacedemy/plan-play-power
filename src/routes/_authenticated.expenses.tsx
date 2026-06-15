import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { formatXAF } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({ meta: [{ title: "Expenses — MboaPOS" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const { user } = useAuth();
  const { canManageInventory } = useRole();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", category: "general", expense_date: new Date().toISOString().slice(0, 10), note: "" });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false }).limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("expenses").insert({
        user_id: user.id,
        amount: Number(form.amount),
        category: form.category || "general",
        expense_date: form.expense_date,
        note: form.note || null,
        recorded_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense added");
      setOpen(false);
      setForm({ amount: "", category: "general", expense_date: new Date().toISOString().slice(0, 10), note: "" });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground">Total: {formatXAF(total)}</p>
        </div>
        {canManageInventory && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New expense</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Amount</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
                <div><Label>Category</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="rent, electricity, supplies…" /></div>
                <div><Label>Date</Label><Input type="date" value={form.expense_date} onChange={(e) => setForm({ ...form, expense_date: e.target.value })} /></div>
                <div><Label>Note</Label><Input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
                <Button className="w-full" onClick={() => addMut.mutate()} disabled={!form.amount}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card">
        {expenses.length === 0 ? (
          <p className="p-10 text-center text-muted-foreground">No expenses yet.</p>
        ) : expenses.map((e) => (
          <div key={e.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
            <div>
              <div className="font-medium">{formatXAF(e.amount)} <span className="text-xs text-muted-foreground capitalize">· {e.category}</span></div>
              <div className="text-xs text-muted-foreground">{e.expense_date}{e.note ? ` · ${e.note}` : ""}</div>
            </div>
            {canManageInventory && (
              <Button size="icon" variant="ghost" onClick={() => delMut.mutate(e.id)}><Trash2 className="h-4 w-4" /></Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
