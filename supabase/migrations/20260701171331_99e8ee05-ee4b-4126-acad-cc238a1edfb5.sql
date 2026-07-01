
ALTER FUNCTION public.sales_immutability_guard() SET search_path = public;
ALTER FUNCTION public.sale_items_immutability_guard() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.checkout_sale(jsonb, text, uuid, numeric, numeric, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.void_sale(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.refund_sale(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.adjust_stock(uuid, integer, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.next_receipt_no(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_manager_or_owner() FROM PUBLIC, anon;
