import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, IScannerControls } from "@zxing/browser";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

export function BarcodeScanner({
  open, onOpenChange, onDetected,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDetected: (code: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    setStarting(true);

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        if (cancelled) return;
        if (devices.length === 0) {
          toast.error("No camera found");
          onOpenChange(false);
          return;
        }
        const back = devices.find((d) => /back|rear|environment/i.test(d.label)) ?? devices[0];
        controlsRef.current = await reader.decodeFromVideoDevice(
          back.deviceId,
          videoRef.current!,
          (result, _err, controls) => {
            if (result) {
              const code = result.getText();
              controls.stop();
              onDetected(code);
              onOpenChange(false);
            }
          },
        );
        setStarting(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Camera error");
        onOpenChange(false);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4" /> Scan barcode
          </DialogTitle>
        </DialogHeader>
        <div className="relative aspect-square bg-black">
          <video ref={videoRef} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-x-8 top-1/2 -translate-y-1/2 h-0.5 bg-primary/80 shadow-[0_0_12px_hsl(var(--primary))]" />
          {starting && (
            <div className="absolute inset-0 grid place-items-center text-white text-sm">
              Starting camera…
            </div>
          )}
        </div>
        <div className="p-3 flex justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4 mr-1" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
