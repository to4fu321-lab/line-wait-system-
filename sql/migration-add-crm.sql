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
