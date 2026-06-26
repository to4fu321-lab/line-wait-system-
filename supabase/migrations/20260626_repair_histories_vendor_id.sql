-- repair_histories に外注業者IDカラムを追加
-- repair_vendors マスタと連携し、名前だけでなくIDでも参照できるようにする

ALTER TABLE repair_histories
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES repair_vendors(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS repair_histories_vendor_id_idx ON repair_histories(vendor_id);
