-- ============================================================
-- RLS 修正マイグレーション
-- 受付切替ボタンが動かない・データが取得できない場合に実行
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

-- stores（受付切替・フィッティング台数・設定読み込みに必要）
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stores_anon_update" ON stores;
CREATE POLICY "stores_anon_update"
  ON stores FOR ALL TO anon USING (true) WITH CHECK (true);

-- groups（店舗グループ情報に必要）
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "groups_anon_all" ON groups;
CREATE POLICY "groups_anon_all"
  ON groups FOR ALL TO anon USING (true) WITH CHECK (true);

-- queues（待ちリスト・呼出・完了に必要）
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "queues_anon_all" ON queues;
CREATE POLICY "queues_anon_all"
  ON queues FOR ALL TO anon USING (true) WITH CHECK (true);

-- customers（顧客情報表示に必要）
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "customers_anon_all" ON customers;
CREATE POLICY "customers_anon_all"
  ON customers FOR ALL TO anon USING (true) WITH CHECK (true);

-- children（お子様情報表示に必要）
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "children_anon_all" ON children;
CREATE POLICY "children_anon_all"
  ON children FOR ALL TO anon USING (true) WITH CHECK (true);
