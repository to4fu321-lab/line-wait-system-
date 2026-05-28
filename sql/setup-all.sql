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
-- ============================================================
-- マイグレーション: 不足カラムの追加
-- 既存データを消さずに実行できます
-- Supabase ダッシュボード > SQL Editor で実行してください
-- ============================================================

-- stores テーブル
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_open          boolean     NOT NULL DEFAULT false;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS wait_thresholds  jsonb       NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS notice_threshold integer     NOT NULL DEFAULT 3;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS allow_remote     boolean     NOT NULL DEFAULT false;

-- queues テーブル
ALTER TABLE queues ADD COLUMN IF NOT EXISTS child_name  text;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS gender      text NOT NULL DEFAULT 'other';
ALTER TABLE queues ADD COLUMN IF NOT EXISTS details     jsonb;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS is_remote   boolean NOT NULL DEFAULT false;
ALTER TABLE queues ADD COLUMN IF NOT EXISTS checked_in  boolean NOT NULL DEFAULT false;

-- stores の更新を anon ロールに許可（is_open 切り替えに必要）
DO $$ BEGIN
  CREATE POLICY "stores_anon_update" ON stores
    FOR UPDATE TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- queues の INSERT/UPDATE/SELECT を anon ロールに許可
DO $$ BEGIN
  CREATE POLICY "queues_anon_all" ON queues
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- ============================================================
-- CRM・お直し履歴管理 マイグレーション
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

