-- ============================================================
-- スタッフマスタ(staff)の正式化
--   本番に既存(6行)だがマイグレーション未整備だったため、
--   IF NOT EXISTS で「追認」し、不足列のみ補完する(既存行は壊さない)。
--   今回シフト人件費用に hourly_wage(既定時給) を追加。
-- ============================================================

CREATE TABLE IF NOT EXISTS staff (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id    uuid NOT NULL,
  name        text NOT NULL,
  kana        text,
  role        text,                 -- 店長/リーダー/スタッフ/パート/アルバイト
  color       text,                 -- #hex
  pin         text,                 -- 4桁 個人PIN
  hourly_wage integer,              -- 既定時給(円)。人件費概算に使用
  active      boolean DEFAULT true,
  sort_order  integer DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- 既存テーブルとの差異を吸収(列が無ければ追加)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS kana        text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS role        text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS color       text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS pin         text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS hourly_wage integer;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS active      boolean DEFAULT true;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS sort_order  integer DEFAULT 0;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS updated_at  timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_staff_store     ON staff(store_id);
CREATE INDEX IF NOT EXISTS idx_staff_store_pin ON staff(store_id, pin) WHERE pin IS NOT NULL;

COMMENT ON TABLE staff IS 'スタッフマスタ(店舗スタッフ。シフト・人件費の基点)';

-- RLS(既存規約: 全許可。テナント分離はクエリの store_id フィルタで担保)
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_all" ON staff;
CREATE POLICY "staff_all" ON staff FOR ALL USING (true) WITH CHECK (true);

-- updated_at トリガ(共有関数 set_updated_at を利用)
DROP TRIGGER IF EXISTS trg_staff_updated_at ON staff;
CREATE TRIGGER trg_staff_updated_at BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

NOTIFY pgrst, 'reload schema';
