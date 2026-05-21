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
