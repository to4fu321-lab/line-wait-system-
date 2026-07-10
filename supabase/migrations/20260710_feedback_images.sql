-- ============================================================
-- フィードバックへの画像添付 (2026-07-10)
--
-- 背景: 不具合・要望の投稿にスクリーンショット等を添付できるようにする。
-- GitHub Issues の REST API はバイナリ添付を受け付けないため、画像は
-- Supabase Storage(公開バケット)にアップロードし、URLをMarkdown画像
-- として Issue本文に埋め込む方式にする。
--
-- 注記: repair-photos バケットには storage.objects の RLS ポリシーが
-- 存在せず(RLS有効・ポリシー0件)、アップロードが常に拒否される状態
-- だったことが判明した(別件で要修正)。本バケットではその不備を踏まえ、
-- 最初から明示的にポリシーを作成する。
-- ============================================================

ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS image_urls text[] DEFAULT '{}';

INSERT INTO storage.buckets (id, name, public)
VALUES ('feedback-images', 'feedback-images', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "feedback_images_insert" ON storage.objects;
CREATE POLICY "feedback_images_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'feedback-images');

DROP POLICY IF EXISTS "feedback_images_select" ON storage.objects;
CREATE POLICY "feedback_images_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'feedback-images');

NOTIFY pgrst, 'reload schema';
