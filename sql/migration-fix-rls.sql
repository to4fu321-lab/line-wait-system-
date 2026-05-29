-- ============================================================
-- RLS 修正マイグレーション（groups・queues・stores）
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE queues ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_anon_all" ON groups;
CREATE POLICY "groups_anon_all"
  ON groups FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "stores_anon_update" ON stores;
CREATE POLICY "stores_anon_update"
  ON stores FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "queues_anon_all" ON queues;
CREATE POLICY "queues_anon_all"
  ON queues FOR ALL TO anon USING (true) WITH CHECK (true);
