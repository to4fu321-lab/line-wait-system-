-- ============================================================
-- お直し管理 強化マイグレーション
-- Supabase SQL Editor で実行してください
-- ============================================================

ALTER TABLE repair_histories
  ADD COLUMN IF NOT EXISTS repair_type          text,
  ADD COLUMN IF NOT EXISTS hem_length_mm        smallint,
  ADD COLUMN IF NOT EXISTS sleeve_adjust_mm     smallint,
  ADD COLUMN IF NOT EXISTS waist_adjust_mm      smallint,
  ADD COLUMN IF NOT EXISTS embroidery_text      text,
  ADD COLUMN IF NOT EXISTS embroidery_color     text,
  ADD COLUMN IF NOT EXISTS embroidery_pos       text,
  ADD COLUMN IF NOT EXISTS vendor_name          text,
  ADD COLUMN IF NOT EXISTS sent_to_vendor_at    date,
  ADD COLUMN IF NOT EXISTS expected_return_date date,
  ADD COLUMN IF NOT EXISTS is_rework            boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS rework_reason        text,
  ADD COLUMN IF NOT EXISTS internal_memo        text;

-- repair_type の値制約（任意）
-- ALTER TABLE repair_histories
--   ADD CONSTRAINT repair_histories_repair_type_check
--   CHECK (repair_type IN (
--     'hem','sleeve','waist','embroidery','button','tear','badge','size_exchange','other'
--   ));

COMMENT ON COLUMN repair_histories.repair_type          IS '加工種別: hem/sleeve/waist/embroidery/button/tear/badge/size_exchange/other';
COMMENT ON COLUMN repair_histories.hem_length_mm        IS '裾上げ量(mm)。正=長く、負=短く';
COMMENT ON COLUMN repair_histories.sleeve_adjust_mm     IS '袖丈調整(mm)';
COMMENT ON COLUMN repair_histories.waist_adjust_mm      IS 'ウエスト調整(mm)';
COMMENT ON COLUMN repair_histories.embroidery_text      IS '刺繍文字';
COMMENT ON COLUMN repair_histories.embroidery_color     IS '刺繍糸色';
COMMENT ON COLUMN repair_histories.embroidery_pos       IS '刺繍位置';
COMMENT ON COLUMN repair_histories.vendor_name          IS '外注先名（nullは内製）';
COMMENT ON COLUMN repair_histories.sent_to_vendor_at    IS '外注送付日';
COMMENT ON COLUMN repair_histories.expected_return_date IS '外注戻り予定日';
COMMENT ON COLUMN repair_histories.is_rework            IS '再加工フラグ';
COMMENT ON COLUMN repair_histories.rework_reason        IS '再加工原因コード';
COMMENT ON COLUMN repair_histories.internal_memo        IS 'スタッフ内部メモ（顧客非公開）';
