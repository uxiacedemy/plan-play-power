
-- EXPENSES
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  category text NOT NULL DEFAULT 'general',
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  note text,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expenses TO authenticated;
GRANT ALL ON public.expenses TO service_role;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members read expenses" ON public.expenses FOR SELECT TO authenticated
USING (user_id = public.current_shop_owner());
CREATE POLICY "Managers manage expenses" ON public.expenses FOR ALL TO authenticated
USING (user_id = public.current_shop_owner() AND public.can_manage_inventory())
WITH CHECK (user_id = public.current_shop_owner() AND public.can_manage_inventory());

CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_expenses_user_date ON public.expenses(user_id, expense_date DESC);

-- NOTIFICATIONS
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  meta jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members read notifications" ON public.notifications FOR SELECT TO authenticated
USING (user_id = public.current_shop_owner());
CREATE POLICY "Shop members update notifications" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = public.current_shop_owner())
WITH CHECK (user_id = public.current_shop_owner());

CREATE INDEX idx_notifications_user_read ON public.notifications(user_id, read, created_at DESC);

-- Notification helper
CREATE OR REPLACE FUNCTION public.create_notification(_user_id uuid, _type text, _title text, _body text DEFAULT NULL, _meta jsonb DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _id uuid;
BEGIN
  INSERT INTO public.notifications(user_id, type, title, body, meta)
    VALUES (_user_id, _type, _title, _body, _meta) RETURNING id INTO _id;
  RETURN _id;
END $$;

-- Low-stock trigger on products
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.quantity <= NEW.reorder_level AND (OLD.quantity IS NULL OR OLD.quantity > NEW.reorder_level) THEN
    PERFORM public.create_notification(
      NEW.user_id, 'low_stock',
      'Low stock: ' || NEW.name,
      'Only ' || NEW.quantity || ' ' || NEW.unit || ' left (reorder at ' || NEW.reorder_level || ')',
      jsonb_build_object('product_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_products_low_stock AFTER UPDATE OF quantity ON public.products
FOR EACH ROW EXECUTE FUNCTION public.notify_low_stock();

-- Sale notification
CREATE OR REPLACE FUNCTION public.notify_new_sale()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.create_notification(
    NEW.user_id, 'sale',
    'Sale: ' || NEW.total || ' FCFA',
    'Payment: ' || NEW.payment_method,
    jsonb_build_object('sale_id', NEW.id)
  );
  RETURN NEW;
END $$;
CREATE TRIGGER trg_sales_notify AFTER INSERT ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.notify_new_sale();

-- Profile: add settings columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tax_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS low_stock_threshold int NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS receipt_header text,
  ADD COLUMN IF NOT EXISTS receipt_footer text,
  ADD COLUMN IF NOT EXISTS address text;
