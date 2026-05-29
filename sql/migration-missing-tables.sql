-- ============================================================
-- マイグレーション: テーブル再作成後の不足テーブル・カラムを追加
-- 既存データを消さずに実行できます
-- Supabase ダッシュボード > SQL Editor で実行してください
-- ============================================================

-- ─── stores テーブルの不足カラム ──────────────────────────────

ALTER TABLE stores ADD COLUMN IF NOT EXISTS theme_color        text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS notification_plan  text        NOT NULL DEFAULT 'calling_only';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS push_settings      jsonb       NOT NULL DEFAULT '{}';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS is_test_mode       boolean     NOT NULL DEFAULT false;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS active_fittings    integer     NOT NULL DEFAULT 0;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS alert_days_repair  integer     NOT NULL DEFAULT 7;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS alert_days_purchase integer    NOT NULL DEFAULT 7;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS school_names       text[]      NOT NULL DEFAULT '{}';
ALTER TABLE stores ADD COLUMN IF NOT EXISTS repair_notes       text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_type      text;
ALTER TABLE stores ADD COLUMN IF NOT EXISTS takeout_settings   jsonb       NOT NULL DEFAULT '{}';

-- ─── products テーブル ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS products (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  code       text,
  name       text        NOT NULL,
  category   text,
  maker      text,
  gender     text,
  sizes      text[]      NOT NULL DEFAULT '{}',
  price      integer,
  notes      text,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);

-- ─── orders テーブル ──────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('draft', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS orders (
  id             uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id       uuid           NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id    uuid           REFERENCES customers(id) ON DELETE SET NULL,
  child_id       uuid           REFERENCES children(id) ON DELETE SET NULL,
  queue_id       uuid           REFERENCES queues(id) ON DELETE SET NULL,
  reservation_id uuid,
  order_number   text,
  status         order_status   NOT NULL DEFAULT 'draft',
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  total_amount   integer,
  height         numeric,
  weight         numeric,
  notes          text,
  created_at     timestamptz    NOT NULL DEFAULT now(),
  updated_at     timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_store_id ON orders(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);

-- ─── order_items テーブル ─────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE order_item_status AS ENUM ('ordered', 'on_order', 'stocked', 'ready', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS order_items (
  id         uuid              PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid              NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_name  text              NOT NULL,
  size_label text,
  quantity   integer           NOT NULL DEFAULT 1,
  unit_price integer,
  status     order_item_status NOT NULL DEFAULT 'ordered',
  notes      text,
  created_at timestamptz       NOT NULL DEFAULT now(),
  updated_at timestamptz       NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ─── reservations テーブル ────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE reservation_status AS ENUM ('confirmed', 'arrived', 'called', 'completed', 'cancelled', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS reservations (
  id          uuid               PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid               NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  customer_id uuid               REFERENCES customers(id) ON DELETE SET NULL,
  child_id    uuid               REFERENCES children(id) ON DELETE SET NULL,
  reserved_at timestamptz        NOT NULL,
  purpose     text,
  status      reservation_status NOT NULL DEFAULT 'confirmed',
  queue_id    uuid               REFERENCES queues(id) ON DELETE SET NULL,
  notes       text,
  created_at  timestamptz        NOT NULL DEFAULT now(),
  updated_at  timestamptz        NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservations_store_id   ON reservations(store_id);
CREATE INDEX IF NOT EXISTS idx_reservations_reserved_at ON reservations(reserved_at);

-- ─── reservation_settings テーブル ───────────────────────────

CREATE TABLE IF NOT EXISTS reservation_settings (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  service_type text        NOT NULL,
  label        text        NOT NULL DEFAULT '',
  duration_min integer     NOT NULL DEFAULT 60,
  start_time   text        NOT NULL DEFAULT '10:00',
  end_time     text        NOT NULL DEFAULT '17:00',
  is_active    boolean     NOT NULL DEFAULT true,
  slots_sun    integer     NOT NULL DEFAULT 0,
  slots_mon    integer     NOT NULL DEFAULT 2,
  slots_tue    integer     NOT NULL DEFAULT 2,
  slots_wed    integer     NOT NULL DEFAULT 2,
  slots_thu    integer     NOT NULL DEFAULT 2,
  slots_fri    integer     NOT NULL DEFAULT 2,
  slots_sat    integer     NOT NULL DEFAULT 3,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, service_type)
);

-- ─── reservation_date_overrides テーブル ─────────────────────

CREATE TABLE IF NOT EXISTS reservation_date_overrides (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  date       date        NOT NULL,
  max_slots  integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (store_id, date)
);

CREATE INDEX IF NOT EXISTS idx_resv_overrides_store_date ON reservation_date_overrides(store_id, date);

-- ─── push_subscriptions テーブル ─────────────────────────────

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  endpoint   text        NOT NULL UNIQUE,
  p256dh     text        NOT NULL,
  auth       text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subs_store_id ON push_subscriptions(store_id);

-- ─── RLS ポリシー（anon アクセス許可） ──────────────────────

DO $$ BEGIN
  CREATE POLICY "products_anon_all" ON products
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "orders_anon_all" ON orders
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "order_items_anon_all" ON order_items
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "reservations_anon_all" ON reservations
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "reservation_settings_anon_all" ON reservation_settings
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "reservation_date_overrides_anon_all" ON reservation_date_overrides
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "push_subscriptions_anon_all" ON push_subscriptions
    FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── RLS 有効化（未有効なら） ─────────────────────────────────

ALTER TABLE products                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items               ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations              ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_date_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions        ENABLE ROW LEVEL SECURITY;
