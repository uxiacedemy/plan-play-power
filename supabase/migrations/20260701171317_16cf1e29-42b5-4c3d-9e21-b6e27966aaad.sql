
-- Add columns FIRST
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS receipt_no bigint,
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS refunded_from uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,
  ADD COLUMN IF NOT EXISTS refund_reason text;

UPDATE public.sales SET status = 'voided' WHERE voided = true AND status = 'completed';

ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_status_check;
ALTER TABLE public.sales ADD CONSTRAINT sales_status_check
  CHECK (status IN ('completed','voided','refunded'));

CREATE TABLE IF NOT EXISTS public.shop_counters (
  user_id uuid PRIMARY KEY,
  last_receipt_no bigint NOT NULL DEFAULT 0
);
GRANT SELECT ON public.shop_counters TO authenticated;
GRANT ALL ON public.shop_counters TO service_role;
ALTER TABLE public.shop_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "shop counters read" ON public.shop_counters;
CREATE POLICY "shop counters read" ON public.shop_counters
  FOR SELECT TO authenticated USING (user_id = public.current_shop_owner());

CREATE OR REPLACE FUNCTION public.next_receipt_no(_owner uuid)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n bigint;
BEGIN
  INSERT INTO public.shop_counters(user_id, last_receipt_no) VALUES (_owner, 1)
    ON CONFLICT (user_id) DO UPDATE SET last_receipt_no = public.shop_counters.last_receipt_no + 1
    RETURNING last_receipt_no INTO _n;
  RETURN _n;
END $$;

-- BACKFILL receipt numbers BEFORE creating immutability trigger
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, user_id FROM public.sales WHERE receipt_no IS NULL ORDER BY user_id, created_at LOOP
    UPDATE public.sales SET receipt_no = public.next_receipt_no(r.user_id) WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS sales_owner_receipt_no_uniq
  ON public.sales(user_id, receipt_no) WHERE receipt_no IS NOT NULL;

-- NOW create immutability guards
CREATE OR REPLACE FUNCTION public.sales_immutability_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Sales cannot be deleted (id=%)', OLD.id;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id <> OLD.id
       OR NEW.user_id <> OLD.user_id
       OR NEW.total <> OLD.total
       OR NEW.subtotal <> OLD.subtotal
       OR NEW.discount <> OLD.discount
       OR NEW.tax_total <> OLD.tax_total
       OR COALESCE(NEW.payment_method,'') <> COALESCE(OLD.payment_method,'')
       OR COALESCE(NEW.customer_id::text,'') <> COALESCE(OLD.customer_id::text,'')
       OR NEW.cashier_id <> OLD.cashier_id
       OR NEW.created_at <> OLD.created_at
       OR COALESCE(NEW.receipt_no::text,'') <> COALESCE(OLD.receipt_no::text,'')
    THEN
      RAISE EXCEPTION 'Completed sales are immutable (id=%)', OLD.id;
    END IF;
    IF OLD.status = 'completed' AND NEW.status NOT IN ('completed','voided','refunded') THEN
      RAISE EXCEPTION 'Invalid sale status transition: % -> %', OLD.status, NEW.status;
    END IF;
    IF OLD.status IN ('voided','refunded') AND NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'Sale is % and cannot change state', OLD.status;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sales_immutability ON public.sales;
CREATE TRIGGER trg_sales_immutability
  BEFORE UPDATE OR DELETE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.sales_immutability_guard();

CREATE OR REPLACE FUNCTION public.sale_items_immutability_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Sale items are immutable after checkout (id=%)', OLD.id;
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Sale items cannot be deleted (id=%)', OLD.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sale_items_immutability ON public.sale_items;
CREATE TRIGGER trg_sale_items_immutability
  BEFORE UPDATE OR DELETE ON public.sale_items
  FOR EACH ROW EXECUTE FUNCTION public.sale_items_immutability_guard();

-- Stock movements integrity
ALTER TABLE public.stock_movements DROP CONSTRAINT IF EXISTS stock_movements_delta_nonzero;
ALTER TABLE public.stock_movements ADD CONSTRAINT stock_movements_delta_nonzero CHECK (delta <> 0);
ALTER TABLE public.stock_movements ADD COLUMN IF NOT EXISTS device_id text;

-- Role helpers
CREATE OR REPLACE FUNCTION public.is_manager_or_owner()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'manager');
$$;

