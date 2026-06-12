import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, AlertTriangle, ScanLine, PackagePlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { StockAdjustDialog } from "@/components/StockAdjustDialog";
import { formatXAF } from "@/lib/format";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [{ title: "Products — MboaPOS" }] }),
  component: ProductsPage,
});

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  category: string | null;
  cost_price: number;
  selling_price: number;
  quantity: number;
  reorder_level: number;
  unit: string;
};

type FormState = {
  id?: string;
  name: string;
  barcode: string;
  category: string;
  cost_price: string;
  selling_price: string;
  quantity: string;
  reorder_level: string;
  unit: string;
};

const empty: FormState = {
  name: "", barcode: "", category: "", cost_price: "0",
  selling_price: "0", quantity: "0", reorder_level: "5", unit: "pcs",
};

function ProductsPage() {
  const qc = useQueryClient();
  const { canManageInventory } = useRole();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("__all");
  const [scanOpen, setScanOpen] = useState(false);
  const [adjust, setAdjust] = useState<Product | null>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => { if (p.category) set.add(p.category); });
    return Array.from(set).sort();
  }, [products]);

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const sp = Number(f.selling_price);
      const cp = Number(f.cost_price);
      const qty = parseInt(f.quantity);
      if (!f.name.trim()) throw new Error("Name required");
      if (sp < 0 || cp < 0) throw new Error("Prices must be ≥ 0");
      if (qty < 0) throw new Error("Quantity must be ≥ 0");

      const payload = {
        name: f.name.trim(),
        barcode: f.barcode.trim() || null,
        category: f.category.trim() || null,
        cost_price: cp || 0,
        selling_price: sp || 0,
        quantity: qty || 0,
        reorder_level: parseInt(f.reorder_level) || 0,
        unit: f.unit.trim() || "pcs",
      };
      if (f.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) throw new Error("Not signed in");
        const { error } = await supabase.from("products").insert({ ...payload, user_id: u.user.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Product updated" : "Product added");
      qc.invalidateQueries({ queryKey: ["products"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : "Failed to save";
      toast.error(/duplicate|unique/i.test(msg) ? "Barcode already in use" : msg);
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product deleted");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const openEdit = (p: Product) => {
    setForm({
      id: p.id, name: p.name, barcode: p.barcode ?? "", category: p.category ?? "",
      cost_price: String(p.cost_price), selling_price: String(p.selling_price),
      quantity: String(p.quantity), reorder_level: String(p.reorder_level), unit: p.unit,
    });
    setOpen(true);
  };

  const filtered = products.filter((p) => {
    if (category !== "__all" && p.category !== category) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return p.name.toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q);
  });

  const lowCount = products.filter((p) => p.quantity <= p.reorder_level).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground">
            {products.length} items{lowCount > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-warning-foreground">
                <AlertTriangle className="h-3 w-3" /> {lowCount} low
              </span>
            )}
          </p>
        </div>
        {canManageInventory && (
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Add product</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} product</DialogTitle></DialogHeader>
              <form
                onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
                className="space-y-3"
              >
                <Field label="Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                  <Field label="Barcode" value={form.barcode} onChange={(v) => setForm({ ...form, barcode: v })} />
                  <Button type="button" variant="outline" size="icon" onClick={() => setScanOpen(true)}>
                    <ScanLine className="h-4 w-4" />
                  </Button>
                </div>
                <Field label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Cost (FCFA)" type="number" value={form.cost_price} onChange={(v) => setForm({ ...form, cost_price: v })} />
                  <Field label="Price (FCFA)" type="number" required value={form.selling_price} onChange={(v) => setForm({ ...form, selling_price: v })} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Quantity" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
                  <Field label="Reorder at" type="number" value={form.reorder_level} onChange={(v) => setForm({ ...form, reorder_level: v })} />
                  <Field label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
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

      <div className="flex gap-2">
        <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <CatChip active={category === "__all"} onClick={() => setCategory("__all")}>All</CatChip>
          {categories.map((c) => (
            <CatChip key={c} active={category === c} onClick={() => setCategory(c)}>{c}</CatChip>
          ))}
        </div>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          {products.length === 0 ? "No products yet. Add your first one." : "No products match the filter."}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center gap-2 p-3 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2">
                  <span className="truncate">{p.name}</span>
                  {p.quantity <= p.reorder_level && (
                    <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-warning/30 text-warning-foreground shrink-0">
                      <AlertTriangle className="h-3 w-3" /> Low
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {formatXAF(p.selling_price)} · {p.quantity} {p.unit}
                  {p.category && ` · ${p.category}`}
                </div>
              </div>
              {canManageInventory && (
                <>
                  <Button variant="ghost" size="icon" title="Adjust stock" onClick={() => setAdjust(p)}>
                    <PackagePlus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon" className="text-destructive"
                    onClick={() => { if (confirm(`Delete ${p.name}?`)) remove.mutate(p.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      <BarcodeScanner
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDetected={(code) => setForm((f) => ({ ...f, barcode: code }))}
      />

      {adjust && (
        <StockAdjustDialog
          open
          onOpenChange={(v) => { if (!v) setAdjust(null); }}
          productId={adjust.id}
          productName={adjust.name}
          currentQty={adjust.quantity}
        />
      )}
    </div>
  );
}

function CatChip({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
        active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
      }`}
    >
      {children}
    </button>
  );
}

function Field({
  label, value, onChange, type = "text", required,
}: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
