-- ============================================================
-- staff session トークンキャッシュ (2026-07-08)
--
-- 背景:
--   PIN照合成功後に毎回 Supabase Auth Admin API
--   (createUser→generateLink→verifyOtp) をフル実行しており、
--   直列の外部HTTPラウンドトリップ(3〜4回)で1〜2秒の遅延が生じていた。
--   店舗ごとに1つの Auth ユーザー(store-<storeId>@staff.local)であり、
--   発行されるセッションの中身(app_metadata.store_id)は店舗内で不変
--   なため、有効期限内は同じトークンを使い回して安全に高速化できる。
--
-- 方針:
--   stores にセッションキャッシュ列を追加。pin / owner_pin_hash と
--   全く同じ「service_role専用・anon/authenticated不可視」の保護を
--   適用する。列GRANTの静的算出(20260705マイグレーション)は新規列を
--   自動対象化しないため実害は無いが、意図を明文化するため明示 REVOKE。
--
-- 冪等: 再実行しても安全なように書いてある。
-- ============================================================

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS staff_session_access_token  text,
  ADD COLUMN IF NOT EXISTS staff_session_refresh_token text,
  ADD COLUMN IF NOT EXISTS staff_session_expires_at    timestamptz;

-- 自己文書化: pin/owner_pin_hash と同じ扱いであることを明示する。
-- (新規列は元々 anon/authenticated に GRANT されていないため実質no-opだが、
--  将来この3列を anon/authenticated 向けの一括GRANT文が誤って含めて
--  しまわないよう、意図をコードとして残す)
REVOKE ALL (staff_session_access_token, staff_session_refresh_token, staff_session_expires_at)
  ON public.stores FROM anon, authenticated;

NOTIFY pgrst, 'reload schema';
