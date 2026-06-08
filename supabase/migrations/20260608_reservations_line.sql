-- reservations に line_user_id を追加（予約時のLINEユーザーIDを保持）
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS line_user_id text;

CREATE INDEX IF NOT EXISTS idx_reservations_line_user_id
  ON reservations(line_user_id) WHERE line_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_store_date
  ON reservations(store_id, reserved_at);
