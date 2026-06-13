import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Pencil, Trash2, AlertTriangle, ScanLine, PackagePlus, Upload, Image as ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { StockAdjustDialog } from "@/components/StockAdjustDialog";
import { ProductImportDialog } from "@/components/ProductImportDialog";
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
  brand: string | null;
  barcode: string | null;
  category_id: string | null;
  supplier_id: string | null;
  cost_price: number;
  selling_price: number;
  quantity: number;
  reorder_level: number;
  unit: string;
  tax_rate: number;
  expiry_date: string | null;
  image_url: string | null;
};

type FormState = {
  id?: string;
  name: string;
  brand: string;
  barcode: string;
  category_id: string;
  supplier_id: string;
  cost_price: string;
  selling_price: string;
  quantity: string;
  reorder_level: string;
  unit: string;
  tax_rate: string;
  expiry_date: string;
  image_url: string;
};

const empty: FormState = {
  name: "", brand: "", barcode: "", category_id: "", supplier_id: "",
  cost_price: "0", selling_price: "0", quantity: "0", reorder_level: "5",
  unit: "pcs", tax_rate: "0", expiry_date: "", image_url: "",
};

function ProductsPage() {
  const qc = useQueryClient();
  const { canManageInventory } = useRole();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("__all");
  const [scanOpen, setScanOpen] = useState(false);
  const [adjust, setAdjust] = useState<Product | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,brand,barcode,category_id,supplier_id,cost_price,selling_price,quantity,reorder_level,unit,tax_rate,expiry_date,image_url")
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id,name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("id,name").order("name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });

  const catName = (id: string | null) =>
    id ? (categories.find((c) => c.id === id)?.name ?? "") : "";

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
        brand: f.brand.trim() || null,
        barcode: f.barcode.trim() || null,
        category_id: f.category_id || null,
        supplier_id: f.supplier_id || null,
        cost_price: cp || 0,
        selling_price: sp || 0,
        quantity: qty || 0,
        reorder_level: parseInt(f.reorder_level) || 0,
        unit: f.unit.trim() || "pcs",
        tax_rate: Number(f.tax_rate) || 0,
        expiry_date: f.expiry_date || null,
        image_url: f.image_url || null,
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
      id: p.id,
      name: p.name,
      brand: p.brand ?? "",
      barcode: p.barcode ?? "",
      category_id: p.category_id ?? "",
      supplier_id: p.supplier_id ?? "",
      cost_price: String(p.cost_price),
      selling_price: String(p.selling_price),
      quantity: String(p.quantity),
      reorder_level: String(p.reorder_level),
      unit: p.unit,
      tax_rate: String(p.tax_rate),
      expiry_date: p.expiry_date ?? "",
      image_url: p.image_url ?? "",
    });
    setOpen(true);
  };

  const uploadImage = async (file: File) => {
    try {
      setUploading(true);
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() ?? "jpg";
      const key = `${u.user.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("product-images").upload(key, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("product-images").createSignedUrl
        ? await supabase.storage.from("product-images").createSignedUrl(key, 60 * 60 * 24 * 365 * 5)
        : { data: null };
      const url = data?.signedUrl ?? supabase.storage.from("product-images").getPublicUrl(key).data.publicUrl;
      setForm((f) => ({ ...f, image_url: url }));
      toast.success("Image uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        if (categoryFilter !== "__all" && p.category_id !== categoryFilter) return false;
        const q = search.toLowerCase();
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.barcode ?? "").toLowerCase().includes(q) ||
          (p.brand ?? "").toLowerCase().includes(q)
        );
      }),
    [products, search, categoryFilter],
  );

  const lowCount = products.filter((p) => p.quantity <= p.reorder_level).length;
  const expSoon = products.filter((p) => {
    if (!p.expiry_date) return false;
    const days = (new Date(p.expiry_date).getTime() - Date.now()) / 86400000;
    return days <= 30 && days >= 0;
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Products</h1>
          <p className="text-sm text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
            <span>{products.length} items</span>
            {lowCount > 0 && (
              <span className="inline-flex items-center gap-1 text-warning-foreground">
                <AlertTriangle className="h-3 w-3" /> {lowCount} low
              </span>
            )}
            {expSoon > 0 && (
              <span className="text-destructive">{expSoon} expiring ≤30d</span>
            )}
          </p>
        </div>
        {canManageInventory && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4 mr-1" /> Import CSV
            </Button>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(empty); }}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-1" /> Add product</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>{form.id ? "Edit" : "New"} product</DialogTitle></DialogHeader>
                <form
                  onSubmit={(e) => { e.preventDefault(); save.mutate(form); }}
                  className="space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="h-20 w-20 rounded-lg bg-muted grid place-items-center overflow-hidden shrink-0">
                      {form.image_url
                        ? <img src={form.image_url} alt="" className="h-full w-full object-cover" />
                        : <ImageIcon className="h-6 w-6 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 space-y-2">
                      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                        {uploading ? "Uploading…" : form.image_url ? "Replace image" : "Upload image"}
                      </Button>
                      {form.image_url && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => setForm({ ...form, image_url: "" })}>
                          Remove
                        </Button>
                      )}
                      <input
                        ref={fileRef} type="file" accept="image/*" className="hidden"
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Name" required value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
                    <Field label="Brand" value={form.brand} onChange={(v) => setForm({ ...form, brand: v })} />
                  </div>

                  <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
                    <Field label="Barcode" value={form.barcode} onChange={(v) => setForm({ ...form, barcode: v })} />
                    <Button type="button" variant="outline" size="icon" onClick={() => setScanOpen(true)}>
                      <ScanLine className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Category</Label>
                      <Select value={form.category_id || "__none"} onValueChange={(v) => setForm({ ...form, category_id: v === "__none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">None</SelectItem>
                          {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Supplier</Label>
                      <Select value={form.supplier_id || "__none"} onValueChange={(v) => setForm({ ...form, supplier_id: v === "__none" ? "" : v })}>
                        <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">None</SelectItem>
                          {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Cost (FCFA)" type="number" value={form.cost_price} onChange={(v) => setForm({ ...form, cost_price: v })} />
                    <Field label="Price (FCFA)" type="number" required value={form.selling_price} onChange={(v) => setForm({ ...form, selling_price: v })} />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Quantity" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
                    <Field label="Reorder at" type="number" value={form.reorder_level} onChange={(v) => setForm({ ...form, reorder_level: v })} />
                    <Field label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tax %" type="number" value={form.tax_rate} onChange={(v) => setForm({ ...form, tax_rate: v })} />
                    <Field label="Expiry date" type="date" value={form.expiry_date} onChange={(v) => setForm({ ...form, expiry_date: v })} />
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
        )}
      </div>

      <div className="flex gap-2">
        <Input placeholder="Search by name, barcode, brand…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {categories.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          <CatChip active={categoryFilter === "__all"} onClick={() => setCategoryFilter("__all")}>All</CatChip>
          {categories.map((c) => (
            <CatChip key={c.id} active={categoryFilter === c.id} onClick={() => setCategoryFilter(c.id)}>{c.name}</CatChip>
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
          {filtered.map((p) => {
            const expDays = p.expiry_date
              ? Math.ceil((new Date(p.expiry_date).getTime() - Date.now()) / 86400000)
              : null;
            return (
              <div key={p.id} className="flex items-center gap-3 p-3 border-b border-border last:border-0">
                <div className="h-12 w-12 rounded-md bg-muted overflow-hidden shrink-0 grid place-items-center">
                  {p.image_url
                    ? <img src={p.image_url} alt="" className="h-full w-full object-cover" />
                    : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    <span className="truncate">{p.name}</span>
                    {p.brand && <span className="text-xs text-muted-foreground">{p.brand}</span>}
                    {p.quantity <= p.reorder_level && (
                      <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-warning/30 text-warning-foreground shrink-0">
                        <AlertTriangle className="h-3 w-3" /> Low
                      </span>
                    )}
                    {expDays !== null && expDays >= 0 && expDays <= 30 && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-destructive/15 text-destructive shrink-0">
                        Exp {expDays}d
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {formatXAF(p.selling_price)} · {p.quantity} {p.unit}
                    {p.category_id && ` · ${catName(p.category_id)}`}
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
            );
          })}
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

      <ProductImportDialog open={importOpen} onOpenChange={setImportOpen} />
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
