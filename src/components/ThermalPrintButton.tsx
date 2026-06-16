import { useState } from "react";
import { Bluetooth, Printer, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  connectPrinter, printReceipt, isWebBluetoothSupported, browserPrintFallback,
  type ReceiptPayload,
} from "@/lib/escpos";

type Props = { payload: ReceiptPayload; className?: string };

export function ThermalPrintButton({ payload, className }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState<32 | 48>(48); // 80mm by default
  const supported = isWebBluetoothSupported();

  const pair = async () => {
    setBusy(true);
    try {
      const conn = await connectPrinter();
      toast.success(`Paired: ${conn.device?.name ?? "printer"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Pairing failed");
    } finally { setBusy(false); }
  };

  const printNow = async () => {
    setBusy(true);
    try {
      await printReceipt({ ...payload, width });
      toast.success("Sent to printer");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Print failed");
    } finally { setBusy(false); }
  };

  return (
    <>
      <Button size="sm" className={className} onClick={() => setOpen(true)}>
        <Printer className="h-4 w-4 mr-1" /> Print
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Print receipt</DialogTitle>
            <DialogDescription>
              {supported
                ? "Send directly to a paired Bluetooth thermal printer, or use the browser print dialog."
                : "Bluetooth printing isn't supported in this browser (iOS Safari). Use the system print dialog — Android can route to a Bluetooth printer via Mopria, iOS via AirPrint."}
            </DialogDescription>
          </DialogHeader>

          {supported && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setWidth(32)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm ${width === 32 ? "border-primary bg-primary/10" : "border-border"}`}
                >58mm</button>
                <button
                  type="button"
                  onClick={() => setWidth(48)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm ${width === 48 ? "border-primary bg-primary/10" : "border-border"}`}
                >80mm</button>
              </div>

              <Button variant="outline" className="w-full" onClick={pair} disabled={busy}>
                <Bluetooth className="h-4 w-4 mr-1" /> Pair / change printer
              </Button>

              <Button className="w-full" onClick={printNow} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />}
                Print to thermal printer
              </Button>
            </div>
          )}

          <DialogFooter className="sm:justify-start">
            <Button variant="ghost" className="w-full" onClick={() => { browserPrintFallback(); setOpen(false); }}>
              Use browser / system print
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
