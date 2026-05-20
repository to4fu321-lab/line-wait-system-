-- ============================================================
-- LINE Queue Management System - Supabase Schema
-- Supabaseのダッシュボード > SQL Editor で実行してください
-- ============================================================

DROP TABLE IF EXISTS queues CASCADE;
DROP TABLE IF EXISTS stores CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP FUNCTION IF EXISTS get_next_ticket_number(uuid);
DROP FUNCTION IF EXISTS get_next_ticket_number();
DROP FUNCTION IF EXISTS notify_line_user(text, text);
DROP TYPE IF EXISTS queue_status CASCADE;
DROP TYPE IF EXISTS queue_category CASCADE;

CREATE TYPE queue_status   AS ENUM ('waiting', 'calling', 'completed', 'cancelled');
CREATE TYPE queue_category AS ENUM ('fitting', 'pickup', 'other');

-- グループ（複数店舗を束ねる単位）
CREATE TABLE groups (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 店舗
CREATE TABLE stores (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         uuid        REFERENCES groups(id) ON DELETE SET NULL,
  name             text        NOT NULL,
  pin              text        NOT NULL DEFAULT '1234',
  is_open          boolean     NOT NULL DEFAULT false,
  wait_thresholds  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  notice_threshold integer     NOT NULL DEFAULT 3,
  allow_remote     boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- 順番待ち
CREATE TABLE queues (
  id              uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid           NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  ticket_number   int            NOT NULL,
  status          queue_status   NOT NULL DEFAULT 'waiting',
  school_name     text           NOT NULL,
  customer_name   text           NOT NULL,
  child_name      text,
  category        queue_category NOT NULL,
  gender          text           NOT NULL DEFAULT 'other',
  line_user_id    text,
  details         jsonb,
  is_remote       boolean        NOT NULL DEFAULT false,
  checked_in      boolean        NOT NULL DEFAULT false,
  created_at      timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX idx_queues_store_id   ON queues(store_id);
CREATE INDEX idx_queues_status     ON queues(status);
CREATE INDEX idx_queues_created_at ON queues(created_at);
CREATE INDEX idx_queues_ticket_num ON queues(store_id, ticket_number, created_at);

-- 店舗・当日ごとの次の整理番号
CREATE OR REPLACE FUNCTION get_next_ticket_number(p_store_id uuid)
RETURNS int
LANGUAGE plpgsql
AS $$
DECLARE
  next_num int;
BEGIN
  SELECT COALESCE(MAX(ticket_number), 0) + 1
  INTO next_num
  FROM queues
  WHERE store_id = p_store_id
    AND (created_at AT TIME ZONE 'Asia/Tokyo')::date = (NOW() AT TIME ZONE 'Asia/Tokyo')::date;

  RETURN next_num;
END;
$$;

-- Realtime: Database > Replication > queues テーブルにチェックを入れてください

-- ============================================================
-- サンプルデータ（動作確認用）
-- ============================================================
INSERT INTO groups (id, name) VALUES
  ('00000000-0000-0000-0000-000000000001', 'サンプルグループ');

INSERT INTO stores (id, group_id, name, pin) VALUES
  ('00000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '本店',  '1234'),
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', '支店A', '5678');

-- お客様受付URL例:    /<store_id>
-- スタッフ管理URL例:  /<store_id>/admin

-- ※ 既存DBへのカラム追加は sql/migration-add-columns.sql を使用してください
