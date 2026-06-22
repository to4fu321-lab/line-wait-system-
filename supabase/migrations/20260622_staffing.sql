-- ============================================================
-- 試着予約連動の人員設計（staffing_settings / staffing_requirements）
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'extensions'
AS $function$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$;

-- ── 店舗別の必要人員パラメータ ────────────────────────────────
CREATE TABLE IF NOT EXISTS staffing_settings (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id           uuid NOT NULL UNIQUE,
  time_block_min     integer DEFAULT 60,     -- 集計ブロック（分）
  min_staff          integer DEFAULT 1,      -- 最少配置
  max_staff          integer DEFAULT 12,     -- 最大配置
  fitting_minutes    integer DEFAULT 20,     -- 1試着の対応時間（reservation_settings.duration_min で上書き可）
  per_person_rooms   numeric DEFAULT 1.5,    -- スタッフ1人が同時に捌ける試着室数
  conversion_rate    numeric DEFAULT 0.6,    -- 成約率（成約後対応の補正に使用）
  visit_factor       numeric DEFAULT 1.2,    -- 予約に対する実来店係数（飛び込み含む）
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staffing_settings_store ON staffing_settings(store_id);
COMMENT ON TABLE staffing_settings IS '試着連動の必要人員算出パラメータ（店舗別・調整可）';

-- ── 算出/編集された必要人員（時間帯別キャッシュ） ─────────────
CREATE TABLE IF NOT EXISTS staffing_requirements (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id    uuid NOT NULL,
  work_date   date NOT NULL,
  time_block  text NOT NULL,                 -- 'HH:MM'（ブロック開始）
  required    integer NOT NULL DEFAULT 0,
  reservations integer DEFAULT 0,            -- 当ブロックの予約数（参考）
  source      text DEFAULT 'demand',         -- demand(自動)/manual(手修正)/ai
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (store_id, work_date, time_block)
);
CREATE INDEX IF NOT EXISTS idx_staffing_req_store_date ON staffing_requirements(store_id, work_date);
COMMENT ON TABLE staffing_requirements IS '時間帯別の必要人員（試着予約から算出・手修正可）';

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['staffing_settings','staffing_requirements'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS "%s_all" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "%s_all" ON public.%I FOR ALL USING (true) WITH CHECK (true);', t, t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated_at ON public.%I;', t, t);
    EXECUTE format('CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION set_updated_at();', t, t);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
