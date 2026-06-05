# line-wait-system — 開発ガイド

## 開発体制

**Claude Code がすべてのファイルを担当します。**
AntiGravity は補助的に使用することがありますが、基本的には Claude Code がメインで開発を進めます。

## ブランチ運用

特に指定がない限り、**`main` ブランチに直接コミット・プッシュ**してください。
フィーチャーブランチを使う場合は、その都度明示的に指定します。

---

## 作業開始前に必ず行うこと

```bash
# 1. 最新を取得
git pull origin main

# 2. 作業中のタスクを確認
cat WORKING.md
```

`WORKING.md` に作業中のエントリがある場合は、**完了してから次の作業を開始**してください。

---

## 作業開始時

`WORKING.md` に「触るファイルを全列挙」してからコミット・プッシュしてください。

```bash
# WORKING.md に追記する形式（ファイルパスを必ず列挙）
# - [Claude Code] app/[storeId]/admin/page.tsx, app/api/xxx/route.ts — 機能名 (YYYY-MM-DD HH:MM)
git add WORKING.md && git commit -m "wip: 〇〇 開始" && git push origin main
```

---

## 作業完了時

変更をコミット・プッシュした後、`WORKING.md` から自分の行を削除してください。

```bash
git add . && git commit -m "fix: ○○を修正" && git push origin main
```

---

## 担当ファイル

Claude Code がすべてのファイルを担当します。

| カテゴリ | ファイル・ディレクトリ |
|---|---|
| フロントエンド（画面） | `app/[storeId]/**/*.tsx` `app/*/page.tsx` `globals.css` |
| バックエンド（API） | `app/api/**` |
| 型定義・ライブラリ | `types/` `lib/` |
| 設定・インフラ | `middleware.ts` `next.config.*` `vercel.json` |

---

## 技術スタック

- **Framework**: Next.js 14.2 (App Router)
- **DB**: Supabase (PostgreSQL + Realtime)
- **認証**: LINE LIFF v2.25
- **デプロイ**: Vercel（`main` ブランチへの push で自動デプロイ）
- **スタイル**: Tailwind CSS

## 環境変数

`.env.local.example` を参照。Supabase の接続情報はコード内にフォールバック値あり。
LINE通知を使う場合は `LINE_CHANNEL_ACCESS_TOKEN` が必要。

## Supabase

- プロジェクト: `ffbixfbddxguhdhayqqy.supabase.co`
- 新しいステータス値を追加する際は Supabase SQL Editor でマイグレーションが必要

## デプロイ

`main` ブランチへ push すると Vercel が自動デプロイします。
ローカルでの動作確認後に push してください。
