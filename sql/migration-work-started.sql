-- ============================================================
-- マイグレーション: お直し作業進捗カラム追加
-- Supabase ダッシュボード > SQL Editor で実行してください
-- ============================================================

ALTER TABLE repair_histories
  ADD COLUMN IF NOT EXISTS work_started boolean NOT NULL DEFAULT false;
