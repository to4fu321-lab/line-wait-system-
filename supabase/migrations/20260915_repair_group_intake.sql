-- ============================================================
-- お直し複数点受付（合算グループ）
--
--   1回の受付で「ズボンのウエスト直し＋裾上げ」のように内容の違う
--   複数点を扱えるようにする。正規化した order/order_lines は既存
--   運用（一覧・配送・通知・統計）への影響が大きいため見送り、既存の
--   「1お直し=1行」構造のまま repair_group_id で束ねる方式にする
--   （docs/repair-master-data-design.md の「多項目受付は伝票番号で
--     束ねる」方針を、手入力の slip_number ではなく自動採番の
--     UUID で実装したもの）。
--
--   repair_group_id : 同じ受付セッションで登録した行に共通のID。
--                      単独受付（従来どおり）は null のまま。
--   group_notify_mode: 'individual' = 各点が完了するたびに個別通知
--                       'combined'   = グループ全点が完了してから1通で通知
--   冪等: 再実行安全。
-- ============================================================

ALTER TABLE public.repair_histories
  ADD COLUMN IF NOT EXISTS repair_group_id  uuid,
  ADD COLUMN IF NOT EXISTS group_notify_mode text NOT NULL DEFAULT 'individual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'repair_histories_group_notify_mode_check'
  ) THEN
    ALTER TABLE public.repair_histories
      ADD CONSTRAINT repair_histories_group_notify_mode_check
      CHECK (group_notify_mode IN ('individual', 'combined'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_repair_histories_group_id
  ON public.repair_histories (repair_group_id)
  WHERE repair_group_id IS NOT NULL;

COMMENT ON COLUMN public.repair_histories.repair_group_id  IS '同一受付セッションで束ねた複数点のグループID。単独受付はnull';
COMMENT ON COLUMN public.repair_histories.group_notify_mode IS '完了通知の方式: individual=個別に都度通知 / combined=グループ全点完了後に1通';

NOTIFY pgrst, 'reload schema';
