-- ============================================================
-- repair-photos バケットの storage.objects ポリシー欠落を修正 (2026-07-10)
--
-- 背景: repair-photos バケットは public: true で作成されていたが、
-- storage.objects 側の RLS ポリシーが1件も存在しなかった(RLSは有効・
-- ポリシー0件=全拒否)。そのため受付写真・完了写真のアップロードが
-- ずっと拒否されており、実際に保存された写真は0件だった。
-- (feedback-images バケット追加時の調査で判明)
-- ============================================================

DROP POLICY IF EXISTS "repair_photos_insert" ON storage.objects;
CREATE POLICY "repair_photos_insert" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'repair-photos');

DROP POLICY IF EXISTS "repair_photos_select" ON storage.objects;
CREATE POLICY "repair_photos_select" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'repair-photos');

DROP POLICY IF EXISTS "repair_photos_delete" ON storage.objects;
CREATE POLICY "repair_photos_delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'repair-photos');
