-- ============================================================
-- マイグレーション: 管理機能強化カラム追加
-- Supabase ダッシュボード > SQL Editor で実行してください
-- ============================================================

ALTER TABLE stores ADD COLUMN IF NOT EXISTS features             jsonb NOT NULL DEFAULT '{}';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS welcome_message      text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS notice_text          text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_hours       jsonb;
