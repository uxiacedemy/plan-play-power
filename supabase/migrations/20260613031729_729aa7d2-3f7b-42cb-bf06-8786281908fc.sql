-- Phase 4: Product model upgrade, categories, suppliers

CREATE TABLE public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  phone text,
  email text,
  address text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members read suppliers" ON public.suppliers
  FOR SELECT TO authenticated USING (user_id = public.current_shop_owner());
CREATE POLICY "managers manage suppliers" ON public.suppliers
  FOR ALL TO authenticated
  USING (user_id = public.current_shop_owner() AND public.can_manage_inventory())
  WITH CHECK (user_id = public.current_shop_owner() AND public.can_manage_inventory());
CREATE TRIGGER suppliers_updated BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shop members read categories" ON public.categories
  FOR SELECT TO authenticated USING (user_id = public.current_shop_owner());
CREATE POLICY "managers manage categories" ON public.categories
  FOR ALL TO authenticated
  USING (user_id = public.current_shop_owner() AND public.can_manage_inventory())
  WITH CHECK (user_id = public.current_shop_owner() AND public.can_manage_inventory());

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS cost_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS reorder_level integer NOT NULL DEFAULT 5 CHECK (reorder_level >= 0),
  ADD COLUMN IF NOT EXISTS unit text NOT NULL DEFAULT 'pcs',
  ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  ADD COLUMN IF NOT EXISTS image_url text;

INSERT INTO public.categories (user_id, name)
SELECT DISTINCT user_id, category FROM public.products
WHERE category IS NOT NULL AND category <> ''
ON CONFLICT (user_id, name) DO NOTHING;

UPDATE public.products p
  SET category_id = c.id
  FROM public.categories c
  WHERE c.user_id = p.user_id AND c.name = p.category AND p.category_id IS NULL;