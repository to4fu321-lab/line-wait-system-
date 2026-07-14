-- ============================================================
-- 伝票OCRの店舗別最適化 第2段: テンプレート階層の追加
--   店舗 → 伝票種別(受付/お直し/加工/購入承り…) → 項目 の3階層にする。
--   これにより「1店舗の中で伝票種別ごとに読み取り項目を最適化」できる。
--
--   stores（テナント）
--     └─ extraction_templates（伝票種別）★新設
--           └─ extraction_schemas（項目）※template_id を追加
--
--   既存の extraction_schemas 行は、店舗ごとの既定テンプレ(key='default')へ移行する。
--   冪等: 再実行安全。
-- ============================================================

-- ── 1. 伝票種別テンプレート ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.extraction_templates (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  key         text        NOT NULL,                       -- 店舗内で一意の識別子（例: 'repair'）
  label       text        NOT NULL,                       -- 表示名（例: 'お直し伝票'）
  description text,                                        -- 用途メモ・AIへの伝票種別ヒント
  sort_order  int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, key)
);

CREATE INDEX IF NOT EXISTS idx_extraction_templates_store
  ON public.extraction_templates (store_id, sort_order);

ALTER TABLE public.extraction_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS extraction_templates_staff_all ON public.extraction_templates;
CREATE POLICY extraction_templates_staff_all ON public.extraction_templates
  FOR ALL TO authenticated
  USING (public.is_staff_of(store_id))
  WITH CHECK (public.is_staff_of(store_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extraction_templates TO authenticated;

-- ── 2. extraction_schemas に template_id を追加 ──────────────
--   まず NULL 許可で追加 → 既存行を既定テンプレへ移行 → NOT NULL 化
ALTER TABLE public.extraction_schemas
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.extraction_templates(id) ON DELETE CASCADE;

-- 既存項目を持つ店舗ごとに既定テンプレ(受付伝票)を作成
INSERT INTO public.extraction_templates (store_id, key, label, sort_order)
SELECT DISTINCT es.store_id, 'default', '受付伝票', 0
FROM public.extraction_schemas es
WHERE es.template_id IS NULL
ON CONFLICT (store_id, key) DO NOTHING;

-- 既存項目を既定テンプレへ紐付け
UPDATE public.extraction_schemas es
SET template_id = t.id
FROM public.extraction_templates t
WHERE es.template_id IS NULL
  AND t.store_id = es.store_id
  AND t.key = 'default';

-- 以後 template_id は必須
ALTER TABLE public.extraction_schemas ALTER COLUMN template_id SET NOT NULL;

-- ── 3. 一意制約の張り替え: (store_id, field_key) → (template_id, field_key) ──
--   同一店舗でも伝票種別が違えば同じ field_key を使えるようにする
ALTER TABLE public.extraction_schemas
  DROP CONSTRAINT IF EXISTS extraction_schemas_store_id_field_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_extraction_schemas_template_field
  ON public.extraction_schemas (template_id, field_key);
CREATE INDEX IF NOT EXISTS idx_extraction_schemas_template_sort
  ON public.extraction_schemas (template_id, sort_order);

NOTIFY pgrst, 'reload schema';
