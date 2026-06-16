// ESC/POS thermal printer driver (Web Bluetooth, 80mm)
// Targets generic 58/80mm BT printers (Nyrius, Xprinter, Goojprt, Munbyn, etc.)
// Falls back gracefully on iOS/Safari where Web Bluetooth is unavailable.

/* eslint-disable @typescript-eslint/no-explicit-any */

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;

// Common GATT services exposed by ESC/POS BT printers.
// Most printers (Goojprt/Xprinter clones) use the 0xFF00 family;
// some Bluetooth-SIG generic serial (Nordic UART) variants also exist.
const PRINTER_SERVICES: BluetoothServiceUUID[] = [
  0xff00,
  0x18f0,
  0xfee7,
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "6e400001-b5a3-f393-e0a9-e50e24dcca9e", // Nordic UART
];

const WRITE_CHARS: BluetoothCharacteristicUUID[] = [
  0xff02,
  0x2af1,
  "00002af1-0000-1000-8000-00805f9b34fb",
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "6e400002-b5a3-f393-e0a9-e50e24dcca9e",
];

const STORE_KEY = "mboapos.printer.deviceId";

export type PrinterLine =
  | { type: "text"; text: string; bold?: boolean; align?: "left" | "center" | "right"; size?: "normal" | "large" }
  | { type: "row"; left: string; right: string; bold?: boolean }
  | { type: "divider" }
  | { type: "feed"; lines?: number }
  | { type: "qr"; data: string };

