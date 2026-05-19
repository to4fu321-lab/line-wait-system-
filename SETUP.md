# LINE 順番待ちシステム - セットアップ手順

## ✅ 現在の設定状況

| 項目 | 状態 |
|------|------|
| LINE Channel Access Token | ✅ `.env.local` に設定済み |
| LIFF ID | ✅ `2010126882-aUahQStD` 設定済み |
| Supabase | ⏳ 要設定 |

## ⚠️ セキュリティ警告

チャットで共有された Channel Access Token は LINE Developers Console から **再発行**してください。
- Messaging API タブ > Channel access token (long-lived) > **Reissue**
- 新しいトークンを `.env.local` の `LINE_CHANNEL_ACCESS_TOKEN` に貼り替え

---

## 1. Supabase の準備

1. [supabase.com](https://supabase.com) で新規プロジェクトを作成
2. **SQL Editor** を開き、`sql/schema.sql` をペースト → 実行
3. **Database > Replication** で `queues` テーブルのリアルタイムを **ON**
4. **Settings > API** から URL と anon key を取得
5. `.env.local` の以下を埋める:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

### 店舗IDの確認

スキーマ実行後、`stores` テーブルに2件のサンプルが作成されます。

```sql
SELECT id, name FROM stores;
```

この `id`（UUID）がURLになります。実際の店舗名・PINに変更してください：

```sql
UPDATE stores SET name = '実際の店舗名', pin = '新しいPIN' WHERE id = '...';
```

新しい店舗を追加する場合：

```sql
INSERT INTO stores (group_id, name, pin)
VALUES ('グループID', '新店舗名', '1234');
```

---

## 2. インストール & 起動

```bash
npm install
npm run dev
```

- お客様画面: `http://localhost:3000/<store_id>`
- スタッフ管理画面: `http://localhost:3000/<store_id>/admin`

---

## 3. LIFF Endpoint URL の設定（多店舗対応）

LIFF のサブパス機能を利用します。**LIFF Endpoint URL にルートURLだけを設定**すると、
`https://liff.line.me/LIFF_ID/<store_id>` が `https://your-domain.com/<store_id>` に自動変換されます。

### ローカル開発時

1. [ngrok](https://ngrok.com/) で `localhost:3000` を公開
   ```bash
   ngrok http 3000
   ```
2. LINE Developers Console > LIFF > **Endpoint URL** に ngrok の https URL（ルートのみ）を設定
   - 例: `https://xxxx.ngrok.io`（末尾にパス不要）

### 本番デプロイ後

1. Vercel にデプロイ
2. LIFF Endpoint URL を本番ドメイン（ルート）に設定
   - 例: `https://your-app.vercel.app`

---

## 4. 店舗ごとのQRコード作成

各店舗のお客様用URLは以下の形式です：

```
https://liff.line.me/2010126882-aUahQStD/<store_id>
```

このURLのQRコードを各店舗に掲示してください。
LINEアプリで読み取ると自動的に該当店舗の受付フォームが開きます。

---

## 5. LINE プッシュ通知の動作確認

管理画面で「呼出」ボタンを押すと：
1. Supabase でステータスが `calling` に更新
2. `/api/notify` が叩かれ、LINE Messaging API 経由でプッシュ通知送信
3. 通知メッセージに店舗名・整理番号・氏名が含まれる

通知が届かない場合の確認事項：
- `.env.local` の `LINE_CHANNEL_ACCESS_TOKEN` が有効か
- お客様がLIFF経由で受付したか（`line_user_id` が取得できているか）
- Vercel の Function Logs でエラーを確認

---

## 6. 動作確認の流れ

1. `http://localhost:3000/<store_id>` を開く（フォーム表示）
2. 適当に入力して「受付する」
3. 別タブで `http://localhost:3000/<store_id>/admin` を開く（PINを入力）
4. 「呼出」ボタンを押す → お客様画面が黄色に変わる
5. （LIFF経由なら）LINEにメッセージが届く

---

## ファイル構成

```
line-queue-system/
├── sql/schema.sql                  ← Supabaseで実行（groups・stores・queues）
├── lib/
│   ├── supabase.ts
│   └── liff.ts                     ← LIFF初期化・友達チェック
├── types/database.ts               ← Group・Store・Queue型定義
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                    ← ランディングページ
│   ├── [storeId]/
│   │   ├── page.tsx                ← お客様用（LIFF統合・友達登録フロー）
│   │   └── admin/page.tsx          ← スタッフ用（店舗別PIN認証）
│   └── api/notify/route.ts         ← LINE Push送信（店舗名付き）
└── .env.local                      ← 環境変数（コミット禁止）
```

## 環境変数一覧

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=

# LINE
LINE_CHANNEL_ACCESS_TOKEN=
NEXT_PUBLIC_LIFF_ID=2010126882-aUahQStD
NEXT_PUBLIC_LINE_BASIC_ID=         # @xxxxx 形式のBasic ID（友達追加用）
```
