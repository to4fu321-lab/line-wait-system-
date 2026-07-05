-- ============================================================
-- フィードバックのAIトリアージ・自動実装承認フロー
--   送信時にAIが優先度・分類・対応方針を判定して記録する。
--   運用者が承認するとGitHub Issueに approved-for-autofix ラベルが付き、
--   GitHub Actions（feedback-autofix.yml）が実装・PR作成まで自動で行う。
-- ============================================================
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS priority text
  CHECK (priority IN ('urgent','high','medium','low'));
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS ai_category text;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS ai_recommendation text;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS ai_implementable boolean;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS approved_by text;

COMMENT ON COLUMN public.feedback.priority IS 'AIが判定した優先度（urgent/high/medium/low）';
COMMENT ON COLUMN public.feedback.ai_category IS 'AIによる分類（軽微な修正・機能追加・要設計判断・質問対応など）';
COMMENT ON COLUMN public.feedback.ai_recommendation IS 'AIによる原因推定・対応方針の提案文';
COMMENT ON COLUMN public.feedback.ai_implementable IS 'AIが軽微・安全と判断し自動実装候補としたか';
COMMENT ON COLUMN public.feedback.approved_at IS '運用者が実装を承認した日時。承認するとGitHub Issueにapproved-for-autofixラベルが付与され自動実装フローが走る';
COMMENT ON COLUMN public.feedback.approved_by IS '承認した運用者の識別子';

NOTIFY pgrst, 'reload schema';