-- Rewrite checkout_sale
CREATE OR REPLACE FUNCTION public.checkout_sale(
  _items jsonb, _payment_method text, _customer_id uuid DEFAULT NULL,
  _discount numeric DEFAULT 0, _tax_total numeric DEFAULT 0,
  _notes text DEFAULT NULL, _device_id text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid := public.current_shop_owner();
  _sale_id uuid;
  _receipt bigint;
  _item jsonb;
  _product public.products;
  _qty int;
  _line_disc numeric;
  _line_total numeric;
  _subtotal numeric(12,2) := 0;
  _total numeric(12,2);
  _points int;
  _discount_pct numeric;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'No items'; END IF;

  IF _customer_id IS NOT NULL THEN
    PERFORM 1 FROM public.customers WHERE id = _customer_id AND user_id = _owner;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::int;
    IF _qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    _line_disc := COALESCE((_item->>'discount')::numeric, 0);
    SELECT * INTO _product FROM public.products
      WHERE id = (_item->>'product_id')::uuid AND user_id = _owner FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
    IF _product.quantity < _qty THEN RAISE EXCEPTION 'Insufficient stock for %', _product.name; END IF;
    _line_total := (_product.selling_price * _qty) - _line_disc;
    IF _line_total < 0 THEN _line_total := 0; END IF;
    _subtotal := _subtotal + _line_total;
  END LOOP;

  IF _subtotal > 0 THEN
    _discount_pct := (COALESCE(_discount,0) / _subtotal) * 100;
    IF _discount_pct > 15 AND NOT public.is_manager_or_owner() THEN
      RAISE EXCEPTION 'Discounts over 15%% require a manager';
    END IF;
  END IF;

  _total := _subtotal - COALESCE(_discount, 0) + COALESCE(_tax_total, 0);
  IF _total < 0 THEN _total := 0; END IF;

  _receipt := public.next_receipt_no(_owner);

  INSERT INTO public.sales(
    user_id, total, payment_method, cashier_id, customer_id,
    subtotal, discount, tax_total, notes, status, receipt_no, device_id
  ) VALUES (
    _owner, _total, _payment_method, _uid, _customer_id,
    _subtotal, COALESCE(_discount,0), COALESCE(_tax_total,0), _notes,
    'completed', _receipt, _device_id
  ) RETURNING id INTO _sale_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::int;
    _line_disc := COALESCE((_item->>'discount')::numeric, 0);
    SELECT * INTO _product FROM public.products WHERE id = (_item->>'product_id')::uuid AND user_id = _owner;
    _line_total := (_product.selling_price * _qty) - _line_disc;
    IF _line_total < 0 THEN _line_total := 0; END IF;
    INSERT INTO public.sale_items(sale_id, user_id, product_id, name_snapshot, quantity, unit_price, line_total, discount)
      VALUES (_sale_id, _owner, _product.id, _product.name, _qty, _product.selling_price, _line_total, _line_disc);
    UPDATE public.products SET quantity = quantity - _qty WHERE id = _product.id;
    INSERT INTO public.stock_movements(user_id, product_id, delta, reason, note, actor_id, device_id)
      VALUES (_owner, _product.id, -_qty, 'sale', _sale_id::text, _uid, _device_id);
  END LOOP;

  IF _payment_method = 'credit' AND _customer_id IS NOT NULL AND _total > 0 THEN
    INSERT INTO public.customer_credits(user_id, customer_id, sale_id, entry_type, amount, payment_method, note, actor_id)
      VALUES (_owner, _customer_id, _sale_id, 'charge', _total, 'credit', 'Sale on credit', _uid);
  END IF;

  IF _customer_id IS NOT NULL AND _total > 0 THEN
    _points := floor(_total / 1000)::int;
    IF _points > 0 THEN
      UPDATE public.customers SET loyalty_points = loyalty_points + _points WHERE id = _customer_id;
    END IF;
  END IF;

  INSERT INTO public.audit_logs(user_id, actor_id, action_type, entity, entity_id, new_value)
    VALUES (_owner, _uid, 'sale.checkout', 'sale', _sale_id,
      jsonb_build_object('receipt_no', _receipt, 'total', _total, 'payment_method', _payment_method, 'device_id', _device_id));

  RETURN _sale_id;
END $$;

-- Rewrite void_sale
CREATE OR REPLACE FUNCTION public.void_sale(_sale_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid := public.current_shop_owner();
  _sale public.sales;
  _it public.sale_items;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_manager_or_owner() THEN RAISE EXCEPTION 'Voiding a sale requires a manager'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'Void reason is required'; END IF;

  SELECT * INTO _sale FROM public.sales WHERE id = _sale_id AND user_id = _owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF _sale.status <> 'completed' THEN RAISE EXCEPTION 'Sale is % and cannot be voided', _sale.status; END IF;
  IF _sale.created_at < (now() - interval '24 hours') THEN
    RAISE EXCEPTION 'Sales can only be voided within 24 hours';
  END IF;

  FOR _it IN SELECT * FROM public.sale_items WHERE sale_id = _sale_id LOOP
    IF _it.product_id IS NOT NULL THEN
      UPDATE public.products SET quantity = quantity + _it.quantity WHERE id = _it.product_id;
      INSERT INTO public.stock_movements(user_id, product_id, delta, reason, note, actor_id)
        VALUES (_owner, _it.product_id, _it.quantity, 'void', _sale_id::text, _uid);
    END IF;
  END LOOP;

  UPDATE public.sales
    SET status = 'voided', voided = true, voided_at = now(), void_reason = _reason
    WHERE id = _sale_id;

  IF _sale.payment_method = 'credit' AND _sale.customer_id IS NOT NULL AND _sale.total > 0 THEN
    INSERT INTO public.customer_credits(user_id, customer_id, sale_id, entry_type, amount, payment_method, note, actor_id)
      VALUES (_owner, _sale.customer_id, _sale_id, 'payment', _sale.total, 'void', 'Void reversal', _uid);
  END IF;

  INSERT INTO public.audit_logs(user_id, actor_id, action_type, entity, entity_id, old_value, new_value)
    VALUES (_owner, _uid, 'sale.void', 'sale', _sale_id,
      jsonb_build_object('status','completed','total',_sale.total),
      jsonb_build_object('status','voided','reason',_reason));
END $$;

-- New refund_sale
CREATE OR REPLACE FUNCTION public.refund_sale(_sale_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid := public.current_shop_owner();
  _sale public.sales;
  _it public.sale_items;
  _refund_id uuid;
  _receipt bigint;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.is_manager_or_owner() THEN RAISE EXCEPTION 'Refunds require a manager'; END IF;
  IF _reason IS NULL OR length(trim(_reason)) < 3 THEN RAISE EXCEPTION 'Refund reason is required'; END IF;

  SELECT * INTO _sale FROM public.sales WHERE id = _sale_id AND user_id = _owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF _sale.status <> 'completed' THEN RAISE EXCEPTION 'Sale is % and cannot be refunded', _sale.status; END IF;

  _receipt := public.next_receipt_no(_owner);

  INSERT INTO public.sales(
    user_id, total, payment_method, cashier_id, customer_id,
    subtotal, discount, tax_total, notes, status, receipt_no,
    refunded_from, refunded_at, refund_reason
  ) VALUES (
    _owner, -_sale.total, _sale.payment_method, _uid, _sale.customer_id,
    -_sale.subtotal, -_sale.discount, -_sale.tax_total,
    'Refund of #' || COALESCE(_sale.receipt_no::text, _sale_id::text) || ': ' || _reason,
    'completed', _receipt, _sale_id, now(), _reason
  ) RETURNING id INTO _refund_id;

  FOR _it IN SELECT * FROM public.sale_items WHERE sale_id = _sale_id LOOP
    INSERT INTO public.sale_items(sale_id, user_id, product_id, name_snapshot, quantity, unit_price, line_total, discount)
      VALUES (_refund_id, _owner, _it.product_id, _it.name_snapshot, -_it.quantity, _it.unit_price, -_it.line_total, -_it.discount);
    IF _it.product_id IS NOT NULL THEN
      UPDATE public.products SET quantity = quantity + _it.quantity WHERE id = _it.product_id;
      INSERT INTO public.stock_movements(user_id, product_id, delta, reason, note, actor_id)
        VALUES (_owner, _it.product_id, _it.quantity, 'refund', _refund_id::text, _uid);
    END IF;
  END LOOP;

  UPDATE public.sales SET status = 'refunded' WHERE id = _sale_id;

  IF _sale.payment_method = 'credit' AND _sale.customer_id IS NOT NULL AND _sale.total > 0 THEN
    INSERT INTO public.customer_credits(user_id, customer_id, sale_id, entry_type, amount, payment_method, note, actor_id)
      VALUES (_owner, _sale.customer_id, _sale_id, 'payment', _sale.total, 'refund', 'Refund reversal', _uid);
  END IF;

  INSERT INTO public.audit_logs(user_id, actor_id, action_type, entity, entity_id, old_value, new_value)
    VALUES (_owner, _uid, 'sale.refund', 'sale', _sale_id,
      jsonb_build_object('status','completed','total',_sale.total),
      jsonb_build_object('status','refunded','refund_id',_refund_id,'reason',_reason));

  RETURN _refund_id;
END $$;

-- Harden adjust_stock
CREATE OR REPLACE FUNCTION public.adjust_stock(
  _product_id uuid, _delta integer, _reason text, _note text DEFAULT NULL
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid := public.current_shop_owner();
  _old_qty integer;
  _new_qty integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_manage_inventory() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  IF _delta = 0 THEN RAISE EXCEPTION 'Delta must be non-zero'; END IF;

  SELECT quantity INTO _old_qty FROM public.products
    WHERE id = _product_id AND user_id = _owner FOR UPDATE;
  IF _old_qty IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;

  _new_qty := _old_qty + _delta;
  IF _new_qty < 0 THEN RAISE EXCEPTION 'Stock cannot go below zero'; END IF;

  UPDATE public.products SET quantity = _new_qty WHERE id = _product_id;

  INSERT INTO public.stock_movements(user_id, product_id, delta, reason, note, actor_id)
    VALUES (_owner, _product_id, _delta, _reason, _note, _uid);

  INSERT INTO public.audit_logs(user_id, actor_id, action_type, entity, entity_id, old_value, new_value)
    VALUES (_owner, _uid, 'stock.adjust', 'product', _product_id,
      jsonb_build_object('quantity', _old_qty),
      jsonb_build_object('quantity', _new_qty, 'delta', _delta, 'reason', _reason));
END $$;

GRANT EXECUTE ON FUNCTION public.checkout_sale(jsonb, text, uuid, numeric, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_sale(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.adjust_stock(uuid, integer, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.next_receipt_no(uuid) TO authenticated;
