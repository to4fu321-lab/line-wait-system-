# stores テーブルの anon 権限を最小化（適用済み）

**ステータス: 2026-07-05 に Supabase 本番プロジェクト（`ffbixfbddxguhdhayqqy`）に適用済み。**

## 背景

アプリ側は `/api/admin/verify-pin`（service-role でPINを照合）に切り替え済みだったが、
DB側の権限確認で、想定より重大な問題が見つかった。

### 発見した問題

`stores` テーブルの RLS ポリシーを確認したところ、以下の2つが存在していた:

| ポリシー名 | 対象 | コマンド | USING | WITH CHECK |
|---|---|---|---|---|
| `anon select stores` | anon | SELECT | `true` | - |
| `stores_anon_update` | anon | **ALL**（SELECT/INSERT/UPDATE/DELETE） | `true` | `true` |

かつテーブル権限（GRANT）でも `anon` / `authenticated` に
`SELECT, INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES` が
テーブル全体に付与されていた。

これは **RLSが実質機能しておらず、公開されている anon キーを持つ人なら誰でも
`stores` テーブルの任意行を無条件に SELECT / INSERT / UPDATE / DELETE できる**
状態だったことを意味する。つまり:
- 任意店舗の `pin` を直接読み取れる（当初の懸念）
- 任意店舗の `pin` を直接**書き換えられる**（PINをサーバー側でどれだけ厳密に
  照合しても、直接UPDATEされれば無意味）
- `features` JSONB 内の `owner_pin` も同様に書き換え可能
- 店舗行そのものを削除できる

### コード監査

クライアント側（ブラウザ、anon キー使用）で実際に行っている `stores` への
書き込みを全数調査した結果、以下の6カラムへの UPDATE のみで、
INSERT / DELETE は一切使われていないことを確認した:

- `school_names`（admin/master/page.tsx）
- `timecard_settings`（shifts/_components/AttendanceTab.tsx）
- `staff_link_code`（admin/settings/kantan/page.tsx）
- `takeout_settings`（takeout-admin/page.tsx）
- `allow_remote`, `business_hours`（admin/settings/staff/page.tsx）

## 適用したSQL

```sql
REVOKE ALL PRIVILEGES ON public.stores FROM anon, authenticated;

GRANT SELECT (
  id, group_id, name, is_open, wait_thresholds, notice_threshold,
  allow_remote, created_at, business_type, takeout_settings, business_hours,
  features, store_type, school_names, line_official_id, order_schedule,
  notification_plan, push_settings, alert_days_repair, alert_days_purchase,
  repair_notes, welcome_message, notice_text, is_test_mode, active_fittings,
  staff_link_code, timecard_settings, tax_rate, tax_inclusive
) ON public.stores TO anon, authenticated;

GRANT UPDATE (
  school_names, timecard_settings, staff_link_code, takeout_settings,
  allow_remote, business_hours
) ON public.stores TO anon, authenticated;
```

`pin` は SELECT・UPDATE どちらの許可リストからも除外。INSERT / DELETE /
TRUNCATE / TRIGGER / REFERENCES は完全に剥奪（クライアント側で使用実績なし）。

適用後、`information_schema.role_column_grants` / `role_table_grants` で
以下を確認済み:
- `anon` / `authenticated` の SELECT 許可カラムに `pin` が含まれない
- `anon` / `authenticated` の UPDATE 許可カラムが上記6カラムのみ
- `anon` / `authenticated` のテーブルレベル権限（INSERT/DELETE等）が0件

## 既知の残課題 → 2026-07-05 に恒久対応済み

**この文書の残課題は `supabase/migrations/20260705_rls_production_hardening.sql`
で全て解消した。詳細は `docs/migrations/2026-07-05-rls-production-hardening.md`
を参照。** 以下は当時の記録として残す。

- ~~**`features` の `owner_pin` が anon から読み取り可能**~~
  → `stores.owner_pin_hash` 列へ bcrypt ハッシュで移送し、`features` からキーを
  削除。照合は `verify_store_pin`(service_role 専用 RPC)で行う。
- ~~**他テーブルの緩い anon ポリシーの横展開確認**~~
  → 全 public テーブルのポリシーを再構築。anon は公開マスタの SELECT のみ、
  スタッフ操作は Supabase Auth の JWT(`app_metadata.store_id`)で自店舗に限定。
