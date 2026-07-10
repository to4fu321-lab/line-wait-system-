-- ============================================================
-- 学校マスタに基本情報(住所・電話番号)を追加 (2026-07-10)
--
-- 着用規定・特記事項(wearing_regulations/special_notes等)は既存の
-- OCR取込機能で列自体は存在していたが、手動編集画面が無かった。
-- 今回、学校情報タブから住所・電話番号も含めて直接編集できるようにする。
-- ============================================================

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS tel     text;

NOTIFY pgrst, 'reload schema';
