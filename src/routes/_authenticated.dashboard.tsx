import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, Package, BarChart3, AlertTriangle, Receipt, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatXAF } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — MboaPOS" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const today = useQuery({
    queryKey: ["dashboard-today"],
    queryFn: async () => {
      const start = new Date(); start.setHours(0, 0, 0, 0);
      const { data, error } = await supabase
        .from("sales")
        .select("id,total")
        .gte("created_at", start.toISOString());
      if (error) throw error;
      const total = data.reduce((s, r) => s + Number(r.total), 0);
      return { count: data.length, total };
    },
  });

  const lowStock = useQuery({
    queryKey: ["dashboard-low-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,quantity,reorder_level")
        .order("quantity", { ascending: true });
      if (error) throw error;
      return (data ?? []).filter((p) => p.quantity <= p.reorder_level);
    },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today at a glance</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={TrendingUp}
          label="Today's sales"
          value={today.isLoading ? "—" : formatXAF(today.data?.total ?? 0)}
        />
        <StatCard
          icon={Receipt}
          label="Transactions"
          value={today.isLoading ? "—" : String(today.data?.count ?? 0)}
        />
        <StatCard
          icon={AlertTriangle}
          label="Low stock"
          value={lowStock.isLoading ? "—" : String(lowStock.data?.length ?? 0)}
          tone={lowStock.data && lowStock.data.length > 0 ? "warning" : "default"}
        />
        <StatCard
          icon={Package}
          label="Quick add"
          value="Product"
          to="/products"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <Link
          to="/pos"
          className="rounded-xl border border-border bg-card p-5 hover:border-primary transition flex items-center gap-3"
        >
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShoppingCart className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold">Open POS</div>
            <div className="text-xs text-muted-foreground">Start a new sale</div>
          </div>
        </Link>
        <Link
          to="/reports"
          className="rounded-xl border border-border bg-card p-5 hover:border-primary transition flex items-center gap-3"
        >
          <div className="grid h-12 w-12 place-items-center rounded-lg bg-muted">
            <BarChart3 className="h-5 w-5" />
          </div>
          <div>
            <div className="font-bold">Reports</div>
            <div className="text-xs text-muted-foreground">Sales history</div>
          </div>
        </Link>
      </div>

      {lowStock.data && lowStock.data.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-center gap-2 font-bold mb-2 text-warning-foreground">
            <AlertTriangle className="h-4 w-4" /> Low stock items
          </div>
          <ul className="space-y-1 text-sm">
            {lowStock.data.slice(0, 8).map((p) => (
              <li key={p.id} className="flex justify-between">
                <span className="truncate">{p.name}</span>
                <span className="text-muted-foreground tabular-nums">
                  {p.quantity} / {p.reorder_level}
                </span>
              </li>
            ))}
          </ul>
          {lowStock.data.length > 8 && (
            <Link to="/products" className="text-xs text-primary mt-2 inline-block">
              View all {lowStock.data.length} →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, tone = "default", to,
}: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  tone?: "default" | "warning";
  to?: "/products" | "/pos" | "/reports";
}) {
  const body = (
    <div className={`rounded-xl border p-4 ${
      tone === "warning" ? "border-warning/40 bg-warning/10" : "border-border bg-card"
    }`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <div className="font-bold text-lg truncate">{value}</div>
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}
