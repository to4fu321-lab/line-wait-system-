-- ============================================================
-- 店頭タイムカード（共有打刻）の店舗設定
--   require_pin       : 名前タップ後にPIN確認を必須にするか
--   show_on_reception : 受付画面にタイムカードボタンを表示するか
-- ============================================================
ALTER TABLE stores ADD COLUMN IF NOT EXISTS timecard_settings jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN stores.timecard_settings IS '店頭タイムカード設定 {require_pin:bool, show_on_reception:bool}';

NOTIFY pgrst, 'reload schema';
