-- 予約はシーズン時しか使わないため、1枠の受付数の既定を 0（受付なし）にする。
-- 1 のままだと、設定を触っていない店舗で年中1件ずつ予約が入ってしまう。
-- シーズンを開けるときは 管理画面 → 設定 → 予約枠の設定 で枠数を上げる。
alter table public.stores
  alter column reservation_slot_capacity set default 0;

comment on column public.stores.reservation_slot_capacity is
  '1枠あたりの既定の受付数。0で受付なし（シーズン外の既定）。日付・時間ごとの上書きは reservation_slot_overrides 側で行う';

-- 旧既定値(1)のまま放置されている店舗は、意図した設定ではないので受付なしに寄せる。
-- 2件以上を明示的に設定している店舗はそのまま残す。
update public.stores
   set reservation_slot_capacity = 0
 where reservation_slot_capacity = 1;

-- 列は 20260918_reservation_slots_simplify.sql で GRANT 済みのため、ここでは追加不要
