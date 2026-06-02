-- uniform_orders / uniform_order_items の RLS（行レベルセキュリティ）を有効化
--
-- 現状: UNRESTRICTED = RLS が無効 → 誰でも全店舗のデータを読み書き可能（セキュリティリスク）
-- 対応: RLS を有効化し、認証済みユーザーは全レコードにアクセス可能なポリシーを追加
--       （より厳密にしたい場合は store_id による絞り込みポリシーに変更してください）
--
-- Supabase SQL Editor でそのまま実行できます

-- ── uniform_orders ───────────────────────────────────────────
ALTER TABLE uniform_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uniform_orders_all" ON uniform_orders;
CREATE POLICY "uniform_orders_all"
  ON uniform_orders
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- ── uniform_order_items ──────────────────────────────────────
ALTER TABLE uniform_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uniform_order_items_all" ON uniform_order_items;
CREATE POLICY "uniform_order_items_all"
  ON uniform_order_items
  FOR ALL
  USING (true)
  WITH CHECK (true);
