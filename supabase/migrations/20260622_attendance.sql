-- ============================================================
-- 出退勤打刻（time_records）
--   スタッフがPWAから出勤/退勤を打刻。予定(shifts)と突合して
--   遅刻/早退/残業/欠勤を算出する。
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'extensions'
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

CREATE TABLE IF NOT EXISTS time_records (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id      uuid NOT NULL,
  staff_id      uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  shift_id      uuid REFERENCES shifts(id) ON DELETE SET NULL,  -- 紐づく予定（任意）
  work_date     date NOT NULL,
  clock_in_at   timestamptz,
  clock_out_at  timestamptz,
  break_minutes integer DEFAULT 0,
  clock_in_lat  numeric,
  clock_in_lng  numeric,
  status        text DEFAULT 'working',   -- working / done
  note          text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_time_records_store_date ON time_records(store_id, work_date);
CREATE INDEX IF NOT EXISTS idx_time_records_staff_date ON time_records(staff_id, work_date);
COMMENT ON TABLE time_records IS '出退勤打刻（予定shiftと突合して勤怠を集計）';

ALTER TABLE time_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "time_records_all" ON time_records;
CREATE POLICY "time_records_all" ON time_records FOR ALL USING (true) WITH CHECK (true);
DROP TRIGGER IF EXISTS trg_time_records_updated_at ON time_records;
CREATE TRIGGER trg_time_records_updated_at BEFORE UPDATE ON time_records
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

NOTIFY pgrst, 'reload schema';
