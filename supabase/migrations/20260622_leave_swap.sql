-- ============================================================
-- 休暇申請（leave_requests）・シフト交換（shift_swaps）
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'extensions'
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

-- ── 休暇申請 ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leave_requests (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id    uuid NOT NULL,
  staff_id    uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  leave_type  text NOT NULL DEFAULT 'paid',  -- paid(有給)/unpaid(無給)/sick(病欠)/other
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  reason      text,
  status      text DEFAULT 'submitted',      -- submitted/approved/rejected/cancelled
  reviewed_by uuid,
  note        text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_leave_requests_store ON leave_requests(store_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_requests_staff ON leave_requests(staff_id, start_date);
COMMENT ON TABLE leave_requests IS '休暇申請（種別付き・店長承認）';

-- ── シフト交換 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shift_swaps (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id      uuid NOT NULL,
  from_shift_id uuid NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
  from_staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  to_staff_id   uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  status        text DEFAULT 'requested',    -- requested/accepted/approved/rejected/cancelled
  note          text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_store ON shift_swaps(store_id, status);
CREATE INDEX IF NOT EXISTS idx_shift_swaps_to    ON shift_swaps(to_staff_id, status);
COMMENT ON TABLE shift_swaps IS 'シフト交換申請（相手承諾→店長承認で staff_id 入替）';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['leave_requests','shift_swaps'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "%s_all" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
