-- ============================================================
-- シフト管理(エアシフト型・労使共用・店舗間ヘルプ・アプリ内メッセージ)
--   store_id / group_id / staff_id はすべて uuid。
--   RLS は既存規約に合わせ全許可、テナント分離はクエリの store_id フィルタで担保。
-- ============================================================

-- ── 確定/下書きシフト本体(1行 = 1スタッフ × 1日 × 1勤務) ──────
CREATE TABLE IF NOT EXISTS shifts (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id        uuid NOT NULL,                                   -- 勤務地店舗(ヘルプ時 staff所属と異なる)
  staff_id        uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  home_store_id   uuid,                                            -- スタッフ所属店舗(ヘルプ判定。通常 = store_id)
  work_date       date NOT NULL,
  start_time      time NOT NULL,
  end_time        time NOT NULL,
  break_minutes   integer DEFAULT 0,
  position        text,                                            -- ポジション/役割メモ
  status          text DEFAULT 'draft',                            -- draft / published / cancelled
  is_help         boolean DEFAULT false,                           -- 他店ヘルプ勤務か
  help_request_id uuid,                                            -- shift_help_requests.id(ヘルプ起因の場合)
  hourly_wage     integer,                                         -- shift単位の時給上書き(無ければ staff.hourly_wage)
  note            text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shifts_store_date ON shifts(store_id, work_date);
CREATE INDEX IF NOT EXISTS idx_shifts_staff_date ON shifts(staff_id, work_date);
CREATE INDEX IF NOT EXISTS idx_shifts_home_store ON shifts(home_store_id, work_date) WHERE home_store_id IS NOT NULL;
COMMENT ON TABLE shifts IS 'シフト本体(下書き/公開)。1行=1スタッフ×1日×1勤務';

-- ── 希望シフト(スタッフが提出する勤務希望/休み希望) ──────────
CREATE TABLE IF NOT EXISTS shift_requests (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id          uuid NOT NULL,
  staff_id          uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  work_date         date NOT NULL,
  kind              text NOT NULL DEFAULT 'work',                  -- work(勤務可) / off(休み希望) / any
  pref_start        time,                                          -- 希望開始(kind=work時)
  pref_end          time,                                          -- 希望終了
  note              text,
  status            text DEFAULT 'submitted',                      -- submitted / approved / rejected
  resolved_shift_id uuid,                                          -- 承認時に作成された shifts.id
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shift_requests_store_date ON shift_requests(store_id, work_date);
CREATE INDEX IF NOT EXISTS idx_shift_requests_staff      ON shift_requests(staff_id, work_date);
CREATE INDEX IF NOT EXISTS idx_shift_requests_status     ON shift_requests(store_id, status);
COMMENT ON TABLE shift_requests IS '希望シフト(スタッフ提出。承認で shifts へ展開)';

-- ── 店舗間ヘルプ募集(同一グループ内) ─────────────────────────
CREATE TABLE IF NOT EXISTS shift_help_requests (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id            uuid NOT NULL,                               -- groups.id(募集可能範囲)
  requesting_store_id uuid NOT NULL,                              -- ヘルプを求める店舗
  work_date           date NOT NULL,
  start_time          time NOT NULL,
  end_time            time NOT NULL,
  headcount           integer DEFAULT 1,                          -- 必要人数
  position            text,
  note                text,
  status              text DEFAULT 'open',                        -- open / partially_filled / filled / cancelled
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_help_requests_group_date ON shift_help_requests(group_id, work_date);
CREATE INDEX IF NOT EXISTS idx_help_requests_req_store  ON shift_help_requests(requesting_store_id, status);
COMMENT ON TABLE shift_help_requests IS '店舗間ヘルプ募集(同一グループ内で応援を募る)';

-- ── ヘルプ応募/割当(どのスタッフがどの募集に入るか) ──────────
CREATE TABLE IF NOT EXISTS shift_help_offers (
  id                uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  help_request_id   uuid NOT NULL REFERENCES shift_help_requests(id) ON DELETE CASCADE,
  staff_id          uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  offering_store_id uuid NOT NULL,                                -- staff の所属店舗
  status            text DEFAULT 'offered',                       -- offered / accepted / declined / assigned
  shift_id          uuid,                                         -- assigned 時に作成された shifts.id
  note              text,
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_help_offers_request ON shift_help_offers(help_request_id);
CREATE INDEX IF NOT EXISTS idx_help_offers_staff   ON shift_help_offers(staff_id);
COMMENT ON TABLE shift_help_offers IS 'ヘルプ募集への応募/割当';

-- ── アプリ内メッセージ(店長↔スタッフ・全体お知らせ) ─────────
CREATE TABLE IF NOT EXISTS shift_messages (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id   uuid NOT NULL,
  staff_id   uuid REFERENCES staff(id) ON DELETE CASCADE,         -- 会話相手スタッフ。NULL=全体連絡/掲示
  sender     text NOT NULL,                                       -- 'manager' | 'staff'
  body       text NOT NULL,
  read_at    timestamptz,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shift_messages_thread ON shift_messages(store_id, staff_id, created_at);
CREATE INDEX IF NOT EXISTS idx_shift_messages_store  ON shift_messages(store_id, created_at);
COMMENT ON TABLE shift_messages IS 'シフト連絡(店長↔スタッフの1対1スレッド＋全体お知らせ)';

-- ── 人件費予算(月別・予算対比用) ─────────────────────────────
CREATE TABLE IF NOT EXISTS shift_budgets (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id      uuid NOT NULL,
  year_month    text NOT NULL,                                    -- 'YYYY-MM'
  budget_amount integer,
  note          text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),
  UNIQUE (store_id, year_month)
);
CREATE INDEX IF NOT EXISTS idx_shift_budgets_store ON shift_budgets(store_id);
COMMENT ON TABLE shift_budgets IS '人件費予算(店舗×年月)';

-- ── 勤務パターン雛形(早番/遅番/通し) ─────────────────────────
CREATE TABLE IF NOT EXISTS shift_templates (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id      uuid NOT NULL,
  label         text NOT NULL,                                    -- 例: 早番 / 遅番 / 通し
  start_time    time NOT NULL,
  end_time      time NOT NULL,
  break_minutes integer DEFAULT 0,
  color         text,
  sort_order    integer DEFAULT 0,
  active        boolean DEFAULT true,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shift_templates_store ON shift_templates(store_id);
COMMENT ON TABLE shift_templates IS 'シフト勤務パターン雛形';

-- ── RLS(全許可) ＋ updated_at トリガを一括付与 ───────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'shifts','shift_requests','shift_help_requests','shift_help_offers',
    'shift_messages','shift_budgets','shift_templates'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "%s_all" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t, t);
  END LOOP;
  -- updated_at を持つテーブルのみトリガ(shift_messages は created のみ)
  FOREACH t IN ARRAY ARRAY[
    'shifts','shift_requests','shift_help_requests','shift_help_offers',
    'shift_budgets','shift_templates'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
