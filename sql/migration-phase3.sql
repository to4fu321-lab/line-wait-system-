-- ============================================================
-- Phase 3: UX完全統合 — スキーマ対応
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

-- 1. queues.school_name を NULL 許容に変更（即時整理券発行対応）
ALTER TABLE queues ALTER COLUMN school_name DROP NOT NULL;

-- 2. queues.category にデフォルト値を設定
ALTER TABLE queues ALTER COLUMN category SET DEFAULT 'other';

-- 3. customers に保護者ふりがなカラムを追加
ALTER TABLE customers ADD COLUMN IF NOT EXISTS parent_kana text;
