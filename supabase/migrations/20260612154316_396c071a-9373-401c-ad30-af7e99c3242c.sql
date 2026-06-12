
-- 1. shop_members
CREATE TABLE public.shop_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  member_id uuid NOT NULL UNIQUE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_members TO authenticated;
GRANT ALL ON public.shop_members TO service_role;

ALTER TABLE public.shop_members ENABLE ROW LEVEL SECURITY;

-- Owners read/manage their staff; members can read their own membership row
CREATE POLICY "owner manages shop members" ON public.shop_members
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "member reads own row" ON public.shop_members
  FOR SELECT TO authenticated
  USING (member_id = auth.uid());

-- 2. cashier_id on sales
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS cashier_id uuid;

-- 3. Security definer helpers
CREATE OR REPLACE FUNCTION public.current_shop_owner()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT owner_id FROM public.shop_members WHERE member_id = auth.uid()),
    auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT role FROM public.shop_members WHERE member_id = auth.uid()),
    'owner'::public.app_role
  )
$$;

CREATE OR REPLACE FUNCTION public.can_manage_inventory()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() IN ('owner'::public.app_role, 'manager'::public.app_role)
$$;

-- 4. Replace policies on products / sales / sale_items
DROP POLICY IF EXISTS "own products" ON public.products;
DROP POLICY IF EXISTS "own sales" ON public.sales;
DROP POLICY IF EXISTS "own sale items" ON public.sale_items;

CREATE POLICY "shop products read" ON public.products
  FOR SELECT TO authenticated
  USING (user_id = public.current_shop_owner());

CREATE POLICY "shop products write" ON public.products
  FOR ALL TO authenticated
  USING (user_id = public.current_shop_owner() AND public.can_manage_inventory())
  WITH CHECK (user_id = public.current_shop_owner() AND public.can_manage_inventory());

CREATE POLICY "shop sales read" ON public.sales
  FOR SELECT TO authenticated
  USING (user_id = public.current_shop_owner());

CREATE POLICY "shop sales insert" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_shop_owner());

CREATE POLICY "shop sale_items read" ON public.sale_items
  FOR SELECT TO authenticated
  USING (user_id = public.current_shop_owner());

CREATE POLICY "shop sale_items insert" ON public.sale_items
  FOR INSERT TO authenticated
  WITH CHECK (user_id = public.current_shop_owner());

-- 5. Update checkout_sale to use shop owner + record cashier
CREATE OR REPLACE FUNCTION public.checkout_sale(_items jsonb, _payment_method text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $function$
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
  END LOOP;

  RETURN _sale_id;
END $function$;

-- 6. Skip auto owner-role for invited users (they get their role via shop_members)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, shop_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'shop_name','My Shop'));
  IF COALESCE(NEW.raw_user_meta_data->>'invited', 'false') <> 'true' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'owner');
  END IF;
  RETURN NEW;
END $$;
