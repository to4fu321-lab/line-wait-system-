-- ============================================================================
--  レジ管理・現金管理（Cash Management）
--   レジオープン〜レジ締めを 1 セッションとして管理する。
--   - register_sessions        : レジセッション（開店/締め・釣銭準備金・違算）
--   - register_cash_movements  : 営業中の入出金（釣銭補給・小口支出・両替）
--   - sales.register_session_id: 会計をオープン中セッションへ紐付け（理論値集計の基点）
--
--   Supabase SQL Editor で実行してください（追加のみ・既存データ非破壊）。
--   2026-07  Claude Code
-- ============================================================================

-- 共有 updated_at トリガ関数（既存想定・無ければ作成）
CREATE OR REPLACE FUNCTION public.set_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public', 'extensions'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$function$;

-- ────────────────────────────────────────────────────────────────
--  ① レジセッション（開店1回 = 1行、締めで status を closed に）
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.register_sessions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id              uuid NOT NULL,
  session_number        text,                                    -- 例: 20260704-01
  status                text NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'closed')),

  -- 開店（オープン）
  opened_at             timestamptz NOT NULL DEFAULT now(),
  opened_by             uuid,                                    -- staff.id
  opened_by_name        text,
  opening_float         integer NOT NULL DEFAULT 0,              -- 釣銭準備金 合計(円)
  opening_denominations jsonb NOT NULL DEFAULT '{}'::jsonb,      -- 金種→枚数 {"10000":2,"1000":10,...}

  -- 締め（クローズ）
  closed_at             timestamptz,
  closed_by             uuid,
  closed_by_name        text,
  closing_denominations jsonb,                                   -- 締め時 現金の金種→枚数
  -- 締めレポート（決済種別ごと）: [{method, theoretical, actual, variance}]
  closing_report        jsonb,
  cash_theoretical      integer,                                 -- 現金 理論値(スナップショット)
  cash_actual           integer,                                 -- 現金 実査値
  cash_variance         integer,                                 -- 現金 過不足(実査-理論)
  total_sales           integer,                                 -- 当セッション総売上(税込)
  total_variance        integer,                                 -- 全決済 過不足合計

  note                  text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_register_sessions_store
  ON public.register_sessions(store_id, opened_at DESC);

-- 1店舗につきオープン中セッションは同時に1つだけ（重複オープン防止）
CREATE UNIQUE INDEX IF NOT EXISTS uniq_open_register_session_per_store
  ON public.register_sessions(store_id)
  WHERE status = 'open';

DROP TRIGGER IF EXISTS trg_register_sessions_updated_at ON public.register_sessions;
CREATE TRIGGER trg_register_sessions_updated_at BEFORE UPDATE ON public.register_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.register_sessions IS 'レジセッション（オープン〜締め。釣銭準備金・違算を管理）';

-- ────────────────────────────────────────────────────────────────
--  ② 営業中の入出金（現金の変動：釣銭補給・小口支出・両替 等）
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.register_cash_movements (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id    uuid NOT NULL,
  session_id  uuid NOT NULL REFERENCES public.register_sessions(id) ON DELETE CASCADE,
  direction   text NOT NULL CHECK (direction IN ('in', 'out')),  -- in=入金/補給, out=出金/支出
  amount      integer NOT NULL DEFAULT 0,                         -- 正の金額(円)
  reason      text,                                               -- 理由カテゴリ(釣銭補給/経費/両替/その他)
  memo        text,                                               -- 自由入力メモ
  staff_id    uuid,
  staff_name  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_register_cash_movements_session
  ON public.register_cash_movements(session_id, created_at);

COMMENT ON TABLE public.register_cash_movements IS 'レジ営業中の現金入出金（釣銭補給・小口支出・両替）';

-- ────────────────────────────────────────────────────────────────
--  ③ 既存 sales をセッションへ紐付け（理論値集計の基点）
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS register_session_id uuid;

CREATE INDEX IF NOT EXISTS idx_sales_register_session
  ON public.sales(register_session_id);

-- ────────────────────────────────────────────────────────────────
--  ④ RLS（既存テーブルと同じく anon 全許可。テナント分離は store_id で担保）
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.register_sessions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.register_cash_movements ENABLE ROW LEVEL SECURITY;

DO $rls$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='register_sessions'
        AND policyname='register_sessions_anon_all') THEN
    CREATE POLICY register_sessions_anon_all ON public.register_sessions
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies
      WHERE schemaname='public' AND tablename='register_cash_movements'
        AND policyname='register_cash_movements_anon_all') THEN
    CREATE POLICY register_cash_movements_anon_all ON public.register_cash_movements
      FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $rls$;

NOTIFY pgrst, 'reload schema';
