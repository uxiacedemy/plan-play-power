import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Upload, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Row = {
  name: string;
  brand?: string;
  barcode?: string;
  category?: string;
  cost_price?: string;
  selling_price?: string;
  quantity?: string;
  reorder_level?: string;
  unit?: string;
};

// Minimal CSV parser — handles quoted fields with commas
function parseCSV(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) return [];
  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ",") { out.push(cur); cur = ""; }
        else cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };
  const header = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  return lines.slice(1).map((line) => {
    const cols = parseLine(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h] = cols[i] ?? ""; });
    return row as Row;
  });
}

export function ProductImportDialog({
  open, onOpenChange,
}: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [filename, setFilename] = useState("");

  const handleFile = async (file: File) => {
    const text = await file.text();
    const parsed = parseCSV(text).filter((r) => r.name);
    setRows(parsed);
    setFilename(file.name);
  };

  const importMut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      // Load existing categories
      const { data: catRows } = await supabase.from("categories").select("id,name");
      const catMap = new Map((catRows ?? []).map((c) => [c.name.toLowerCase(), c.id]));
      // Create missing categories
      const needed = Array.from(new Set(rows.map((r) => r.category?.trim()).filter((c): c is string => !!c)))
        .filter((name) => !catMap.has(name.toLowerCase()));
      if (needed.length > 0) {
        const { data: created, error } = await supabase
          .from("categories")
          .insert(needed.map((name) => ({ user_id: u.user!.id, name })))
          .select("id,name");
        if (error) throw error;
        created?.forEach((c) => catMap.set(c.name.toLowerCase(), c.id));
      }

      const payload = rows.map((r) => ({
        user_id: u.user!.id,
        name: r.name.trim(),
        brand: r.brand?.trim() || null,
        barcode: r.barcode?.trim() || null,
        category_id: r.category ? catMap.get(r.category.trim().toLowerCase()) ?? null : null,
        cost_price: Number(r.cost_price) || 0,
        selling_price: Number(r.selling_price) || 0,
        quantity: parseInt(r.quantity ?? "0") || 0,
        reorder_level: parseInt(r.reorder_level ?? "5") || 5,
        unit: r.unit?.trim() || "pcs",
      }));

      const { error } = await supabase.from("products").insert(payload);
      if (error) throw error;
      return payload.length;
    },
    onSuccess: (n) => {
      toast.success(`Imported ${n} products`);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      setRows([]);
      setFilename("");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Import failed"),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setRows([]); setFilename(""); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Import products from CSV</DialogTitle>
          <DialogDescription>
            Columns: <code>name, brand, barcode, category, cost_price, selling_price, quantity, reorder_level, unit</code>.
            Only <code>name</code> is required.
          </DialogDescription>
        </DialogHeader>

        {rows.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-3">
            <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground" />
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" /> Choose CSV file
            </Button>
            <input
              ref={fileRef} type="file" accept=".csv,text/csv" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
            />
          </div>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              <strong>{filename}</strong> — {rows.length} rows ready to import.
            </p>
            <div className="max-h-60 overflow-auto rounded border border-border text-xs">
              <table className="w-full">
                <thead className="bg-muted sticky top-0">
                  <tr><th className="p-2 text-left">Name</th><th className="p-2 text-left">Price</th><th className="p-2 text-left">Qty</th></tr>
                </thead>
                <tbody>
                  {rows.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-border">
                      <td className="p-2">{r.name}</td>
                      <td className="p-2">{r.selling_price ?? "0"}</td>
                      <td className="p-2">{r.quantity ?? "0"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 50 && <p className="p-2 text-center text-muted-foreground">…and {rows.length - 50} more</p>}
            </div>
          </>
        )}

        <DialogFooter>
          {rows.length > 0 && (
            <>
              <Button variant="outline" onClick={() => { setRows([]); setFilename(""); }}>Clear</Button>
              <Button onClick={() => importMut.mutate()} disabled={importMut.isPending}>
                {importMut.isPending ? "Importing…" : `Import ${rows.length} products`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
