
-- stock_movements table
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL,
  note text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.stock_movements TO authenticated;
GRANT ALL ON public.stock_movements TO service_role;

ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop movements read" ON public.stock_movements
  FOR SELECT TO authenticated
  USING (user_id = public.current_shop_owner() AND public.can_manage_inventory());

CREATE POLICY "shop movements insert" ON public.stock_movements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_shop_owner() AND public.can_manage_inventory());

CREATE INDEX stock_movements_product_idx ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX stock_movements_user_idx ON public.stock_movements(user_id, created_at DESC);

-- Constraints on products
ALTER TABLE public.products
  ADD CONSTRAINT products_selling_price_nonneg CHECK (selling_price >= 0),
  ADD CONSTRAINT products_cost_price_nonneg CHECK (cost_price >= 0),
  ADD CONSTRAINT products_quantity_nonneg CHECK (quantity >= 0);

CREATE UNIQUE INDEX products_user_barcode_uniq
  ON public.products(user_id, barcode)
  WHERE barcode IS NOT NULL;

-- adjust_stock function
CREATE OR REPLACE FUNCTION public.adjust_stock(_product_id uuid, _delta integer, _reason text, _note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid := public.current_shop_owner();
  _new_qty integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_manage_inventory() THEN RAISE EXCEPTION 'Forbidden'; END IF;

  UPDATE public.products
    SET quantity = quantity + _delta
    WHERE id = _product_id AND user_id = _owner
    RETURNING quantity INTO _new_qty;

  IF _new_qty IS NULL THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF _new_qty < 0 THEN RAISE EXCEPTION 'Stock cannot go below zero'; END IF;

  INSERT INTO public.stock_movements(user_id, product_id, delta, reason, note, actor_id)
    VALUES (_owner, _product_id, _delta, _reason, _note, _uid);
END $$;

-- Update checkout_sale to log movements
CREATE OR REPLACE FUNCTION public.checkout_sale(_items jsonb, _payment_method text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid := public.current_shop_owner();
  _sale_id uuid;
  _item jsonb;
  _product public.products;
  _qty int;
  _total numeric(12,2) := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'No items'; END IF;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::int;
    SELECT * INTO _product FROM public.products
      WHERE id = (_item->>'product_id')::uuid AND user_id = _owner FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
    IF _product.quantity < _qty THEN RAISE EXCEPTION 'Insufficient stock for %', _product.name; END IF;
    _total := _total + (_product.selling_price * _qty);
  END LOOP;

  INSERT INTO public.sales(user_id, total, payment_method, cashier_id)
    VALUES (_owner, _total, _payment_method, _uid) RETURNING id INTO _sale_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::int;
    SELECT * INTO _product FROM public.products WHERE id = (_item->>'product_id')::uuid AND user_id = _owner;
    INSERT INTO public.sale_items(sale_id, user_id, product_id, name_snapshot, quantity, unit_price, line_total)
      VALUES (_sale_id, _owner, _product.id, _product.name, _qty, _product.selling_price, _product.selling_price * _qty);
    UPDATE public.products SET quantity = quantity - _qty WHERE id = _product.id;
    INSERT INTO public.stock_movements(user_id, product_id, delta, reason, note, actor_id)
      VALUES (_owner, _product.id, -_qty, 'sale', _sale_id::text, _uid);
  END LOOP;

  RETURN _sale_id;
END $$;
