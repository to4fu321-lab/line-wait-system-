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

## 2. インストール & 起動

```bash
cd line-queue-system
npm install
npm run dev
```

- お客様画面: http://localhost:3000
- スタッフ管理画面: http://localhost:3000/admin（PIN: 1234）

## 3. LIFF Endpoint URL の更新

`.env.local` の値は設定済みですが、**LIFF Endpoint URL** を環境に合わせて変更する必要があります。

### ローカル開発時
1. [ngrok](https://ngrok.com/) で `localhost:3000` を公開
   ```bash
   ngrok http 3000
   ```
2. 発行された https URL を LINE Developers Console の LIFF Endpoint URL に設定

### 本番デプロイ後
1. Vercel等にデプロイ
2. 本番URLを LIFF Endpoint URL に設定

> ⚠️ LIFF Endpoint URL は **https のみ** 受け付けます

## 4. QRコード設置

LINE Developers Console の LIFF タブにある **LIFF URL** (`https://liff.line.me/2010126882-aUahQStD`) のQRコードを店頭に掲示。お客様はLINEアプリで読み取って受付フォームを開きます。

LINEアプリ内ブラウザで開くと:
- ✅ LINE User ID を自動取得
- ✅ 氏名がプリフィル
- ✅ 呼出時にPush通知が届く

外部ブラウザ（QRコードを直接読み取りなど）で開くと:
- フォームから手動入力
- 画面上で待機状況を確認

## 5. 動作確認の流れ

1. ブラウザで http://localhost:3000 を開く（フォーム表示）
2. 適当に入力して「受付する」
3. 別タブで http://localhost:3000/admin を開く（PIN: 1234）
4. 「呼出」ボタンを押す → お客様画面が黄色に変わる
5. （LIFF経由なら）LINEにメッセージが届く

## ファイル構成

```
line-queue-system/
├── sql/schema.sql              ← Supabaseで実行
├── lib/
│   ├── supabase.ts
│   └── liff.ts                 ← LIFF初期化
├── types/database.ts
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                ← お客様用（LIFF統合済み）
│   ├── admin/page.tsx          ← スタッフ用
│   └── api/notify/route.ts     ← LINE Push送信
└── .env.local                  ← 環境変数（コミット禁止）
```
