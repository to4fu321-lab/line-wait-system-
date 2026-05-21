-- 顧客の論理削除カラム
ALTER TABLE customers ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_customers_deleted_at ON customers (deleted_at);
