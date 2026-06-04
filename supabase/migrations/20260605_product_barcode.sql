-- ============================================================
-- 商品マスタ: バーコード・QRコードフィールド追加
-- Supabase SQL Editor で実行してください
-- ============================================================

ALTER TABLE school_products
  ADD COLUMN IF NOT EXISTS barcode text;

-- バーコード検索用インデックス
CREATE INDEX IF NOT EXISTS idx_school_products_barcode
  ON school_products(store_id, barcode)
  WHERE barcode IS NOT NULL;

COMMENT ON COLUMN school_products.barcode IS 'JAN/EAN/QRコード・バーコード値。商品スキャンで即座に商品を特定するために使用';
