-- ============================================================
-- テイクアウトサービス 基盤マイグレーション
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

-- ① stores に業態フラグ・テイクアウト設定を追加
ALTER TABLE stores ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'uniform'
  CHECK (business_type IN ('uniform', 'takeout'));

-- テイクアウト設定（JSON）
-- skip_preparing: trueで「受付→完成」に直行（弁当・総菜等の事前調理向け）
-- status_labels: 各ステータスのラベルをカスタマイズ
-- target_minutes: 目標提供時間（分）デフォルト15分
-- combo_timeout_seconds: コンボリセットまでの秒数 デフォルト300秒
-- notify_on_preparing: 調理開始でLINE通知するか
-- notify_on_ready: 完成でLINE通知するか
ALTER TABLE stores ADD COLUMN IF NOT EXISTS takeout_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ② メニューカテゴリ
CREATE TABLE IF NOT EXISTS menu_categories (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  sort_order integer     NOT NULL DEFAULT 0,
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ③ メニュー
CREATE TABLE IF NOT EXISTS menus (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id  uuid        REFERENCES menu_categories(id) ON DELETE SET NULL,
  name         text        NOT NULL,
  description  text,
  price        integer     NOT NULL DEFAULT 0,
  image_url    text,
  is_available boolean     NOT NULL DEFAULT true,
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ④ テイクアウト注文
-- status の流れ:
--   pending   = 受付（注文が入った状態）
--   preparing = 調理中（スタッフがタップ → LINE通知トリガー①）
--   ready     = 完成（スタッフがタップ → LINE通知トリガー②）
--   completed = お渡し済み
--   cancelled = キャンセル
-- ※ skip_preparing=true の店舗は pending→ready に直行
CREATE TABLE IF NOT EXISTS takeout_orders (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           uuid        NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  order_number       text        NOT NULL,
  line_user_id       text,
  customer_name      text,
  status             text        NOT NULL DEFAULT 'pending'
                                 CHECK (status IN ('pending', 'preparing', 'ready', 'completed', 'cancelled')),
  total_amount       integer     NOT NULL DEFAULT 0,
  notes              text,
  notified_preparing boolean     NOT NULL DEFAULT false,
  notified_ready     boolean     NOT NULL DEFAULT false,
  estimated_ready_at timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- ⑤ 注文明細（メニュー名はスナップショット保存）
CREATE TABLE IF NOT EXISTS takeout_order_items (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   uuid        NOT NULL REFERENCES takeout_orders(id) ON DELETE CASCADE,
  menu_id    uuid        REFERENCES menus(id) ON DELETE SET NULL,
  name       text        NOT NULL,
  unit_price integer     NOT NULL DEFAULT 0,
  quantity   integer     NOT NULL DEFAULT 1,
  notes      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ⑥ RLS
ALTER TABLE menu_categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE menus               ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeout_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE takeout_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_categories_anon_all"    ON menu_categories;
DROP POLICY IF EXISTS "menus_anon_all"               ON menus;
DROP POLICY IF EXISTS "takeout_orders_anon_all"      ON takeout_orders;
DROP POLICY IF EXISTS "takeout_order_items_anon_all" ON takeout_order_items;

CREATE POLICY "menu_categories_anon_all"
  ON menu_categories FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "menus_anon_all"
  ON menus FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "takeout_orders_anon_all"
  ON takeout_orders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "takeout_order_items_anon_all"
  ON takeout_order_items FOR ALL TO anon USING (true) WITH CHECK (true);

-- ⑦ 採番関数（#001 形式、当日リセット）
CREATE OR REPLACE FUNCTION get_next_order_number(p_store_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(
    CAST(SUBSTRING(order_number FROM 2) AS integer)
  ), 0) + 1
  INTO next_num
  FROM takeout_orders
  WHERE store_id = p_store_id
    AND (created_at AT TIME ZONE 'Asia/Tokyo')::date = (NOW() AT TIME ZONE 'Asia/Tokyo')::date;
  RETURN '#' || LPAD(next_num::text, 3, '0');
END;
$$;

-- ⑧ updated_at トリガー
CREATE OR REPLACE FUNCTION update_takeout_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_takeout_orders_updated_at ON takeout_orders;
CREATE TRIGGER trg_takeout_orders_updated_at
  BEFORE UPDATE ON takeout_orders
  FOR EACH ROW EXECUTE FUNCTION update_takeout_updated_at();

DROP TRIGGER IF EXISTS trg_menus_updated_at ON menus;
CREATE TRIGGER trg_menus_updated_at
  BEFORE UPDATE ON menus
  FOR EACH ROW EXECUTE FUNCTION update_takeout_updated_at();

-- ⑨ インデックス
CREATE INDEX IF NOT EXISTS idx_takeout_orders_store_status ON takeout_orders(store_id, status);
CREATE INDEX IF NOT EXISTS idx_takeout_orders_store_date   ON takeout_orders(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_menus_store_id              ON menus(store_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_menu_categories_store_id    ON menu_categories(store_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_takeout_items_order_id      ON takeout_order_items(order_id);