-- 顧客マスタ
CREATE TABLE IF NOT EXISTS customers (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  kana          text,                        -- フリガナ（任意、検索性向上）
  tel           text,                        -- 電話番号
  line_user_id  text,                        -- LINE連携ID（通知送信用）
  notes         text,                        -- 顧客メモ
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- 同一店舗内で同一電話番号の重複を防ぐ（tel が NULL の場合は除外）
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_store_tel
  ON customers(store_id, tel) WHERE tel IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_customers_store_id   ON customers(store_id);
CREATE INDEX IF NOT EXISTS idx_customers_line       ON customers(store_id, line_user_id);
CREATE INDEX IF NOT EXISTS idx_customers_name       ON customers(store_id, name);

-- お直し履歴
CREATE TABLE IF NOT EXISTS repair_histories (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id     uuid        NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  slip_number     text,                      -- 伝票番号（手書き票との照合用）
  item_name       text        NOT NULL,      -- 商品名: ○○高校スラックス
  content         text        NOT NULL,      -- お直し内容: 裾上げ5cm / ウエスト出し
  status          text        NOT NULL DEFAULT 'received'
                              CHECK (status IN ('received', 'completed', 'delivered')),
                              -- received  = 預かり中
                              -- completed = お直し完了（LINE通知済み）
                              -- delivered = お渡し済み
  received_date   date        NOT NULL DEFAULT CURRENT_DATE,
  completed_date  date,                      -- 完了日（status=completed になった日）
  delivered_date  date,                      -- 受渡日（status=delivered になった日）
  price           integer,                   -- 金額（円）
  notes           text,                      -- スタッフメモ
  notified        boolean     NOT NULL DEFAULT false, -- LINE通知送信済みフラグ
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repair_store_id    ON repair_histories(store_id);
CREATE INDEX IF NOT EXISTS idx_repair_customer_id ON repair_histories(customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_status      ON repair_histories(store_id, status);
CREATE INDEX IF NOT EXISTS idx_repair_received    ON repair_histories(store_id, received_date DESC);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_customers_updated_at     ON customers;
DROP TRIGGER IF EXISTS set_repair_histories_updated_at ON repair_histories;

CREATE TRIGGER set_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_repair_histories_updated_at
  BEFORE UPDATE ON repair_histories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS（Row Level Security）ポリシー
ALTER TABLE customers        ENABLE ROW LEVEL SECURITY;
ALTER TABLE repair_histories ENABLE ROW LEVEL SECURITY;

-- anon キーで全操作を許可（既存テーブルと同じ設計方針）
DROP POLICY IF EXISTS "anon all customers"        ON customers;
DROP POLICY IF EXISTS "anon all repair_histories" ON repair_histories;

CREATE POLICY "anon all customers"
  ON customers FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE POLICY "anon all repair_histories"
  ON repair_histories FOR ALL TO anon USING (true) WITH CHECK (true);
-- customers テーブルに保護者名を追加
ALTER TABLE customers ADD COLUMN IF NOT EXISTS parent_name text;

-- queues テーブルに保護者フリガナを追加
ALTER TABLE queues ADD COLUMN IF NOT EXISTS customer_kana text;
-- お子様テーブル
CREATE TABLE IF NOT EXISTS children (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  store_id    uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name        text NOT NULL,
  kana        text,
  school_name text,
  grade       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION update_children_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_children_updated_at ON children;
CREATE TRIGGER trg_children_updated_at
  BEFORE UPDATE ON children FOR EACH ROW
  EXECUTE FUNCTION update_children_updated_at();

ALTER TABLE children ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "children_all_anon" ON children;
CREATE POLICY "children_all_anon" ON children FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "children_all_authenticated" ON children;
CREATE POLICY "children_all_authenticated" ON children FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- child_id columns
ALTER TABLE queues           ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES children(id);
ALTER TABLE repair_histories ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES children(id);
ALTER TABLE purchase_orders  ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES children(id);

-- Migrate existing customers: create child records from existing name/kana/school_name
INSERT INTO children (customer_id, store_id, name, kana, school_name)
SELECT id, store_id, name, kana, school_name
FROM customers
WHERE name IS NOT NULL AND name NOT IN ('未登録', '')
AND NOT EXISTS (SELECT 1 FROM children ch WHERE ch.customer_id = customers.id);

-- Update customers: if parent_name was set, make that the main name
UPDATE customers
SET name = parent_name, kana = COALESCE(parent_kana, kana)
WHERE parent_name IS NOT NULL AND parent_name != '';
-- 追加購入（発注管理）テーブル
CREATE TABLE IF NOT EXISTS purchase_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       uuid NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id    uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  item_name      text NOT NULL,
  notes          text,
  status         text NOT NULL DEFAULT 'ordered'
                   CHECK (status IN ('ordered', 'arrived', 'delivered')),
  price          integer,
  ordered_date   date NOT NULL DEFAULT CURRENT_DATE,
  arrived_date   date,
  delivered_date date,
  notified       boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_purchase_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_purchase_orders_updated_at ON purchase_orders;
CREATE TRIGGER trg_purchase_orders_updated_at
  BEFORE UPDATE ON purchase_orders
  FOR EACH ROW EXECUTE FUNCTION update_purchase_orders_updated_at();

-- RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "purchase_orders_all_anon" ON purchase_orders;
CREATE POLICY "purchase_orders_all_anon"
  ON purchase_orders FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "purchase_orders_all_authenticated" ON purchase_orders;
CREATE POLICY "purchase_orders_all_authenticated"
  ON purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Phase 2: queues に customer_id (外部キー) を追加
ALTER TABLE queues ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);

-- 既存データはNULL（過去の受付分）。今後の受付には入る。
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
-- ============================================================
-- customers テーブルに学校名・性別・カテゴリを追加
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

ALTER TABLE customers ADD COLUMN IF NOT EXISTS school_name text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS gender      text;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS category    text;

-- トリガー関数を更新（学校名・性別・カテゴリも同期）
CREATE OR REPLACE FUNCTION sync_queue_to_customer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.line_user_id IS NOT NULL THEN
    BEGIN
      IF EXISTS (
        SELECT 1 FROM customers
        WHERE store_id = NEW.store_id AND line_user_id = NEW.line_user_id
      ) THEN
        UPDATE customers
        SET name        = NEW.customer_name,
            school_name = NEW.school_name,
            gender      = NEW.gender,
            category    = NEW.category,
            updated_at  = now()
        WHERE store_id = NEW.store_id AND line_user_id = NEW.line_user_id;
      ELSE
        INSERT INTO customers (store_id, name, line_user_id, school_name, gender, category)
        VALUES (NEW.store_id, NEW.customer_name, NEW.line_user_id, NEW.school_name, NEW.gender, NEW.category);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;
-- 顧客の論理削除カラム
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers (deleted_at);
-- ============================================================
-- CRM LINE連携同期 マイグレーション
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

-- 1. customers に line_user_id のユニーク制約を追加
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_store_line_user_id
  ON customers(store_id, line_user_id) WHERE line_user_id IS NOT NULL;

-- 2. 順番待い受付（queues INSERT）→ customers 自動 upsert トリガー
CREATE OR REPLACE FUNCTION sync_queue_to_customer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.line_user_id IS NOT NULL THEN
    INSERT INTO customers (store_id, name, line_user_id)
    VALUES (NEW.store_id, NEW.customer_name, NEW.line_user_id)
    ON CONFLICT (store_id, line_user_id) DO UPDATE
      SET name = EXCLUDED.name, updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_queue_customer ON queues;

CREATE TRIGGER sync_queue_customer
  AFTER INSERT ON queues
  FOR EACH ROW EXECUTE FUNCTION sync_queue_to_customer();
-- ============================================================
-- 1つのLINE IDで複数お子様対応
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

-- 旧: store_id + line_user_id のユニーク制約を削除（1人しか登録できなかった）
DROP INDEX IF EXISTS idx_customers_store_line_user_id;

-- 新: store_id + line_user_id + name のユニーク制約（同じ名前の重複防止）
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_store_line_name
  ON customers(store_id, line_user_id, name) WHERE line_user_id IS NOT NULL;

-- トリガー更新: store_id + line_user_id + name で一致を確認
CREATE OR REPLACE FUNCTION sync_queue_to_customer()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.line_user_id IS NOT NULL THEN
    BEGIN
      IF EXISTS (
        SELECT 1 FROM customers
        WHERE store_id    = NEW.store_id
          AND line_user_id = NEW.line_user_id
          AND name         = NEW.customer_name
      ) THEN
        UPDATE customers
        SET school_name = NEW.school_name,
            gender      = NEW.gender,
            category    = NEW.category,
            updated_at  = now()
        WHERE store_id    = NEW.store_id
          AND line_user_id = NEW.line_user_id
          AND name         = NEW.customer_name;
      ELSE
        INSERT INTO customers (store_id, name, line_user_id, school_name, gender, category)
        VALUES (NEW.store_id, NEW.customer_name, NEW.line_user_id, NEW.school_name, NEW.gender, NEW.category);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;
