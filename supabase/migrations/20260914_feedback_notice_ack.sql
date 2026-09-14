-- ============================================================
-- 完了お知らせの既読/未解決フィードバック連携 (2026-09-14)
--
-- 背景: 完了お知らせは店舗側に見せるだけで、店舗が実際に確認したかが
-- 運営側から分からなかった。また、直っていなかった場合に店舗がその場で
-- 追加の要望・不具合を送れる導線もなかった。
--
-- - feedback_notices.acknowledged_at: 店舗が「完了しました」を押した日時。
--   nullのままなら未確認としてバッジに数字を出す対象になる。
-- - feedback.related_feedback_id: 完了お知らせから「まだ直っていない」で
--   追加投稿したフィードバックが、元のどのフィードバックへの追加報告かを表す。
-- ============================================================
ALTER TABLE public.feedback_notices ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz;
COMMENT ON COLUMN public.feedback_notices.acknowledged_at IS '店舗側で「完了しました」を確認した日時。nullは未確認＝バッジ表示対象';

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS related_feedback_id uuid REFERENCES public.feedback(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.feedback.related_feedback_id IS '完了お知らせの「まだ直っていない」から追加投稿された場合、元のフィードバックID';

-- 店舗側(anon)が完了お知らせを確認済みにできるようにする。
-- feedback_notices の作成は運用側APIのみ（既存方針どおり）で、
-- ここでは既読フラグの更新だけを許可する。
DROP POLICY IF EXISTS "feedback_notices_anon_update" ON public.feedback_notices;
CREATE POLICY "feedback_notices_anon_update" ON public.feedback_notices
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
