import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Receipt, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatXAF } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — MboaPOS" }] }),
  component: ReportsPage,
});

type Sale = { id: string; total: number; payment_method: string; created_at: string };

function ReportsPage() {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);

  const { data: sales = [], isLoading } = useQuery({
    queryKey: ["sales-today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id,total,payment_method,created_at")
        .gte("created_at", startOfDay.toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sale[];
    },
  });

  const total = sales.reduce((s, x) => s + Number(x.total), 0);
  const count = sales.length;
  const avg = count ? total / count : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Today's Report</h1>
        <p className="text-sm text-muted-foreground">
          {new Date().toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat icon={TrendingUp} label="Revenue" value={formatXAF(total)} accent />
        <Stat icon={Receipt} label="Sales" value={String(count)} />
        <Stat icon={Package} label="Avg sale" value={formatXAF(avg)} />
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-4 py-3 border-b border-border font-semibold">Today's sales</div>
        {isLoading ? (
          <p className="p-6 text-muted-foreground text-center">Loading…</p>
        ) : sales.length === 0 ? (
          <p className="p-10 text-muted-foreground text-center">No sales yet today.</p>
        ) : (
          sales.map((s) => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3 border-b border-border last:border-0">
              <div>
                <div className="font-medium">{formatXAF(s.total)}</div>
                <div className="text-xs text-muted-foreground capitalize">
                  {s.payment_method.replace("_", " ")} · {new Date(s.created_at).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
              <div className="text-xs text-muted-foreground font-mono">#{s.id.slice(0, 6)}</div>
            </div>
          ))
        )}
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
