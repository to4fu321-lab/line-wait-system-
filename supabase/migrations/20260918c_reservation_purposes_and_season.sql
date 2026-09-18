-- 予約の「来店理由」と「シーズン（予約を受け付ける時期）」を店舗ごとに設定できるようにする。
--
--  ・来店理由 …… これまではコードに直書き（採寸／お直し／その他）だったが、
--                 店舗によって採寸の種類が違うため、設定画面から足せるようにする。
--                 null のままの店舗には既定の3つ（制服採寸／制服＋ジャージ採寸／ジャージ採寸）を使う。
--  ・シーズン …… 制服の採寸は入学期に集中するので、それ以外の時期は予約を受けず
--                 「直接ご来店かお問い合わせください」と案内したい。

alter table public.stores
  add column if not exists reservation_purposes jsonb,
  add column if not exists reservation_season_enabled boolean not null default false,
  add column if not exists reservation_season_from_month int,
  add column if not exists reservation_season_to_month int,
  add column if not exists reservation_offseason_message text;

comment on column public.stores.reservation_purposes is
  '予約の来店理由。[{key,label,emoji,serviceType}] の配列。null なら既定の3つを使う';
comment on column public.stores.reservation_season_enabled is
  'true のとき、シーズン外（from_month〜to_month の範囲外）は予約を受け付けず案内文を出す';
comment on column public.stores.reservation_season_from_month is
  '予約を受け付ける開始月(1-12)。to_month より大きい場合は年をまたぐ期間として扱う（例: 11〜3月）';
comment on column public.stores.reservation_season_to_month is
  '予約を受け付ける終了月(1-12)。この月の末日まで受け付ける';
comment on column public.stores.reservation_offseason_message is
  'シーズン外にお客様の予約画面へ出す案内文。未設定なら既定文';

-- 月の値が壊れていると予約画面の判定がおかしくなるので、DB側でも弾いておく
alter table public.stores
  drop constraint if exists stores_reservation_season_months_check;
alter table public.stores
  add constraint stores_reservation_season_months_check check (
    (reservation_season_from_month is null or reservation_season_from_month between 1 and 12)
    and
    (reservation_season_to_month is null or reservation_season_to_month between 1 and 12)
  );

-- stores はカラム単位GRANT方式。
-- GRANT が漏れるとお客様の予約画面の SELECT がクエリごと失敗するので必ず書く。
GRANT SELECT (
  reservation_purposes,
  reservation_season_enabled,
  reservation_season_from_month,
  reservation_season_to_month,
  reservation_offseason_message
) ON public.stores TO anon, authenticated;

GRANT UPDATE (
  reservation_purposes,
  reservation_season_enabled,
  reservation_season_from_month,
  reservation_season_to_month,
  reservation_offseason_message
) ON public.stores TO authenticated;
