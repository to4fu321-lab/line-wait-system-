-- ============================================================
-- テイクアウト v2 マイグレーション
-- Supabase Dashboard > SQL Editor で実行してください
-- ============================================================

-- 受取希望時刻
ALTER TABLE takeout_orders ADD COLUMN IF NOT EXISTS pickup_time timestamptz;

-- 注文経路（line=LINE/アプリ, phone=電話, walkin=店頭, app=アプリ将来用）
ALTER TABLE takeout_orders ADD COLUMN IF NOT EXISTS order_source text NOT NULL DEFAULT 'line'
  CHECK (order_source IN ('line', 'phone', 'walkin', 'app'));

-- アイテム単位の完成フラグ
ALTER TABLE takeout_order_items ADD COLUMN IF NOT EXISTS is_done boolean NOT NULL DEFAULT false;
