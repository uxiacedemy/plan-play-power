import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { MessageCircle, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { formatXAF } from "@/lib/format";
import { ThermalPrintButton } from "@/components/ThermalPrintButton";
import type { ReceiptPayload } from "@/lib/escpos";

export const Route = createFileRoute("/_authenticated/receipt/$saleId")({
  head: () => ({ meta: [{ title: "Receipt — MboaPOS" }] }),
  component: ReceiptPage,
});

function ReceiptPage() {
  const { saleId } = Route.useParams();

  const { data, isLoading } = useQuery({
    queryKey: ["receipt", saleId],
    queryFn: async () => {
      const [sale, items, profile] = await Promise.all([
        supabase.from("sales").select("*").eq("id", saleId).single(),
        supabase.from("sale_items").select("*").eq("sale_id", saleId),
        supabase.from("profiles").select("shop_name,phone").maybeSingle(),
      ]);
      if (sale.error) throw sale.error;
      if (items.error) throw items.error;
      return { sale: sale.data, items: items.data ?? [], profile: profile.data };
    },
  });

  if (isLoading || !data) {
    return <p className="text-muted-foreground p-8 text-center">Loading receipt…</p>;
  }

  const { sale, items, profile } = data;
  const date = new Date(sale.created_at);

  const shareWhatsApp = () => {
    const lines = [
      `*${profile?.shop_name ?? "Receipt"}*`,
      `Sale #${sale.id.slice(0, 8)}`,
      date.toLocaleString(),
      "",
      ...items.map((i) => `${i.quantity}× ${i.name_snapshot} — ${formatXAF(Number(i.line_total))}`),
      "",
      `*Total: ${formatXAF(Number(sale.total))}*`,
      `Payment: ${sale.payment_method}`,
    ].join("\n");
    window.open(`https://wa.me/?text=${encodeURIComponent(lines)}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <Link to="/pos" className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <ArrowLeft className="h-4 w-4" /> Back to POS
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={shareWhatsApp}>
            <MessageCircle className="h-4 w-4 mr-1" /> WhatsApp
          </Button>
          <ThermalPrintButton
            payload={{
              shopName: profile?.shop_name ?? "Shop",
              shopPhone: profile?.phone ?? null,
              saleId: sale.id,
              date,
              items: items.map((i) => ({
                name: i.name_snapshot,
                qty: Number(i.quantity),
                unitPrice: Number(i.unit_price),
                total: Number(i.line_total),
              })),
              subtotal: Number((sale as { subtotal?: number }).subtotal ?? sale.total),
              discount: Number((sale as { discount?: number }).discount ?? 0),
              tax: Number((sale as { tax_total?: number }).tax_total ?? 0),
              total: Number(sale.total),
              paymentMethod: sale.payment_method,
            } satisfies ReceiptPayload}
          />
        </div>
      </div>

      <div className="receipt mx-auto bg-white text-black rounded-xl border border-border p-6 max-w-sm font-mono text-sm">
        <div className="text-center mb-3">
          <div className="font-bold text-base">{profile?.shop_name ?? "Shop"}</div>
          {profile?.phone && <div className="text-xs">{profile.phone}</div>}
        </div>
        <div className="text-xs mb-2">
          <div>Sale #{sale.id.slice(0, 8)}</div>
          <div>{date.toLocaleString()}</div>
        </div>
        <div className="border-t border-dashed border-black/30 my-2" />
        <div className="space-y-1">
          {items.map((i) => (
            <div key={i.id}>
              <div className="flex justify-between">
                <span className="truncate pr-2">{i.name_snapshot}</span>
                <span className="tabular-nums">{formatXAF(Number(i.line_total))}</span>
              </div>
              <div className="text-xs opacity-70">
                {i.quantity} × {formatXAF(Number(i.unit_price))}
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-black/30 my-2" />
        <div className="flex justify-between font-bold text-base">
          <span>TOTAL</span>
          <span className="tabular-nums">{formatXAF(Number(sale.total))}</span>
        </div>
        <div className="text-xs mt-2 capitalize">Payment: {sale.payment_method.replace(/_/g, " ")}</div>
        <div className="text-center text-xs mt-4 opacity-70">Thank you!</div>
      </div>
    </div>
  );
}