export type ReceiptPayload = {
  shopName: string;
  shopPhone?: string | null;
  shopAddress?: string | null;
  header?: string | null;
  footer?: string | null;
  saleId: string;
  date: Date;
  items: { name: string; qty: number; unitPrice: number; total: number }[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  paymentMethod: string;
  cashier?: string | null;
  width?: 32 | 48; // chars; 58mm=32, 80mm=48
};

export function isWebBluetoothSupported(): boolean {
  if (typeof navigator === "undefined") return false;
  return !!(navigator as any).bluetooth;
}

// ---- Byte builders ---------------------------------------------------------

const enc = new TextEncoder();

function pad(s: string, n: number) {
  if (s.length >= n) return s.slice(0, n);
  return s + " ".repeat(n - s.length);
}
function padLeft(s: string, n: number) {
  if (s.length >= n) return s.slice(0, n);
  return " ".repeat(n - s.length) + s;
}

function row(left: string, right: string, width: number) {
  const rightLen = Math.min(right.length, Math.floor(width / 2));
  const leftLen = width - rightLen - 1;
  const l = left.length > leftLen ? left.slice(0, leftLen) : pad(left, leftLen);
  return `${l} ${padLeft(right, rightLen)}`;
}

function center(s: string, width: number) {
  if (s.length >= width) return s.slice(0, width);
  const pad = Math.floor((width - s.length) / 2);
  return " ".repeat(pad) + s;
}

function concat(parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

function bytes(...b: number[]) { return new Uint8Array(b); }

export function buildReceiptBytes(p: ReceiptPayload): Uint8Array {
  const W = p.width ?? 32; // default 58mm safe; printer can render 80mm at 48 wide too
  const parts: Uint8Array[] = [];

  parts.push(bytes(ESC, 0x40)); // init
  parts.push(bytes(ESC, 0x74, 0x10)); // codepage (WPC1252 close enough)

  // Header — center, bold, double
  parts.push(bytes(ESC, 0x61, 0x01)); // center
  parts.push(bytes(ESC, 0x45, 0x01)); // bold on
  parts.push(bytes(GS, 0x21, 0x11)); // double size
  parts.push(enc.encode(p.shopName + "\n"));
  parts.push(bytes(GS, 0x21, 0x00)); // normal size
  parts.push(bytes(ESC, 0x45, 0x00)); // bold off

  if (p.shopAddress) parts.push(enc.encode(p.shopAddress + "\n"));
  if (p.shopPhone) parts.push(enc.encode("Tel: " + p.shopPhone + "\n"));
  if (p.header) parts.push(enc.encode(p.header + "\n"));

  parts.push(bytes(ESC, 0x61, 0x00)); // left
  parts.push(enc.encode("-".repeat(W) + "\n"));
  parts.push(enc.encode(`Receipt #${p.saleId.slice(0, 8)}\n`));
  parts.push(enc.encode(`${p.date.toLocaleString()}\n`));
  if (p.cashier) parts.push(enc.encode(`Cashier: ${p.cashier}\n`));
  parts.push(enc.encode("-".repeat(W) + "\n"));

  // Items
  for (const it of p.items) {
    const name = it.name.length > W ? it.name.slice(0, W) : it.name;
    parts.push(enc.encode(name + "\n"));
    const line = row(`  ${it.qty} x ${formatNum(it.unitPrice)}`, formatNum(it.total), W);
    parts.push(enc.encode(line + "\n"));
  }

  parts.push(enc.encode("-".repeat(W) + "\n"));
  parts.push(enc.encode(row("Subtotal", formatNum(p.subtotal), W) + "\n"));
  if (p.discount && p.discount > 0) {
    parts.push(enc.encode(row("Discount", "-" + formatNum(p.discount), W) + "\n"));
  }
  if (p.tax && p.tax > 0) {
    parts.push(enc.encode(row("Tax", formatNum(p.tax), W) + "\n"));
  }

  // Total — bold, double
  parts.push(bytes(ESC, 0x45, 0x01));
  parts.push(bytes(GS, 0x21, 0x01)); // double height
  parts.push(enc.encode(row("TOTAL", formatNum(p.total) + " FCFA", W) + "\n"));
  parts.push(bytes(GS, 0x21, 0x00));
  parts.push(bytes(ESC, 0x45, 0x00));

  parts.push(enc.encode(`Payment: ${p.paymentMethod}\n`));
  parts.push(enc.encode("-".repeat(W) + "\n"));

  parts.push(bytes(ESC, 0x61, 0x01)); // center
  if (p.footer) parts.push(enc.encode(p.footer + "\n"));
  parts.push(enc.encode("Merci! Thank you!\n"));
  parts.push(bytes(ESC, 0x61, 0x00));

  // Feed + cut
  parts.push(bytes(LF, LF, LF, LF));
  parts.push(bytes(GS, 0x56, 0x42, 0x00)); // partial cut

  return concat(parts);
}

function formatNum(n: number) {
  return new Intl.NumberFormat("fr-CM", { maximumFractionDigits: 0 }).format(Math.round(n));
}

// ---- BT connection layer ---------------------------------------------------

export type PrinterConnection = {
  device: any;
  characteristic: any;
};

let cached: PrinterConnection | null = null;

async function findWriteCharacteristic(server: any): Promise<any> {
  for (const svcUuid of PRINTER_SERVICES) {
    try {
      const svc = await server.getPrimaryService(svcUuid);
      const chars = await svc.getCharacteristics();
      for (const c of chars) {
        if (c.properties?.write || c.properties?.writeWithoutResponse) {
          // prefer known UUIDs
          if (WRITE_CHARS.some((u) => String(u).toLowerCase() === String(c.uuid).toLowerCase())) return c;
        }
      }
      // fallback: any writable
      for (const c of chars) {
        if (c.properties?.write || c.properties?.writeWithoutResponse) return c;
      }
    } catch {
      // service not present on this printer; try next
    }
  }
  throw new Error("No compatible printer service/characteristic found.");
}

export async function connectPrinter(): Promise<PrinterConnection> {
  if (!isWebBluetoothSupported()) {
    throw new Error("Web Bluetooth not available on this device/browser.");
  }
  const bt = (navigator as any).bluetooth;
  const device = await bt.requestDevice({
    acceptAllDevices: true,
    optionalServices: PRINTER_SERVICES,
  });
  const server = await device.gatt.connect();
  const ch = await findWriteCharacteristic(server);
  try { localStorage.setItem(STORE_KEY, device.id ?? device.name ?? ""); } catch { /* ignore */ }
  cached = { device, characteristic: ch };
  device.addEventListener?.("gattserverdisconnected", () => { cached = null; });
  return cached;
}

export async function getOrConnect(): Promise<PrinterConnection> {
  if (cached?.device?.gatt?.connected) return cached;
  return connectPrinter();
}

export function getPairedName(): string | null {
  return cached?.device?.name ?? null;
}

// Some printers cap MTU around 20-180 bytes; chunk writes.
const CHUNK = 180;

export async function printBytes(data: Uint8Array): Promise<void> {
  const conn = await getOrConnect();
  const ch = conn.characteristic;
  for (let i = 0; i < data.length; i += CHUNK) {
    const slice = data.slice(i, i + CHUNK);
    if (ch.writeValueWithoutResponse) {
      try { await ch.writeValueWithoutResponse(slice); continue; } catch { /* fall through */ }
    }
    await ch.writeValue(slice);
    // tiny delay so slower printers can flush
    await new Promise((r) => setTimeout(r, 15));
  }
}

export async function printReceipt(p: ReceiptPayload): Promise<void> {
  const data = buildReceiptBytes(p);
  await printBytes(data);
}

// Fallback for iOS / unsupported browsers — opens system print dialog,
// which on Android can target a Bluetooth printer via Google Cloud Print /
// Mopria, and on iOS via AirPrint.
export function browserPrintFallback(): void {
  if (typeof window !== "undefined") window.print();
}
