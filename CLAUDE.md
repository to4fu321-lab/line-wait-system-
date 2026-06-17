# line-wait-system — 開発ガイド

## 開発体制

**Claude Code がすべてのファイルを担当します。**
AntiGravity は補助的に使用することがありますが、基本的には Claude Code がメインで開発を進めます。

## ブランチ運用

**`develop` で開発・検証 → 動作確認できたら `main` へマージして本番反映**、の2段運用です。

- **`develop`**: 開発の既定ブランチ。特に指定がない限り、コミット・プッシュは **`develop`** に対して行ってください。
- **`main`**: 本番デプロイ用。`develop` を取り込む形でのみ更新します（直接コミットしない）。
- フィーチャーブランチを使う場合は、その都度明示的に指定します。

### develop → main へ反映（本番デプロイ）する手順

本番に出してよい状態になったら、以下で `main` へマージします（指示があったときのみ実行）。

```bash
git checkout main
git pull origin main
git merge --no-ff develop
git push origin main   # Vercel が main を本番として自動デプロイ
git checkout develop   # 作業ブランチへ戻る
```

---

## 作業開始前に必ず行うこと

```bash
# 1. develop に切り替えて最新を取得
git checkout develop
git pull origin develop

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
git add WORKING.md && git commit -m "wip: 〇〇 開始" && git push origin develop
```

---

## 作業完了時

変更をコミット・プッシュした後、`WORKING.md` から自分の行を削除してください。

```bash
git add . && git commit -m "fix: ○○を修正" && git push origin develop
```

本番へ反映する場合は、上記「develop → main へ反映」の手順でマージしてください。

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
- **デプロイ**: Vercel（`main` への push で本番、`develop` への push でプレビュー環境を自動生成）
- **スタイル**: Tailwind CSS

## 環境変数

`.env.local.example` を参照。Supabase の接続情報はコード内にフォールバック値あり。
LINE通知を使う場合は `LINE_CHANNEL_ACCESS_TOKEN` が必要。

## Supabase

- 本番プロジェクト: `ffbixfbddxguhdhayqqy.supabase.co`
- 開発プロジェクト: `qvssqbhngpgwotpiuuug.supabase.co`（`line-wait-system-dev`）
- 開発時は `.env.local` の `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` を
  **開発プロジェクト**に向けると、本番データを汚さずに検証できます。
- 新しいステータス値を追加する際は Supabase SQL Editor でマイグレーションが必要
  （開発プロジェクトにも同じマイグレーションを適用すること）

## デプロイ

- **`develop`** へ push → Vercel がプレビュー環境を自動生成（ここで動作確認）。
- 確認できたら **`develop` → `main` へマージ** → `main` への push で本番が自動デプロイ。
- ローカルでの動作確認後に push してください。
