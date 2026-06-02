-- 制服商品に学校紐付け（school_names）カラムを追加
-- 空配列 or NULL の商品は「定番商品（全校共通）」として全顧客に表示される
-- school_names に学校名が設定された商品は、その学校に紐付いたお子様を持つ顧客のみに表示される

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS school_names text[] NOT NULL DEFAULT '{}';

-- インデックス（学校名での絞り込みを高速化）
CREATE INDEX IF NOT EXISTS idx_products_school_names
  ON products USING gin(school_names);

COMMENT ON COLUMN products.school_names IS
  '紐付ける学校名の配列。空配列の場合は定番商品（全校共通）として全顧客に表示される。';
