-- ============================================================
-- stores.pop_settings / queue_pop_settings のカラムGRANT追加 (2026-07-11)
--
-- 背景: stores は 20260705_rls_production_hardening で「カラム単位の
-- GRANT で許可列を明示する」方式に変わったが、その許可リストは
-- 実行時点のカラム一覧のスナップショットで作られる。そのため後から
-- 追加された pop_settings(友だち登録POP)・queue_pop_settings
-- (順番待ちQR POP)には権限が無く、POP編集画面のSELECTがカラム権限
-- エラーでクエリごと失敗し、店名すら表示されない状態だった。
--
-- ※今後 stores に「クライアントから読み書きする列」を追加する際は、
--   必ずこのようなGRANT文をマイグレーションに含めること。
-- ============================================================

GRANT SELECT (pop_settings, queue_pop_settings) ON public.stores TO anon, authenticated;
GRANT UPDATE (pop_settings, queue_pop_settings) ON public.stores TO authenticated;

NOTIFY pgrst, 'reload schema';
