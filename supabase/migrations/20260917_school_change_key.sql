-- 学校変更パスキー
--
-- お客様がLINEのネット注文画面から在籍校を自由に切り替えられると、
-- 取扱いのない学校の商品を見に行ったり、進学していないのに学年・学校を
-- 書き換えてしまう事故が起きる。店舗だけが知っている合言葉を入れた
-- ときだけ変更できるようにする。
--
-- ⚠️ この列には anon / authenticated への GRANT を付けないこと。
--    stores はカラム単位GRANT方式で、付けるとお客様の端末から
--    パスキーそのものを読めてしまい、鍵の意味が無くなる。
--    照合は service role を使うサーバーAPI（/api/school-change-key/verify）
--    だけで行う。
--
-- 参考: supabase/migrations/20260705_rls_production_hardening.sql は
--       「その時点で存在した列」にだけ GRANT を付けているため、
--       あとから足したこの列は既定で非公開のままになる。

alter table public.stores
  add column if not exists school_change_key text;

comment on column public.stores.school_change_key is
  'ネット注文画面で在籍校を変更するときにお客様へ入力してもらう合言葉。店舗のみが知る。anonへのGRANT禁止（サーバーAPIでのみ照合する）。';
