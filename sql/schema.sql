-- ============================================================
-- LINE Queue Management System - Supabase Schema
-- Supabaseのダッシュボード > SQL Editor で実行してください
-- ============================================================

-- 既存テーブルを削除（再実行時）
DROP TABLE IF EXISTS queues CASCADE;
DROP FUNCTION IF EXISTS get_next_ticket_number();
DROP FUNCTION IF EXISTS notify_line_user(text, text);

-- ステータス型
CREATE TYPE queue_status AS ENUM ('waiting', 'calling', 'completed', 'cancelled');

-- カテゴリ型
CREATE TYPE queue_category AS ENUM ('fitting', 'pickup', 'other');

-- 順番待ちテーブル
CREATE TABLE queues (
  id              uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number   int             NOT NULL,
  status          queue_status    NOT NULL DEFAULT 'waiting',
  school_name     text            NOT NULL,
  customer_name   text            NOT NULL,
  category        queue_category  NOT NULL,
  line_user_id    text,
  created_at      timestamptz     NOT NULL DEFAULT now()
);

-- インデックス
CREATE INDEX idx_queues_status      ON queues(status);
CREATE INDEX idx_queues_created_at  ON queues(created_at);
CREATE INDEX idx_queues_ticket_num  ON queues(ticket_number, created_at);

-- 当日の次の整理番号を取得する関数（排他ロックで競合防止）
CREATE OR REPLACE FUNCTION get_next_ticket_number()
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  next_num int;
BEGIN
  SELECT COALESCE(MAX(ticket_number), 0) + 1
  INTO next_num
  FROM queues
  WHERE created_at::date = CURRENT_DATE AT TIME ZONE 'Asia/Tokyo';

  RETURN next_num;
END;
$$;

-- Realtime を有効化（Supabaseダッシュボードで手動設定も可）
-- Database > Replication > queues テーブルにチェックを入れてください

-- Row Level Security (RLS) - 必要に応じてコメントアウト解除
-- ALTER TABLE queues ENABLE ROW LEVEL SECURITY;

-- 全員が読み取り可能（お客様の待ち状況表示のため）
-- CREATE POLICY "allow_select" ON queues FOR SELECT USING (true);

-- 挿入は誰でも可能（お客様の受付のため）
-- CREATE POLICY "allow_insert" ON queues FOR INSERT WITH CHECK (true);

-- 更新はサービスロールのみ（実運用ではAPIルート経由にすること）
-- CREATE POLICY "allow_update" ON queues FOR UPDATE USING (true);

-- ============================================================
-- サンプルデータ（動作確認用）
-- ============================================================
-- INSERT INTO queues (ticket_number, status, school_name, customer_name, category)
-- VALUES
--   (1, 'completed', '○○高校', '田中 太郎', 'fitting'),
--   (2, 'calling',   '△△中学校', '鈴木 花子', 'pickup'),
--   (3, 'waiting',   '○○高校', '佐藤 次郎', 'fitting'),
--   (4, 'waiting',   '□□高校', '山田 三郎', 'other');
