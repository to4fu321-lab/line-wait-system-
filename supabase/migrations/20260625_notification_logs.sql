-- 通知送信ログ（在校生フォロー通知などの件数・請求額を記録）
CREATE TABLE IF NOT EXISTS notification_logs (
  id              uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        uuid         NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type            text         NOT NULL DEFAULT 'followup',
  sent_at         timestamptz  NOT NULL DEFAULT now(),
  recipient_count int          NOT NULL DEFAULT 0,
  unit_price      int          NOT NULL DEFAULT 0,
  total_amount    int          NOT NULL DEFAULT 0,
  filter_desc     text,
  created_at      timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_notification_logs"
  ON notification_logs
  USING (true)
  WITH CHECK (true);

CREATE INDEX IF NOT EXISTS notification_logs_store_id_sent_at
  ON notification_logs (store_id, sent_at DESC);
