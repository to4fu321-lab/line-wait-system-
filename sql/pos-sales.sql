-- ============================================================================
--  簡易レジ（POS）: 会計(sales) と 明細(sale_items) ＋ 店舗の税設定
--  2026-06  Claude Code
--  Supabase SQL Editor で実行してください（追加のみ・既存データ非破壊）。
-- ============================================================================

-- 会計（レシート1枚 = sales 1行）
create table if not exists public.sales (
  id            uuid primary key default gen_random_uuid(),
  store_id      uuid not null,
  sale_number   text,                          -- 例: 20260623-001
  staff_id      uuid,
  customer_id   uuid,
  child_id      uuid,
  subtotal      integer not null default 0,    -- 税抜
  tax           integer not null default 0,    -- 消費税額
  total         integer not null default 0,    -- 税込合計
  tax_rate      numeric not null default 10,   -- 適用税率(スナップショット)
  tax_inclusive boolean not null default true, -- 内税/外税(スナップショット)
  payment_method text not null default 'cash', -- cash|credit|qr|emoney|voucher|other
  cash_received integer,                        -- 現金時の預かり
  change        integer,                        -- 現金時のおつり
  status        text not null default 'completed', -- completed|voided
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_sales_store_created on public.sales(store_id, created_at desc);

-- 会計明細
create table if not exists public.sale_items (
  id          uuid primary key default gen_random_uuid(),
  sale_id     uuid not null references public.sales(id) on delete cascade,
  store_id    uuid not null,
  source_type text not null default 'manual', -- product|repair|order|manual
  source_id   uuid,                            -- 取り込み元(お直し/注文/商品)のID
  name        text not null,
  unit_price  integer not null default 0,
  qty         integer not null default 1,
  line_total  integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_sale_items_sale on public.sale_items(sale_id);

-- 店舗の税設定（既存マスタは税込価格運用のため既定は内税10%）
alter table public.stores add column if not exists tax_rate      numeric not null default 10;
alter table public.stores add column if not exists tax_inclusive boolean not null default true;

-- RLS（既存テーブルと同じく anon 許可ポリシー）
alter table public.sales      enable row level security;
alter table public.sale_items enable row level security;
do $pos$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sales' and policyname='sales_anon_all') then
    create policy sales_anon_all on public.sales for all to anon using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='sale_items' and policyname='sale_items_anon_all') then
    create policy sale_items_anon_all on public.sale_items for all to anon using (true) with check (true);
  end if;
end $pos$;
