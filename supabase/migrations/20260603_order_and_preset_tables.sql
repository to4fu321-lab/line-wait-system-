-- ============================================================
-- 通常注文テーブル & お直し料金プリセットテーブル
-- Supabase SQL Editor で実行してください
-- ============================================================

-- ── お直し料金プリセット ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS repair_price_presets (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id     text NOT NULL,
  school_name  text,                    -- null = 全学校共通
  item_name    text NOT NULL,           -- 品名 例: 詰め襟上着
  repair_type  text NOT NULL,           -- hem/sleeve/waist/embroidery/button/tear/badge/size_exchange/other
  default_price integer,               -- 標準料金（円）
  notes        text,
  sort_order   integer DEFAULT 0,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_repair_price_presets_store ON repair_price_presets(store_id);

COMMENT ON TABLE repair_price_presets IS 'お直し料金プリセット（加工種別・品名・標準価格の組み合わせ）';

-- ── 注文テーブル（複数商品を1注文にまとめる） ─────────────────
CREATE TABLE IF NOT EXISTS orders (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id              text NOT NULL,
  customer_id           uuid,
  child_id              uuid,
  order_number          text,           -- 注文番号（表示用）
  status                text DEFAULT 'confirmed',  -- confirmed/processing/ready/delivered/cancelled
  payment_status        text DEFAULT 'unpaid',     -- unpaid/partial/paid
  total_amount          integer,
  notes                 text,
  expected_delivery_date date,
  slip_number           text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);

COMMENT ON TABLE orders IS '制服・用品注文ヘッダ（複数明細をまとめる）';

-- ── 注文明細テーブル ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS order_items (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id            uuid REFERENCES orders(id) ON DELETE CASCADE,
  store_id            text NOT NULL,
  school_product_id   uuid,             -- school_products.id（任意）
  item_name           text NOT NULL,
  size_label          text,
  quantity            integer DEFAULT 1,
  unit_price          integer,
  status              text DEFAULT 'ordered',  -- ordered/on_order/stocked/ready/delivered/cancelled
  notes               text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_store ON order_items(store_id);

COMMENT ON TABLE order_items IS '注文明細（1注文に複数の商品・サイズ）';
