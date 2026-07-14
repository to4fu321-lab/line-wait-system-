-- ============================================================
-- 伝票OCR 第3段: テンプレ駆動の汎用受付 + 項目の意味付け（Phase 1）
--   1. extraction_schemas に scope(見出し/明細) と role(意味役割) を追加
--   2. extraction_templates に target(保存先種別) を追加
--   3. 汎用受付レコード slip_records を新設
--
--   ※ repair_histories は制服お直し特化のため使わず、テンプレ非依存の
--     汎用表を新設する。テニス張替店など任意伝票を1顧客+複数明細で保存できる。
--   冪等: 再実行安全。
-- ============================================================

-- ── 1. extraction_schemas: 項目の意味付け ────────────────────
ALTER TABLE public.extraction_schemas
  ADD COLUMN IF NOT EXISTS scope       text NOT NULL DEFAULT 'item',
  ADD COLUMN IF NOT EXISTS role        text,
  ADD COLUMN IF NOT EXISTS master_kind text;

-- scope: header=伝票共通(顧客名/TEL/日付/合計), item=明細行(品名/本数/金額)
ALTER TABLE public.extraction_schemas DROP CONSTRAINT IF EXISTS extraction_schemas_scope_chk;
ALTER TABLE public.extraction_schemas
  ADD CONSTRAINT extraction_schemas_scope_chk CHECK (scope IN ('header','item'));

-- role: 汎用プロモータが顧客解決・合計計算に使う意味役割（nullは通常項目）
ALTER TABLE public.extraction_schemas DROP CONSTRAINT IF EXISTS extraction_schemas_role_chk;
ALTER TABLE public.extraction_schemas
  ADD CONSTRAINT extraction_schemas_role_chk
  CHECK (role IS NULL OR role IN ('customer_name','customer_tel','date','quantity','unit_price','line_name','note'));

-- master_kind: 紐付け先マスタ（Phase 2で使用。nullは非連動）
ALTER TABLE public.extraction_schemas DROP CONSTRAINT IF EXISTS extraction_schemas_master_kind_chk;
ALTER TABLE public.extraction_schemas
  ADD CONSTRAINT extraction_schemas_master_kind_chk
  CHECK (master_kind IS NULL OR master_kind IN ('repair_item','repair_option','product','repair_vendor','customer'));

-- ── 2. extraction_templates: 保存先種別 ──────────────────────
ALTER TABLE public.extraction_templates
  ADD COLUMN IF NOT EXISTS target text NOT NULL DEFAULT 'reception';
ALTER TABLE public.extraction_templates DROP CONSTRAINT IF EXISTS extraction_templates_target_chk;
ALTER TABLE public.extraction_templates
  ADD CONSTRAINT extraction_templates_target_chk CHECK (target IN ('reception','repair','order'));

-- ── 3. 汎用受付レコード ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.slip_records (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  template_id  uuid        REFERENCES public.extraction_templates(id) ON DELETE SET NULL,
  customer_id  uuid        REFERENCES public.customers(id) ON DELETE SET NULL,
  header       jsonb       NOT NULL DEFAULT '{}'::jsonb,   -- 見出し項目 {field_key: value}
  items        jsonb       NOT NULL DEFAULT '[]'::jsonb,   -- 明細行 [{field_key: value}, ...]
  total_amount integer,                                    -- role=unit_price×quantity の合計
  status       text        NOT NULL DEFAULT 'received'
                          CHECK (status IN ('received','done','delivered')),
  received_date date       NOT NULL DEFAULT CURRENT_DATE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slip_records_store
  ON public.slip_records (store_id, status, received_date DESC);
CREATE INDEX IF NOT EXISTS idx_slip_records_customer
  ON public.slip_records (customer_id);

ALTER TABLE public.slip_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS slip_records_staff_all ON public.slip_records;
CREATE POLICY slip_records_staff_all ON public.slip_records
  FOR ALL TO authenticated
  USING (public.is_staff_of(store_id))
  WITH CHECK (public.is_staff_of(store_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.slip_records TO authenticated;

NOTIFY pgrst, 'reload schema';
