import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function StockAdjustDialog({
  open, onOpenChange, productId, productName, currentQty,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  productId: string;
  productName: string;
  currentQty: number;
}) {
  const qc = useQueryClient();
  const [mode, setMode] = useState<"add" | "remove">("add");
  const [reason, setReason] = useState("restock");
  const [amount, setAmount] = useState("1");
  const [note, setNote] = useState("");

  const mutate = useMutation({
    mutationFn: async () => {
      const qty = parseInt(amount);
      if (!qty || qty <= 0) throw new Error("Enter a positive quantity");
      const delta = mode === "add" ? qty : -qty;
      const { error } = await supabase.rpc("adjust_stock", {
        _product_id: productId,
        _delta: delta,
        _reason: reason,
        _note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock updated");
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
      setAmount("1");
      setNote("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Adjust stock</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{productName}</span> · {currentQty} in stock
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={mode === "add" ? "default" : "outline"}
              onClick={() => { setMode("add"); setReason("restock"); }}
            >
              + Add
            </Button>
            <Button
              type="button"
              variant={mode === "remove" ? "default" : "outline"}
              onClick={() => { setMode("remove"); setReason("damage"); }}
            >
              − Remove
            </Button>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Quantity</Label>
            <Input type="number" min="1" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {mode === "add" ? (
                  <>
                    <SelectItem value="restock">Restock</SelectItem>
                    <SelectItem value="return">Customer return</SelectItem>
                    <SelectItem value="correction">Correction</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="damage">Damage</SelectItem>
                    <SelectItem value="loss">Loss / theft</SelectItem>
                    <SelectItem value="expiry">Expired</SelectItem>
                    <SelectItem value="correction">Correction</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Note (optional)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => mutate.mutate()} disabled={mutate.isPending} className="w-full">
            {mutate.isPending ? "Saving…" : "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
