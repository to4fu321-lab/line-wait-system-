-- ============================================================
-- お直し料金マスタ 2階層化 + LINE公式アカウントID
-- Supabase SQL Editor で実行してください
-- ============================================================

-- ── お直しアイテムカテゴリ（親：品名カテゴリ） ──────────────────
CREATE TABLE IF NOT EXISTS repair_item_categories (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id    text NOT NULL,
  name        text NOT NULL,
  sort_order  integer DEFAULT 0,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repair_item_categories_store ON repair_item_categories(store_id);
COMMENT ON TABLE repair_item_categories IS 'お直し対象アイテムカテゴリ（例：詰め襟、ブレザー、スラックス）';

-- ── 既存 repair_price_presets に category_id FK 追加 ────────────
ALTER TABLE repair_price_presets
  ADD COLUMN IF NOT EXISTS category_id uuid
    REFERENCES repair_item_categories(id) ON DELETE SET NULL;

COMMENT ON COLUMN repair_price_presets.category_id IS 'repair_item_categories.id への外部キー（null = カテゴリ未分類）';

-- ── stores に LINE公式アカウントID を追加 ───────────────────────
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS line_official_id text;

COMMENT ON COLUMN stores.line_official_id IS 'LINE公式アカウントID（例: @abc1234d）。QRコード表示に使用';
