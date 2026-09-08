-- ============================================================
-- フィードバック修正完了のお知らせ
--   スーパー管理画面から、フィードバック対応完了時に運用者が任意で
--   店舗へ「直した」ことを知らせるための保存先。
--   store_id が null の行は「全店舗向け」を表す。
--   作成は運用側API（service role）のみ。店舗の管理画面（anon）は閲覧のみ。
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feedback_notices (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id uuid REFERENCES public.feedback(id) ON DELETE SET NULL,
  store_id    uuid,               -- null = 全店舗向け
  message     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_feedback_notices_store_created
  ON public.feedback_notices(store_id, created_at DESC);

ALTER TABLE public.feedback_notices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feedback_notices_anon_select" ON public.feedback_notices;
CREATE POLICY "feedback_notices_anon_select" ON public.feedback_notices
  FOR SELECT TO anon USING (true);

COMMENT ON TABLE public.feedback_notices IS 'フィードバック修正完了のお知らせ（store_id=nullは全店舗向け）。作成は運用側APIのみ';
NOTIFY pgrst, 'reload schema';
