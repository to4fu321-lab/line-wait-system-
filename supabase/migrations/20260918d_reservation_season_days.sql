-- 予約シーズンを「月」から「月日」で指定できるようにする。
--
-- 実際の採寸期間は「2月1日から3月15日まで」のように日で決まるため、
-- 月単位だと前後に半月ぶんのズレが出る。
-- 開始日・終了日を足して、月日で判定できるようにする。
--
-- 月だけで設定していた既存の行は、日が null のまま
--   開始 = その月の1日 / 終了 = その月の末日
-- として読む（アプリ側 _lib/season.ts の seasonFromRow）。
-- 設定画面から保存し直すと日が入る。

alter table public.stores
  add column if not exists reservation_season_from_day int,
  add column if not exists reservation_season_to_day int;

comment on column public.stores.reservation_season_from_day is
  '予約を受け付ける開始日(1-31)。null なら開始月の1日から';
comment on column public.stores.reservation_season_to_day is
  '予約を受け付ける終了日(1-31)。その日まで受け付ける。null なら終了月の末日まで';

-- 日の値が壊れていると予約画面の判定がおかしくなるので、DB側でも弾いておく
alter table public.stores
  drop constraint if exists stores_reservation_season_days_check;
alter table public.stores
  add constraint stores_reservation_season_days_check check (
    (reservation_season_from_day is null or reservation_season_from_day between 1 and 31)
    and
    (reservation_season_to_day is null or reservation_season_to_day between 1 and 31)
  );

-- stores はカラム単位GRANT方式。
-- GRANT が漏れるとお客様の予約画面の SELECT がクエリごと失敗するので必ず書く。
GRANT SELECT (reservation_season_from_day, reservation_season_to_day)
  ON public.stores TO anon, authenticated;

GRANT UPDATE (reservation_season_from_day, reservation_season_to_day)
  ON public.stores TO authenticated;
