-- ============================================================
-- 現場フィードバック（要望・不具合・質問）
--   アプリ内のフィードバックボタンから anon で投稿。
--   閲覧/更新は運用側API（assertSuperAdmin）経由のみ想定。
-- ============================================================
CREATE TABLE IF NOT EXISTS public.feedback (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id    uuid,
  store_name  text,
  kind        text NOT NULL DEFAULT 'request',  -- request | bug | question
  body        text NOT NULL,
  page_url    text,
  user_agent  text,
  status      text NOT NULL DEFAULT 'new',       -- new | triaged | done | wontfix
  issue_number integer,                            -- 自動作成された GitHub Issue 番号
  issue_url    text,                               -- 同 URL
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS issue_number integer;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS issue_url    text;
CREATE INDEX IF NOT EXISTS idx_feedback_status_created ON public.feedback(status, created_at DESC);

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "feedback_anon_all" ON public.feedback;
CREATE POLICY "feedback_anon_all" ON public.feedback FOR ALL TO anon USING (true) WITH CHECK (true);

COMMENT ON TABLE public.feedback IS '現場からの要望・不具合・質問。アプリ内フィードバックボタンから投稿';
NOTIFY pgrst, 'reload schema';
