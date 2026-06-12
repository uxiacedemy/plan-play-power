import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, Minus, Trash2, ShoppingCart, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { formatXAF } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({ meta: [{ title: "POS — MboaPOS" }] }),
  component: POSPage,
});

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  selling_price: number;
  quantity: number;
  category: string | null;
};

type CartItem = { product: Product; qty: number };

function POSPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState("cash");
  const [showCart, setShowCart] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,barcode,selling_price,quantity,category")
        .order("name");
      if (error) throw error;
      return data as Product[];
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q) ||
        (p.category ?? "").toLowerCase().includes(q),
    );
  }, [products, search]);

  const total = cart.reduce((s, i) => s + i.product.selling_price * i.qty, 0);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  const addToCart = (p: Product) => {
    if (p.quantity <= 0) {
      toast.error("Out of stock");
      return;
    }
    setCart((c) => {
      const ex = c.find((i) => i.product.id === p.id);
      if (ex) {
        if (ex.qty >= p.quantity) {
          toast.error(`Only ${p.quantity} in stock`);
          return c;
        }
        return c.map((i) => (i.product.id === p.id ? { ...i, qty: i.qty + 1 } : i));
      }
      return [...c, { product: p, qty: 1 }];
    });
  };

  const setQty = (id: string, qty: number) => {
    setCart((c) =>
      c.flatMap((i) => {
        if (i.product.id !== id) return [i];
        if (qty <= 0) return [];
        if (qty > i.product.quantity) {
          toast.error(`Only ${i.product.quantity} in stock`);
          return [{ ...i, qty: i.product.quantity }];
        }
        return [{ ...i, qty }];
      }),
    );
  };

  const checkout = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("checkout_sale", {
        _items: cart.map((i) => ({ product_id: i.product.id, quantity: i.qty })),
        _payment_method: payment,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success(`Sale completed — ${formatXAF(total)}`);
      setCart([]);
      setShowCart(false);
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["sales-today"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Checkout failed"),
  });

  return (
    <div className="grid md:grid-cols-[1fr_22rem] gap-4">
      <section>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, barcode, category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11"
            autoFocus
          />
        </div>

        {isLoading ? (
          <p className="text-muted-foreground text-sm">Loading products…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground text-sm">
            No products. Add some in the Products tab.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.quantity <= 0}
                className="text-left rounded-xl border border-border bg-card p-3 hover:border-primary hover:shadow-sm transition disabled:opacity-50"
              >
                <div className="font-medium leading-tight line-clamp-2 min-h-[2.5rem]">{p.name}</div>
                <div className="text-primary font-semibold mt-2">{formatXAF(p.selling_price)}</div>
                <div className={`text-xs mt-0.5 ${p.quantity <= 5 ? "text-warning-foreground" : "text-muted-foreground"}`}>
                  {p.quantity} in stock
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <aside
        className={`${
          showCart ? "fixed inset-0 z-40 bg-background p-4 overflow-y-auto" : "hidden"
        } md:static md:block md:p-0 md:bg-transparent`}
      >
        <div className="md:sticky md:top-20 rounded-xl border border-border bg-card p-4 flex flex-col gap-3 max-h-[80vh]">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg">Cart ({cartCount})</h2>
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setShowCart(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto -mx-1 px-1 space-y-2 min-h-[6rem]">
            {cart.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">Tap a product to add</p>
            ) : (
              cart.map((i) => (
                <div key={i.product.id} className="flex items-center gap-2 rounded-lg bg-muted/40 p-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{i.product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatXAF(i.product.selling_price)} × {i.qty} = {formatXAF(i.product.selling_price * i.qty)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(i.product.id, i.qty - 1)}>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="w-6 text-center text-sm">{i.qty}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setQty(i.product.id, i.qty + 1)}>
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setQty(i.product.id, 0)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="border-t border-border pt-3 space-y-3">
            <Select value={payment} onValueChange={setPayment}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="mtn_momo">MTN Mobile Money</SelectItem>
                <SelectItem value="orange_money">Orange Money</SelectItem>
                <SelectItem value="bank">Bank transfer</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total</span><span className="text-primary">{formatXAF(total)}</span>
            </div>
            <Button
              className="w-full h-12 text-base"
              disabled={cart.length === 0 || checkout.isPending}
              onClick={() => checkout.mutate()}
            >
              {checkout.isPending ? "Processing…" : "Complete sale"}
            </Button>
          </div>
        </div>
      </aside>

      {cart.length > 0 && !showCart && (
        <button
          onClick={() => setShowCart(true)}
          className="md:hidden fixed bottom-20 right-4 z-30 flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-3 shadow-lg font-medium"
        >
          <ShoppingCart className="h-4 w-4" />
          {cartCount} · {formatXAF(total)}
        </button>
      )}
    </div>
  );
}
