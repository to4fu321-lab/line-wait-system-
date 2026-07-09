-- ============================================================
-- お直し 外注戻り検品 マイグレーション
-- Supabase SQL Editor で実行してください
-- ============================================================

ALTER TABLE repair_histories
  ADD COLUMN IF NOT EXISTS inspected_at timestamptz;

COMMENT ON COLUMN repair_histories.inspected_at IS '外注品の検品完了日時（外注戻り→検品OK確認時に記録）';
