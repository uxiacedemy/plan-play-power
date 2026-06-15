import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Receipt, Package, DollarSign, Download, FileText, AlertTriangle, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatXAF } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import jsPDF from "jspdf";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — MboaPOS" }] }),
  component: ReportsPage,
});

type Range = "today" | "week" | "month" | "custom";

function getRange(kind: Range, from?: string, to?: string) {
  const now = new Date();
  const start = new Date();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  if (kind === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (kind === "week") {
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
  } else if (kind === "month") {
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);
  } else if (kind === "custom" && from && to) {
    return { start: new Date(from + "T00:00:00"), end: new Date(to + "T23:59:59") };
  }
  return { start, end };
}

function ReportsPage() {
  const [tab, setTab] = useState<Range>("today");
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { start, end } = useMemo(() => getRange(tab, from, to), [tab, from, to]);

  const { data: sales = [] } = useQuery({
    queryKey: ["sales-range", start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id,total,subtotal,discount,tax_total,payment_method,created_at,cashier_id")
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const saleIds = sales.map((s) => s.id);
  const { data: items = [] } = useQuery({
    queryKey: ["sale-items-range", saleIds.join(",")],
    enabled: saleIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("sale_id,product_id,name_snapshot,quantity,unit_price,line_total,discount")
        .in("sale_id", saleIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products-valuation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,quantity,cost_price,selling_price,expiry_date,reorder_level");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses-range", start.toISOString(), end.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("id,amount,category,expense_date,note")
        .gte("expense_date", start.toISOString().slice(0, 10))
        .lte("expense_date", end.toISOString().slice(0, 10));
      if (error) throw error;
      return data ?? [];
    },
  });

  const revenue = sales.reduce((s, x) => s + Number(x.total), 0);
  const totalExpenses = expenses.reduce((s, x) => s + Number(x.amount), 0);
  const cogs = items.reduce((sum, it) => {
    const p = products.find((p) => p.id === it.product_id);
    return sum + (p ? Number(p.cost_price) * Number(it.quantity) : 0);
  }, 0);
  const profit = revenue - cogs - totalExpenses;

  const byMethod = sales.reduce<Record<string, number>>((acc, s) => {
    acc[s.payment_method] = (acc[s.payment_method] || 0) + Number(s.total);
    return acc;
  }, {});

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const it of items) {
      const cur = map.get(it.name_snapshot) || { name: it.name_snapshot, qty: 0, revenue: 0 };
      cur.qty += Number(it.quantity);
      cur.revenue += Number(it.line_total);
      map.set(it.name_snapshot, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  }, [items]);

  const byCashier = useMemo(() => {
    const map = new Map<string, { sales: number; revenue: number }>();
    for (const s of sales) {
      const k = s.cashier_id ?? "unknown";
      const cur = map.get(k) || { sales: 0, revenue: 0 };
      cur.sales += 1;
      cur.revenue += Number(s.total);
      map.set(k, cur);
    }
    return Array.from(map.entries());
  }, [sales]);

  const inventoryValue = products.reduce((s, p) => s + Number(p.cost_price) * Number(p.quantity), 0);
  const expiringSoon = products.filter((p) => {
    if (!p.expiry_date) return false;
    const d = new Date(p.expiry_date);
    const diff = (d.getTime() - Date.now()) / 86400000;
    return diff >= 0 && diff <= 30;
  });

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("MboaPOS Report", 14, 18);
    doc.setFontSize(10);
    doc.text(`Period: ${start.toLocaleDateString()} → ${end.toLocaleDateString()}`, 14, 26);
    let y = 38;
    doc.setFontSize(12);
    doc.text(`Revenue: ${formatXAF(revenue)}`, 14, y); y += 7;
    doc.text(`Transactions: ${sales.length}`, 14, y); y += 7;
    doc.text(`COGS: ${formatXAF(cogs)}`, 14, y); y += 7;
    doc.text(`Expenses: ${formatXAF(totalExpenses)}`, 14, y); y += 7;
    doc.text(`Profit: ${formatXAF(profit)}`, 14, y); y += 10;
    doc.text("Top Products", 14, y); y += 6;
    topProducts.forEach((p) => { doc.text(`- ${p.name} · ${p.qty} · ${formatXAF(p.revenue)}`, 16, y); y += 6; });
    doc.save(`report-${start.toISOString().slice(0,10)}.pdf`);
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sales), "Sales");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(items), "Items");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(expenses), "Expenses");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(topProducts), "TopProducts");
    XLSX.writeFile(wb, `report-${start.toISOString().slice(0,10)}.xlsx`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">
            {start.toLocaleDateString()} – {end.toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={exportPDF}><FileText className="h-4 w-4 mr-1" />PDF</Button>
          <Button size="sm" variant="outline" onClick={exportExcel}><Download className="h-4 w-4 mr-1" />Excel</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Range)}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="week">7 days</TabsTrigger>
          <TabsTrigger value="month">30 days</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
        <TabsContent value="custom">
          <div className="grid grid-cols-2 gap-2 p-2 border border-border rounded-lg bg-card">
            <div><Label className="text-xs">From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label className="text-xs">To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat icon={TrendingUp} label="Revenue" value={formatXAF(revenue)} accent />
        <Stat icon={Receipt} label="Sales" value={String(sales.length)} />
        <Stat icon={DollarSign} label="Profit" value={formatXAF(profit)} />
        <Stat icon={Package} label="Stock value" value={formatXAF(inventoryValue)} />
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <Card title="Top products">
          {topProducts.length === 0 ? <Empty /> : topProducts.map((p) => (
            <Row key={p.name} left={p.name} sub={`${p.qty} sold`} right={formatXAF(p.revenue)} />
          ))}
        </Card>
        <Card title="Payment methods">
          {Object.keys(byMethod).length === 0 ? <Empty /> : Object.entries(byMethod).map(([m, v]) => (
            <Row key={m} left={<span className="capitalize">{m.replace("_", " ")}</span>} right={formatXAF(v)} />
          ))}
        </Card>
        <Card title="Employee performance">
          {byCashier.length === 0 ? <Empty /> : byCashier.map(([id, x]) => (
            <Row key={id} left={<span className="font-mono text-xs">{id.slice(0, 8)}</span>} sub={`${x.sales} sales`} right={formatXAF(x.revenue)} />
          ))}
        </Card>
        <Card title="Expiring soon (30d)">
          {expiringSoon.length === 0 ? <Empty /> : expiringSoon.map((p) => (
            <Row key={p.id} left={p.name} sub={p.expiry_date ?? ""} right={<AlertTriangle className="h-4 w-4 text-yellow-500" />} />
          ))}
        </Card>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="font-semibold mb-2 flex items-center gap-2"><Calendar className="h-4 w-4" /> Expenses</div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Total expenses</span>
          <span className="font-semibold">{formatXAF(totalExpenses)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">COGS</span>
          <span className="font-semibold">{formatXAF(cogs)}</span>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, accent }: { icon: typeof TrendingUp; label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border border-border p-3 ${accent ? "bg-primary text-primary-foreground" : "bg-card"}`}>
      <Icon className="h-4 w-4 opacity-70 mb-1" />
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-lg font-bold leading-tight mt-0.5">{value}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="px-4 py-2 border-b border-border font-semibold text-sm">{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Row({ left, sub, right }: { left: React.ReactNode; sub?: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-border last:border-0">
      <div>
        <div className="text-sm">{left}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </div>
      <div className="text-sm font-medium">{right}</div>
    </div>
  );
}

function Empty() {
  return <p className="p-4 text-xs text-muted-foreground text-center">No data</p>;
}
