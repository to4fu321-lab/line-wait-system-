-- ============================================================
-- お直し加工業者（外注先）マスタ
--   受付モーダルでワンタップ選択し、repair_histories.vendor_name に名称を保存。
--   RLS は既存規約に合わせ全許可（テナント分離は store_id クエリで担保）。
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'extensions'
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE TABLE IF NOT EXISTS public.repair_vendors (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id    uuid NOT NULL,
  name        text NOT NULL,
  kana        text,
  tel         text,
  note        text,
  sort_order  integer DEFAULT 0,
  active      boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_repair_vendors_store ON public.repair_vendors(store_id, sort_order);
COMMENT ON TABLE public.repair_vendors IS 'お直し加工業者（外注先）マスタ。受付でワンタップ選択';

ALTER TABLE public.repair_vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "repair_vendors_all" ON public.repair_vendors;
CREATE POLICY "repair_vendors_all" ON public.repair_vendors FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_repair_vendors_updated_at ON public.repair_vendors;
CREATE TRIGGER trg_repair_vendors_updated_at BEFORE UPDATE ON public.repair_vendors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

NOTIFY pgrst, 'reload schema';
