-- ============================================================
-- store_id 型統一マイグレーション（text → uuid）
-- 実行場所: Supabase SQL Editor
-- 目的: 全テーブルの store_id を uuid 型に統一する
-- ============================================================

-- ① 現状確認（実行して型を確認できる）
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name = 'store_id'
  AND table_schema = 'public'
ORDER BY table_name;

-- ============================================================
-- ② 統一マイグレーション（上の確認後にこちらを実行）
-- text → uuid に変換。既存データは USING 句で自動キャスト。
-- ============================================================

ALTER TABLE schools
  ALTER COLUMN store_id TYPE uuid USING store_id::uuid;

ALTER TABLE school_products
  ALTER COLUMN store_id TYPE uuid USING store_id::uuid;

ALTER TABLE school_product_variants
  ALTER COLUMN store_id TYPE uuid USING store_id::uuid;

ALTER TABLE staff
  ALTER COLUMN store_id TYPE uuid USING store_id::uuid;

-- queues が text の場合のみ実行（上の確認クエリで text だったら）
-- ALTER TABLE queues
--   ALTER COLUMN store_id TYPE uuid USING store_id::uuid;

-- repair_histories が text の場合のみ実行
-- ALTER TABLE repair_histories
--   ALTER COLUMN store_id TYPE uuid USING store_id::uuid;

-- purchase_orders が text の場合のみ実行
-- ALTER TABLE purchase_orders
--   ALTER COLUMN store_id TYPE uuid USING store_id::uuid;

-- ③ 確認（マイグレーション後に再実行して全部 uuid になったか確認）
SELECT
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name = 'store_id'
  AND table_schema = 'public'
ORDER BY table_name;
