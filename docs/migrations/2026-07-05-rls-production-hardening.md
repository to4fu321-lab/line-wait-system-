# RLS 本番セキュリティ再構築（2026-07-05）

`supabase/migrations/20260705_rls_production_hardening.sql`

## 背景

開発時の「anon 全許可（`USING(true)` の `ALL` ポリシー）」設定が本番にもそのまま
適用され、公開されている anon キーを持つ人なら誰でも REST API 経由で全テーブルを
SELECT / INSERT / UPDATE / DELETE できる状態だった（64テーブル中63テーブル）。
顧客の氏名・電話・LINE ID・採寸データなどの個人情報も全件閲覧可能だった。

## 方針

1. **スタッフ認可を Supabase Auth に移行**（PIN ログイン UX は維持）。
   PIN 照合成功後にサーバーが Supabase Auth セッションを発行し、JWT の
   `app_metadata.store_id` を RLS 判定に使う。管理画面・スタッフ画面の
   クライアント直接書き込み（約260箇所）はコード変更不要で、authenticated
   ロールとして自店舗の行のみ操作できる。Realtime も JWT で動作継続。
2. **顧客導線（未ログイン anon）の読み書きは全てサーバー API 経由**に変更。
   anon には公開マスタ（products/menus/schools 等）の SELECT のみ許可し、
   customers/queues/reservations/takeout/purchase_orders 等の読み書きは
   `createAdminClient`（service_role）を使う新規 API ルートに集約。本人確認は
   LIFF アクセストークンのサーバー検証、自チケット/自注文は UUID を能力
   ベアラーとして扱う。Realtime 購読はポーリングに置換。
3. **PIN の bcrypt ハッシュ化**。`stores.pin` をハッシュ化し、
   `features.owner_pin` は `stores.owner_pin_hash` へ移送。照合は
   `verify_store_pin`（SECURITY DEFINER・service_role 専用）で行う。

## ポリシー分類

| 区分 | テーブル例 | anon | authenticated（スタッフ） |
|---|---|---|---|
| 公開マスタ | products, menus, schools, prices, size_sets, reservation_settings … | SELECT のみ | 自店舗 ALL（`is_staff_of(store_id)`） |
| 顧客/取引 | customers, children, queues, reservations, takeout_orders, sales, purchase_orders, measurements … | 不可 | 自店舗 ALL |
| スタッフ運用 | staff, shifts, time_records, register_sessions … | 不可 | 自店舗 ALL |
| 店舗横断 | shift_help_offers/requests | 不可 | 全スタッフ（`is_staff()`） |
| groups | groups | 不可 | SELECT のみ |
| ocr_jobs | ocr_jobs | 不可 | 不可（service_role のみ） |

`stores` はカラム GRANT で `pin`/`owner_pin_hash` をクライアントから不可視にし、
UPDATE は6列（school_names, timecard_settings, staff_link_code, takeout_settings,
allow_remote, business_hours）に限定。採番 RPC（get_next_ticket_number /
get_next_order_number）は anon の EXECUTE を剥奪した。

## ヘルパー関数

- `public.jwt_store_id()` … JWT `app_metadata.store_id` を uuid で返す
- `public.is_staff_of(uuid)` / `is_staff_of(text)` … authenticated かつ自店舗
- `public.is_staff()` … store_id を持つ authenticated
- `public.verify_store_pin(uuid, text)` … 'owner'/'staff'/NULL（service_role 専用）
- `public.hash_pin(text)` … bcrypt ハッシュ（service_role 専用）

## 前提（本番適用前に必須）

- Vercel に `SUPABASE_SERVICE_ROLE_KEY` が設定されていること（未設定だと
  `lib/supabaseAdmin.ts` が anon にフォールバックし API ルートが RLS で全滅する）。
- Supabase の**パブリックサインアップを無効化**（Dashboard > Authentication >
  Sign In / Providers）。スタッフの Auth ユーザーは service_role のみが作成する。
- 適用前にバックアップ（PITR）を確認。

## 適用状況

- dev（`qvssqbhngpgwotpiuuug`）: 適用済み・検証済み
  - anon: customers/queues/sales/measurements の SELECT/INSERT/UPDATE 全て 0 件 or 拒否
  - anon: products/schools/stores（非pin列）は参照可
  - authenticated（store_id クレーム）: 自店舗の顧客のみ可視、他店舗0件
  - PIN: 全て bcrypt 化・`verify_store_pin` のラウンドトリップ OK
- 本番（`ffbixfbddxguhdhayqqy`）: **未適用**。コードデプロイ完了後に適用する
  （旧コード＋新ポリシーの状態では管理画面が動かないため順序厳守）。

## 検証（dev で実施済み・本番でも同様に行う）

```sql
-- anon は保護テーブルを読めない
SET LOCAL role anon;
SELECT count(*) FROM public.customers;  -- 0

-- スタッフJWTは自店舗のみ
SELECT set_config('request.jwt.claims',
  '{"role":"authenticated","app_metadata":{"store_id":"<STORE_ID>"}}', true);
SET LOCAL role authenticated;
SELECT count(*) FROM public.customers
  WHERE store_id <> '<STORE_ID>';       -- 0
```
