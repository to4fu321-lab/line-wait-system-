-- ============================================================
-- schools テーブルの欠落カラム補完 (2026-07-13)
--
-- 背景:
--   本番の schools は 20260612_school_regulations.sql より前に
--   旧スクリプトで作成されていたため、CREATE TABLE IF NOT EXISTS が
--   スキップされ、kana / notes / updated_by が存在しなかった。
--   また 20260624_school_deadlines.sql（締切日4列）も未適用だった。
--
--   その結果、学校マスタの保存(lib/master.ts upsertSchool /
--   app/api/schools) が
--   「Could not find the 'kana' column of 'schools' in the schema cache」
--   で全滅していた。
--
-- 冪等: IF NOT EXISTS で再実行安全。
-- ============================================================

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS kana       TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS notes      TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_by TEXT NOT NULL DEFAULT '';

-- 20260624_school_deadlines.sql と同内容(本番未適用だったため再掲)
ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS order_deadline    DATE,
  ADD COLUMN IF NOT EXISTS pickup_deadline   DATE,
  ADD COLUMN IF NOT EXISTS measurement_start DATE,
  ADD COLUMN IF NOT EXISTS measurement_end   DATE;

COMMENT ON COLUMN public.schools.order_deadline    IS '発注締切日（この日までにメーカーへ発注が必要）';
COMMENT ON COLUMN public.schools.pickup_deadline   IS '引渡し完了目標日（入学式前に完了させたい日付）';
COMMENT ON COLUMN public.schools.measurement_start IS '採寸受付開始日';
COMMENT ON COLUMN public.schools.measurement_end   IS '採寸受付終了日';

-- updated_at 自動更新トリガ(旧スクリプト作成テーブルには無かった)
DROP TRIGGER IF EXISTS trg_schools_updated_at ON public.schools;
CREATE TRIGGER trg_schools_updated_at
  BEFORE UPDATE ON public.schools FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- PostgREST スキーマキャッシュを再読込
NOTIFY pgrst, 'reload schema';
