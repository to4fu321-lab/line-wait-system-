-- 予約枠をシンプルな「枠の長さ × 時間ごとの枠数」方式にする
--
-- これまでは採寸メニュー(reservation_settings)ごとに所要時間・受付時間帯・
-- 曜日別枠数を持たせ、お客様が選んだメニューによって枠の刻みが変わる作りだった。
-- 運用上はそこまでの細かさが不要で、設定も予約導線も複雑になっていたため、
--   ・枠の長さは店舗でひとつ（例: 60分）
--   ・枠数は「既定値」＋「日付ごと」＋「日付×時間ごと」の上書き
-- に置き換える。

-- 店舗ごとの枠の長さと既定の枠数
alter table public.stores
  add column if not exists reservation_slot_min int not null default 60,
  add column if not exists reservation_slot_capacity int not null default 1;

comment on column public.stores.reservation_slot_min is
  '予約枠の長さ(分)。この単位で受付時間を刻む。';
comment on column public.stores.reservation_slot_capacity is
  '1枠あたりの既定の受付可能数。日付・時間ごとの上書きが無い枠に使う。';

-- stores はカラム単位GRANT方式。読み取り(お客様の予約画面)と
-- 書き込み(店舗スタッフの設定画面)の両方に権限が要る。
GRANT SELECT (reservation_slot_min, reservation_slot_capacity)
  ON public.stores TO anon, authenticated;
GRANT UPDATE (reservation_slot_min, reservation_slot_capacity)
  ON public.stores TO authenticated;

-- 日付×時間ごとの枠数の上書き
create table if not exists public.reservation_slot_overrides (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  date       date not null,
  start_time text not null,          -- 'HH:MM'
  capacity   int  not null default 0,
  created_at timestamptz not null default now(),
  unique (store_id, date, start_time)
);

create index if not exists reservation_slot_overrides_store_date_idx
  on public.reservation_slot_overrides (store_id, date);

alter table public.reservation_slot_overrides enable row level security;

-- お客様の予約画面が空き枠を出すために読む必要がある
drop policy if exists reservation_slot_overrides_anon_select on public.reservation_slot_overrides;
create policy reservation_slot_overrides_anon_select
  on public.reservation_slot_overrides for select to anon using (true);

drop policy if exists reservation_slot_overrides_auth_select on public.reservation_slot_overrides;
create policy reservation_slot_overrides_auth_select
  on public.reservation_slot_overrides for select to authenticated using (true);

-- 書き換えは自店舗のスタッフのみ
drop policy if exists reservation_slot_overrides_staff_insert on public.reservation_slot_overrides;
create policy reservation_slot_overrides_staff_insert
  on public.reservation_slot_overrides for insert to authenticated
  with check (is_staff_of(store_id));

drop policy if exists reservation_slot_overrides_staff_update on public.reservation_slot_overrides;
create policy reservation_slot_overrides_staff_update
  on public.reservation_slot_overrides for update to authenticated
  using (is_staff_of(store_id)) with check (is_staff_of(store_id));

drop policy if exists reservation_slot_overrides_staff_delete on public.reservation_slot_overrides;
create policy reservation_slot_overrides_staff_delete
  on public.reservation_slot_overrides for delete to authenticated
  using (is_staff_of(store_id));

GRANT SELECT ON public.reservation_slot_overrides TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.reservation_slot_overrides TO authenticated;
