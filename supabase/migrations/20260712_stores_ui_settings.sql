-- ============================================================
-- 店舗単位の画面設定（シンプルモード・大きい文字）
-- 形式: { "simple_mode": boolean, "large_text": boolean }
-- 従来 localStorage 保存だったシンプルモードを全端末共通にする
-- ============================================================

ALTER TABLE public.stores
  ADD COLUMN IF NOT EXISTS ui_settings jsonb;

-- stores はカラム単位GRANT方式のため、クライアントから読み書きする列は
-- 必ず GRANT を同じマイグレーションに書く（20260711_stores_pop_settings_grants.sql と同パターン）
GRANT SELECT (ui_settings) ON public.stores TO anon, authenticated;
GRANT UPDATE (ui_settings) ON public.stores TO authenticated;

NOTIFY pgrst, 'reload schema';
