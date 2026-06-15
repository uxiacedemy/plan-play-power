import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — MboaPOS" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    shop_name: "", currency: "XAF", language: "en", phone: "", address: "",
    tax_rate: 0, low_stock_threshold: 5, receipt_header: "", receipt_footer: "",
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setForm({
        shop_name: profile.shop_name ?? "",
        currency: profile.currency ?? "XAF",
        language: profile.language ?? "en",
        phone: profile.phone ?? "",
        address: (profile as any).address ?? "",
        tax_rate: Number((profile as any).tax_rate ?? 0),
        low_stock_threshold: Number((profile as any).low_stock_threshold ?? 5),
        receipt_header: (profile as any).receipt_header ?? "",
        receipt_footer: (profile as any).receipt_footer ?? "",
      });
    }
  }, [profile]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const { error } = await supabase.from("profiles").update(form).eq("id", user.id);
      if (error) throw error;
      if (typeof window !== "undefined") localStorage.setItem("lang", form.language);
      i18n.changeLanguage(form.language);
    },
    onSuccess: () => {
      toast.success("Settings saved");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div><Label>Shop name</Label><Input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Currency</Label>
            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="XAF">XAF (FCFA)</SelectItem>
                <SelectItem value="XOF">XOF (FCFA)</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Language</Label>
            <Select value={form.language} onValueChange={(v) => setForm({ ...form, language: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
        <div><Label>Address</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Default tax %</Label><Input type="number" value={form.tax_rate} onChange={(e) => setForm({ ...form, tax_rate: Number(e.target.value) })} /></div>
          <div><Label>Low-stock threshold</Label><Input type="number" value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: Number(e.target.value) })} /></div>
        </div>
        <div><Label>Receipt header</Label><Textarea value={form.receipt_header} onChange={(e) => setForm({ ...form, receipt_header: e.target.value })} /></div>
        <div><Label>Receipt footer</Label><Textarea value={form.receipt_footer} onChange={(e) => setForm({ ...form, receipt_footer: e.target.value })} /></div>
        <Button onClick={() => saveMut.mutate()} className="w-full">Save</Button>
      </div>
    </div>
  );
}
