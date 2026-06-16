
-- 1) Audit log
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  actor_id uuid,
  action_type text NOT NULL,
  entity text,
  entity_id uuid,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Shop owners view own audit logs" ON public.audit_logs
  FOR SELECT TO authenticated USING (user_id = public.current_shop_owner());
CREATE POLICY "System inserts audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = public.current_shop_owner());

-- 2) Profile additions
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS opening_float numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS business_reg_no text,
  ADD COLUMN IF NOT EXISTS vat_enabled boolean NOT NULL DEFAULT false;

-- 3) Voided sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS voided boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS void_reason text;

-- 4) void_sale RPC
CREATE OR REPLACE FUNCTION public.void_sale(_sale_id uuid, _reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _owner uuid := public.current_shop_owner();
  _sale public.sales;
  _it public.sale_items;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.can_manage_inventory() THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO _sale FROM public.sales WHERE id = _sale_id AND user_id = _owner FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale not found'; END IF;
  IF _sale.voided THEN RAISE EXCEPTION 'Already voided'; END IF;
  IF _sale.created_at < (now() - interval '24 hours') THEN
    RAISE EXCEPTION 'Sales can only be voided within 24 hours';
  END IF;

  FOR _it IN SELECT * FROM public.sale_items WHERE sale_id = _sale_id LOOP
    UPDATE public.products SET quantity = quantity + _it.quantity WHERE id = _it.product_id;
    INSERT INTO public.stock_movements(user_id, product_id, delta, reason, note, actor_id)
      VALUES (_owner, _it.product_id, _it.quantity, 'void', _sale_id::text, _uid);
  END LOOP;

  UPDATE public.sales SET voided = true, voided_at = now(), void_reason = _reason WHERE id = _sale_id;

  INSERT INTO public.audit_logs(user_id, actor_id, action_type, entity, entity_id, new_value)
    VALUES (_owner, _uid, 'sale.void', 'sale', _sale_id, jsonb_build_object('reason', _reason, 'total', _sale.total));
END $$;

-- 5) Performance indexes
CREATE INDEX IF NOT EXISTS idx_sales_user_created ON public.sales(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_products_user ON public.products(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_user ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON public.stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, created_at DESC);
