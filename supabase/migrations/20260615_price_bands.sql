-- ============================================================
-- 価格帯(プライスバンド)モデルの新設
--   背景: 学生服はサイズ範囲で価格が変わる(例 150〜180=¥9,000 / 185・180B=¥9,500)。
--         従来は prices に「1サイズ=1行」で手入力 → 帯入力ができず面倒。
--
--   方針: price_bands を「編集の正(ソース)」とし、保存時に既存 prices(サイズ別)へ
--         展開(マテリアライズ)する。これで採寸/EC/API など価格を読む側は無改修。
--
--   バンドの意味:
--     from_item_id .. to_item_id … size_set_items を sort_order で範囲指定(両端含む)
--     from_item_id = NULL          … サイズセット無し商品の共通価格(1点)
--     is_eo = true                 … 別寸(EO)価格。サイズ範囲を持たない
-- ============================================================

CREATE OR REPLACE FUNCTION handle_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS price_bands (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      text NOT NULL,
  school_id     uuid NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  product_id    uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  from_item_id  uuid REFERENCES size_set_items(id) ON DELETE CASCADE,
  to_item_id    uuid REFERENCES size_set_items(id) ON DELETE CASCADE,
  price_tax_in  integer NOT NULL,
  price_tax_out integer,
  cost          integer,
  is_eo         boolean NOT NULL DEFAULT false,
  label         text,
  sort_order    integer NOT NULL DEFAULT 0,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_price_bands_lookup ON price_bands(school_id, product_id);
CREATE INDEX IF NOT EXISTS idx_price_bands_store  ON price_bands(store_id);
COMMENT ON TABLE price_bands IS '価格帯マスタ(サイズ範囲ごとの価格。保存時に prices へ展開)';

DROP TRIGGER IF EXISTS trg_price_bands_updated_at ON public.price_bands;
CREATE TRIGGER trg_price_bands_updated_at
  BEFORE UPDATE ON public.price_bands
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

ALTER TABLE public.price_bands ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "price_bands_all" ON public.price_bands;
CREATE POLICY "price_bands_all" ON public.price_bands
  FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON price_bands TO anon, authenticated;

NOTIFY pgrst, 'reload schema';