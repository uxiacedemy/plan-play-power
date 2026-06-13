# Remaining-Gaps Roadmap (Phase 4 → 8)

You asked for everything still missing from the Phase 1 & 2 PDFs. That's a lot — I'll group it into 5 shippable phases so each one is reviewable and the app stays working between them.

## Phase 4 — Product model upgrade & Suppliers
Foundation for profit reports, expiry alerts, and supplier tracking.

- **DB migration**: add to `products` — `brand`, `cost_price numeric`, `supplier_id uuid`, `expiry_date date`, `reorder_level int default 5`, `unit text default 'pcs'`, `tax_rate numeric default 0`, `image_url text`. Backfill `reorder_level=5`.
- **New tables**: `categories` (id, user_id, name, unique per shop) + `suppliers` (id, user_id, name, phone, email, address, notes). Full RLS via `current_shop_owner()`, GRANTs.
- **Migrate `products.category` text** → `category_id` FK (keep old col for one release, dual-write).
- **UI**: Product form gets brand, cost, supplier picker, expiry, reorder level, unit, tax, image upload (Lovable Cloud storage bucket `product-images`). New `/suppliers` route (manager+). New `/categories` route.
- **Bulk import**: CSV upload on Products page → preview → commit (manager+).

## Phase 5 — Customers, Credit & Loyalty
Whole module currently missing.

- **DB**: `customers` (name, phone, email, address, notes, loyalty_points), `customer_credits` (customer_id, sale_id, amount, type debt/payment, balance_after), trigger to update running balance.
- **POS**: optional "Attach customer" step before checkout; payment method gains `credit` option (only if customer attached).
- **Sales schema**: add `customer_id`, `discount`, `tax_total`, `subtotal`, `notes` to `sales`; per-line `discount` on `sale_items`. Update `checkout_sale` RPC.
- **Routes**: `/customers` list + detail (purchase history, outstanding debt, "Record payment" dialog, loyalty points balance).
- **WhatsApp**: "Send statement" deep-link from customer detail.

## Phase 6 — Reports v2, Settings & i18n
- **Reports**: tabs for Daily / Weekly / Monthly / Custom range. Cards: revenue, # transactions, profit (selling − cost), top products, payment-method breakdown, employee performance, inventory valuation, expiring-soon list.
- **Expenses**: `expenses` table (category, amount, date, note, recorded_by) + `/expenses` route. Subtracted in profit report.
- **Export**: PDF (`jspdf`) + Excel (`xlsx`) buttons on each report.
- **Settings route** `/settings`: shop name, currency (XAF default, configurable), language (EN/FR), tax rate default, receipt header/footer text, low-stock threshold default, notification prefs.
- **i18n**: `react-i18next` with `en.json` / `fr.json`, language switcher in AppShell, persisted in profile.

## Phase 7 — Multi-branch & Notifications
- **DB**: `branches` (shop_id, name, address, phone). Add `branch_id` to `products`, `sales`, `stock_movements`. Migration backfills a default "Main" branch per shop.
- **RLS**: extend `current_shop_owner()` chain to scope by branch where the staff member is assigned. `shop_members` gains `branch_id` (nullable = all branches).
- **UI**: branch switcher in AppShell, branch selector on staff invite, inter-branch stock transfer dialog (creates two `stock_movements` rows).
- **Notifications center**: `notifications` table + bell icon in AppShell. Triggers for low stock, expiry within 30d, daily sales summary (pg_cron job hitting `/api/public/cron/daily-summary`), sync-failure alerts.

## Phase 8 — Offline-first PWA
- Install `vite-plugin-pwa`, add manifest + service worker, app icon set.
- IndexedDB queue (`idb-keyval`) for offline sales; background sync flushes via `checkout_sale` when online. Conflict resolution = server wins on stock, local sale gets `synced_at`.
- Offline banner + per-sale sync status badge in transaction history.
- "Install app" prompt on auth + dashboard.

## Out of scope (web platform can't do these)
Flutter, native Android APK, Bluetooth thermal printer SDK, FCM push (web push only via service worker — covered in Phase 8 if you want).

## Suggested execution
Ship phases in order — each one is ~1 working session and leaves the app fully usable. **Reply with one of**:
- `go` → I start Phase 4 now and chain through to 8.
- `4 only`, `4 and 5`, etc. → I stop after the named phases.
- Any edits to scope.
