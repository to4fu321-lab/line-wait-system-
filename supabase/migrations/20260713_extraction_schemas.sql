-- ============================================================
-- OCR抽出項目の店舗別対応（マルチテナント抽出スキーマ / Configuration as Data）
--   伝票OCRの読み取り項目をコードのハードコードからDB定義へ移す。
--   店舗(テナント)ごとに動的にプロンプト／出力スキーマを組み立てるための定義表。
--
--   ※ このシステムのテナント単位は `stores`（id uuid PK）。独立した tenants テーブルは
--     存在しないため、tenant_id は stores(id) を参照する store_id として実装する。
--     店舗分離は既存テーブルと同じ is_staff_of(store_id) 方式の RLS で行う。
--
--   冪等: 再実行安全。
-- ============================================================

CREATE TABLE IF NOT EXISTS public.extraction_schemas (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  field_key   text        NOT NULL,                       -- 例: "tension"（英数キー。プロンプト/出力のプロパティ名）
  field_label text        NOT NULL,                       -- 例: "ガットテンション"（人間向けラベル）
  field_type  text        NOT NULL DEFAULT 'text'
                          CHECK (field_type IN ('text','number','date')),
  description text,                                        -- Claudeへの読み取りヒント（任意）
  sort_order  int         NOT NULL DEFAULT 0,             -- 表示順・プロンプト内の並び順
  is_required boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, field_key)
);

CREATE INDEX IF NOT EXISTS idx_extraction_schemas_store_sort
  ON public.extraction_schemas (store_id, sort_order);

-- ── RLS: 自店舗(テナント)のスタッフのみアクセス可（既存 repair_histories 等と同方針）──
ALTER TABLE public.extraction_schemas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS extraction_schemas_staff_all ON public.extraction_schemas;
CREATE POLICY extraction_schemas_staff_all ON public.extraction_schemas
  FOR ALL TO authenticated
  USING (public.is_staff_of(store_id))
  WITH CHECK (public.is_staff_of(store_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.extraction_schemas TO authenticated;

-- PostgREST スキーマキャッシュを再読込
NOTIFY pgrst, 'reload schema';
