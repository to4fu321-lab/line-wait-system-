# stores.pin / owner_pin のクライアント露出を止めるマイグレーション

## 背景

これまで管理画面は `stores.pin` を anon キーで SELECT してクライアント側で
PIN を照合していた。アプリ側は `/api/admin/verify-pin`（service-role でサーバー照合）
に切り替え済みだが、**DB 側の権限を絞らない限り、anon キーを使えば誰でも
Supabase REST API 経由で全店舗の PIN を読める状態が残る**。

このマイグレーションを Supabase SQL Editor で実行して、anon ロールから
`pin` カラムの SELECT 権限を剥奪する。

## 事前確認

- アプリが `dev` 環境で `/api/admin/verify-pin` 経由のログインに切り替わっていること
- クライアントコードに `.from('stores').select(...pin...)` が残っていないこと
  （`grep -rn "select('.*pin" app lib` で確認。2026-07-04 時点で残存なし）

## SQL

```sql
-- anon / authenticated から pin カラムの SELECT を剥奪する。
-- カラム単位の GRANT に切り替えるため、まずテーブル全体の SELECT を落とし、
-- pin 以外のカラムを明示的に許可し直す。
-- ※ カラムリストは実際のスキーマに合わせて調整すること
--    (SELECT column_name FROM information_schema.columns WHERE table_name = 'stores')

REVOKE SELECT ON public.stores FROM anon, authenticated;

GRANT SELECT (
  id, group_id, name, is_open, wait_thresholds, notice_threshold,
  allow_remote, remote_threshold, business_type, takeout_settings,
  business_hours, notification_plan, is_test_mode, timecard_settings,
  features, welcome_message, staff_link_code, created_at
) ON public.stores TO anon, authenticated;
```

## 注意

- `features` JSON 内の `owner_pin` はカラム権限では隠せない。恒久対応として
  `owner_pin` を `stores.owner_pin` カラム（または別テーブル）に移し、
  同様に SELECT 権限から外すことを推奨。アプリ側の照合
  （`lib/auth/storeAuth.ts` の `verifyStorePin`）は service-role なので影響なし。
- カラム権限を絞ると、anon からの `select=*` は PostgREST のバージョンに
  よってはエラーになる。クライアントに `.from('stores').select('*')` が
  残っていないことを必ず確認してから実行する。
- 実行後、スマホ実機で PIN ログイン → 各管理画面 → OCR（slip-ocr）まで
  ひと通り動作確認すること。
