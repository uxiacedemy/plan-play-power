
-- CUSTOMERS
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  loyalty_points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members read customers" ON public.customers FOR SELECT TO authenticated
  USING (user_id = public.current_shop_owner());
CREATE POLICY "shop members manage customers" ON public.customers FOR ALL TO authenticated
  USING (user_id = public.current_shop_owner())
  WITH CHECK (user_id = public.current_shop_owner());
CREATE TRIGGER customers_set_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX customers_user_id_idx ON public.customers(user_id);

-- CUSTOMER CREDITS LEDGER
CREATE TABLE public.customer_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id uuid,
  entry_type text NOT NULL CHECK (entry_type IN ('charge','payment')),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  payment_method text,
  note text,
  actor_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_credits TO authenticated;
GRANT ALL ON public.customer_credits TO service_role;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members read credits" ON public.customer_credits FOR SELECT TO authenticated
  USING (user_id = public.current_shop_owner());
CREATE POLICY "shop members manage credits" ON public.customer_credits FOR ALL TO authenticated
  USING (user_id = public.current_shop_owner())
  WITH CHECK (user_id = public.current_shop_owner());
CREATE INDEX customer_credits_customer_idx ON public.customer_credits(customer_id);
CREATE INDEX customer_credits_user_idx ON public.customer_credits(user_id);

-- EXTEND SALES
ALTER TABLE public.sales
  ADD COLUMN customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN subtotal numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN discount numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN tax_total numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN notes text;

-- EXTEND SALE_ITEMS
ALTER TABLE public.sale_items
  ADD COLUMN discount numeric(12,2) NOT NULL DEFAULT 0;

-- UPDATED CHECKOUT FUNCTION
CREATE OR REPLACE FUNCTION public.checkout_sale(
  _items jsonb,
  _payment_method text,
  _customer_id uuid DEFAULT NULL,
  _discount numeric DEFAULT 0,
  _tax_total numeric DEFAULT 0,
  _notes text DEFAULT NULL
)
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
  _line_disc numeric;
  _line_total numeric;
  _subtotal numeric(12,2) := 0;
  _total numeric(12,2);
  _points int;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'No items'; END IF;

  -- Validate customer ownership
  IF _customer_id IS NOT NULL THEN
    PERFORM 1 FROM public.customers WHERE id = _customer_id AND user_id = _owner;
    IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;
  END IF;

  -- Pre-validate stock + compute subtotal
  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::int;
    _line_disc := COALESCE((_item->>'discount')::numeric, 0);
    SELECT * INTO _product FROM public.products
      WHERE id = (_item->>'product_id')::uuid AND user_id = _owner FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
    IF _product.quantity < _qty THEN RAISE EXCEPTION 'Insufficient stock for %', _product.name; END IF;
    _line_total := (_product.selling_price * _qty) - _line_disc;
    IF _line_total < 0 THEN _line_total := 0; END IF;
    _subtotal := _subtotal + _line_total;
  END LOOP;

  _total := _subtotal - COALESCE(_discount, 0) + COALESCE(_tax_total, 0);
  IF _total < 0 THEN _total := 0; END IF;

  INSERT INTO public.sales(user_id, total, payment_method, cashier_id, customer_id, subtotal, discount, tax_total, notes)
    VALUES (_owner, _total, _payment_method, _uid, _customer_id, _subtotal, COALESCE(_discount,0), COALESCE(_tax_total,0), _notes)
    RETURNING id INTO _sale_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_item->>'quantity')::int;
    _line_disc := COALESCE((_item->>'discount')::numeric, 0);
    SELECT * INTO _product FROM public.products WHERE id = (_item->>'product_id')::uuid AND user_id = _owner;
    _line_total := (_product.selling_price * _qty) - _line_disc;
    IF _line_total < 0 THEN _line_total := 0; END IF;
    INSERT INTO public.sale_items(sale_id, user_id, product_id, name_snapshot, quantity, unit_price, line_total, discount)
      VALUES (_sale_id, _owner, _product.id, _product.name, _qty, _product.selling_price, _line_total, _line_disc);
    UPDATE public.products SET quantity = quantity - _qty WHERE id = _product.id;
    INSERT INTO public.stock_movements(user_id, product_id, delta, reason, note, actor_id)
      VALUES (_owner, _product.id, -_qty, 'sale', _sale_id::text, _uid);
  END LOOP;

  -- Credit sale → ledger charge
  IF _payment_method = 'credit' AND _customer_id IS NOT NULL AND _total > 0 THEN
    INSERT INTO public.customer_credits(user_id, customer_id, sale_id, entry_type, amount, payment_method, note, actor_id)
      VALUES (_owner, _customer_id, _sale_id, 'charge', _total, 'credit', 'Sale on credit', _uid);
  END IF;

  -- Loyalty points: 1 point per 1000 CFA
  IF _customer_id IS NOT NULL AND _total > 0 THEN
    _points := floor(_total / 1000)::int;
    IF _points > 0 THEN
      UPDATE public.customers SET loyalty_points = loyalty_points + _points WHERE id = _customer_id;
    END IF;
  END IF;

  RETURN _sale_id;
END $$;

-- RECORD PAYMENT (debt repayment)
CREATE OR REPLACE FUNCTION public.record_customer_payment(
  _customer_id uuid,
  _amount numeric,
  _payment_method text,
  _note text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid := public.current_shop_owner();
  _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;
  PERFORM 1 FROM public.customers WHERE id = _customer_id AND user_id = _owner;
  IF NOT FOUND THEN RAISE EXCEPTION 'Customer not found'; END IF;

  INSERT INTO public.customer_credits(user_id, customer_id, entry_type, amount, payment_method, note, actor_id)
    VALUES (_owner, _customer_id, 'payment', _amount, _payment_method, _note, _uid)
    RETURNING id INTO _id;
  RETURN _id;
END $$;
