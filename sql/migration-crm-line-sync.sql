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
