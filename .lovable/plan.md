# Phase 3 — MVP Completion (web-adapted)

The PDF targets Flutter + NestJS. Our stack is TanStack Start + Lovable Cloud, so I'm mapping the MVP checklist to web equivalents and dropping the items that only exist on native (Flutter SDK setup, FCM push, Bluetooth thermal printers, Play Store APK).

Already shipped in Phase 1–2: auth, products CRUD, POS checkout, stock deduction, daily reports, multi-user roles.

## What this phase adds

### 1. Product enhancements
- **Categories**: add `category` filter chips on Products + POS; existing `category` column already exists.
- **Barcode scanning** (camera): integrate `@zxing/browser` for in-browser scanning on POS and Product form. Manual entry already works.
- **Validation rules**: unique barcode per shop, non-negative price/qty (DB constraints + form validation).

### 2. Receipts
- Printable receipt view at `/receipt/$saleId` (browser print → works with thermal printers via OS print dialog).
- Shows: shop name, items, qty, unit price, line total, grand total, payment method, sale ID, date.
- "Print" + "Share via WhatsApp" (wa.me deep link with text summary) buttons.
- After checkout, redirect/open receipt automatically.

### 3. Inventory module
- **Stock adjustments**: new `stock_movements` table logging every change (sale, manual add, manual remove, adjustment) with reason + user.
- **Low-stock alerts**: dashboard banner + Products page badge when `quantity <= reorder_level`.
- Manual "Add stock" / "Adjust stock" dialog on Product row (manager+ only).

### 4. POS resilience
- Optimistic cart state in `localStorage` so a page refresh mid-sale doesn't lose the cart.
- Clear error messages on checkout failure (insufficient stock, network).
- Product lookup uses client-side index for sub-second search.

### 5. Dashboard landing
- `/` (authenticated) becomes a dashboard: today's sales total, # transactions, low-stock count, quick links.

## Out of scope (deferred / not applicable)

- Flutter app, Android Studio, APK builds — wrong stack.
- Firebase Cloud Messaging push — web equivalent would be Web Push; deferring to Phase 4.
- Bluetooth thermal printer SDK — browsers can print to thermal printers via OS print dialog (CSS `@page` sized for 58/80mm), which we will set up. Direct Web Bluetooth integration deferred.
- Full offline-first sync engine with conflict resolver — significant work; Phase 1 already requires connectivity. We add cart persistence + clear offline error UI here, full sync engine deferred to Phase 4.
- Analytics (Sentry/Firebase) — Phase 4.

## Technical details

**New tables (migration):**
- `stock_movements` (id, user_id=owner, product_id, delta int, reason text, note text, actor_id, created_at) — RLS scoped via `current_shop_owner()`, insertable by `can_manage_inventory()`.
- Add unique partial index on `products (user_id, barcode) where barcode is not null`.
- Add CHECK constraints: `selling_price >= 0`, `cost_price >= 0`, `quantity >= 0`.
- Trigger on `sale_items` insert → write `stock_movements` row with `reason='sale'`.

**New server fns** (`src/lib/inventory.functions.ts`):
- `adjustStock({ product_id, delta, reason, note })` — security definer or RLS-policied update + movement log.
- `listMovements({ product_id? })`.

**New routes:**
- `src/routes/_authenticated.index.tsx` — dashboard (replaces redirect).
- `src/routes/_authenticated.receipt.$saleId.tsx` — printable receipt.
- Keep existing `pos`, `products`, `reports`, `staff`.

**New components:**
- `BarcodeScanner.tsx` — `@zxing/browser` wrapper with camera picker.
- `LowStockBadge.tsx`.
- `StockAdjustDialog.tsx`.
- `ReceiptPrintable.tsx` with print-only CSS (`@page { size: 80mm auto }`).

**Packages to add:** `@zxing/browser`, `@zxing/library`.

Once you approve, I'll implement in this order: DB migration → inventory fns → receipt route → barcode scanner → dashboard → POS polish.
