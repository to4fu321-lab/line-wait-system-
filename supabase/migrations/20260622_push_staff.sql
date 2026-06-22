-- ============================================================
-- プッシュ購読をスタッフ宛にも使えるよう拡張
--   既存 push_subscriptions(店舗の管理者通知用) に staff_id / kind を追加。
--   kind='staff' のものはスタッフ個人宛、'admin'(既定)は従来の管理者宛。
-- ============================================================
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS staff_id uuid;
ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS kind     text DEFAULT 'admin';

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_staff ON push_subscriptions(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_store_kind ON push_subscriptions(store_id, kind);

COMMENT ON COLUMN push_subscriptions.staff_id IS 'スタッフ個人宛プッシュの対象（kind=staff時）';

NOTIFY pgrst, 'reload schema';
