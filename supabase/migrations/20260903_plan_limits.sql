-- ============================================================
-- 無料トライアルの数量上限（顧客登録・スタッフ登録・SMS/LINE通知）
--
--   無料トライアルは「仕事管理・SMS連絡・LINE連絡・顧客管理」を
--   人数/件数を限定して使えるようにする。上限値は lib/features.ts の
--   PLAN_LIMITS と必ず一致させること（このマイグレーションが唯一の
--   DB側の数字）。
--
--   顧客(customers)・スタッフ(staff)は登録経路が複数（LIFF自己登録・
--   マスタ画面の直接insert・初期設定ウィザードの一括insert）あるため、
--   どの経路でも必ず効くようDB側のBEFORE INSERTトリガで止める。
--   SMS/LINE通知は送信経路が /api/notify-repair の一本のみなので、
--   そちらはアプリ側(lib/planUsage.ts)でカウントする。ここでは
--   その集計テーブル(usage_counters)だけ用意する。
--
--   例外メッセージは "PLAN_LIMIT_EXCEEDED:<metric>" というマーカーで
--   始める。アプリ側 lib/planLimitError.ts がこれを見て、相手（店舗
--   オーナー向け/LINE利用客向け）に応じた文言に変換する。
--
--   冪等: 再実行安全。
-- ============================================================

-- ── 月次利用カウンタ（SMS/LINE通知など、テーブルinsertで数えられないもの用）──
CREATE TABLE IF NOT EXISTS public.usage_counters (
  store_id   uuid NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  metric     text NOT NULL,             -- 例: 'sms_per_month'
  period     text NOT NULL,             -- 'YYYY-MM'（月次集計。将来別粒度が要れば追加）
  count      integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, metric, period)
);

-- RLS: 集計値の書き込みはサーバー(service role)のみが行う。
--      店舗スタッフは自店舗分の閲覧のみ許可（利用状況ページ表示用）。
ALTER TABLE public.usage_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS usage_counters_staff_select ON public.usage_counters;
CREATE POLICY usage_counters_staff_select ON public.usage_counters
  FOR SELECT TO authenticated
  USING (public.is_staff_of(store_id));

GRANT SELECT ON public.usage_counters TO authenticated;

-- upsert + カウントアップをアトミックに行う（サーバーからのみ呼ぶ想定）
CREATE OR REPLACE FUNCTION public.increment_usage_counter(
  p_store_id uuid, p_metric text, p_period text
) RETURNS integer
  LANGUAGE sql
  SET search_path TO 'public'
AS $function$
  INSERT INTO public.usage_counters (store_id, metric, period, count, updated_at)
  VALUES (p_store_id, p_metric, p_period, 1, now())
  ON CONFLICT (store_id, metric, period)
  DO UPDATE SET count = public.usage_counters.count + 1, updated_at = now()
  RETURNING count;
$function$;

-- ── プラン上限トリガ（customers / staff）─────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_plan_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path TO 'public'
AS $function$
DECLARE
  v_plan  text;
  v_limit integer;
  v_count integer;
  v_metric text;
BEGIN
  SELECT features->>'_plan' INTO v_plan FROM public.stores WHERE id = NEW.store_id;

  -- 上限があるのは今のところ無料トライアルのみ。他プランは何もしない。
  IF v_plan IS DISTINCT FROM 'free_trial' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'customers' THEN
    v_metric := 'customers_max';
    v_limit  := 30;  -- lib/features.ts PLAN_LIMITS.free_trial.customers_max と一致させること
    SELECT count(*) INTO v_count FROM public.customers
      WHERE store_id = NEW.store_id AND deleted_at IS NULL;
  ELSIF TG_TABLE_NAME = 'staff' THEN
    v_metric := 'staff_max';
    v_limit  := 3;   -- lib/features.ts PLAN_LIMITS.free_trial.staff_max と一致させること
    SELECT count(*) INTO v_count FROM public.staff
      WHERE store_id = NEW.store_id AND active IS NOT FALSE;
  ELSE
    RETURN NEW;
  END IF;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'PLAN_LIMIT_EXCEEDED:%', v_metric;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_customers_plan_limit ON public.customers;
CREATE TRIGGER trg_customers_plan_limit
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();

DROP TRIGGER IF EXISTS trg_staff_plan_limit ON public.staff;
CREATE TRIGGER trg_staff_plan_limit
  BEFORE INSERT ON public.staff
  FOR EACH ROW EXECUTE FUNCTION public.enforce_plan_limit();

NOTIFY pgrst, 'reload schema';
