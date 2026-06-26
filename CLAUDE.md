# line-wait-system — 開発ガイド

## 開発体制

**Claude Code がすべてのファイルを担当します。**
AntiGravity は補助的に使用することがありますが、基本的には Claude Code がメインで開発を進めます。

---

## ブランチ運用

| ブランチ | 用途 |
|---|---|
| `main` | **本番環境**。Vercel が自動デプロイ。直接 push 禁止。 |
| `dev` | **開発環境**。作業はすべてここで行う。 |

### 基本フロー

```bash
# 開発作業は dev ブランチで行う
git checkout dev
git pull origin dev

# 作業・コミット・push
git add . && git commit -m "feat: ○○を追加" && git push origin dev

# 本番反映したい時だけ main にマージ（必ず確認してから）
git checkout main
git merge dev
git push origin main
```

> **注意**: `main` への直接 push は絶対に行わないこと。必ず `dev` で動作確認してからマージする。

---

## 作業開始前に必ず行うこと

```bash
# 1. リモートブランチ情報を取得
git fetch origin

# 2. dev ブランチに切り替え（必ずこの手順で）
git checkout -b dev origin/dev 2>/dev/null || git checkout dev

# 3. 最新を取得
git pull origin dev

# 4. 作業中のタスクを確認
cat WORKING.md
```

> **重要**: `dev` ブランチが「存在しない」と判断して `claude/` ブランチを作ってはいけません。必ず `git fetch origin` してから `origin/dev` を確認してください。

`WORKING.md` に作業中のエントリがある場合は、**完了してから次の作業を開始**してください。

---

## 作業開始時

`WORKING.md` に「触るファイルを全列挙」してからコミット・プッシュしてください。

```bash
# WORKING.md に追記する形式（ファイルパスを必ず列挙）
# - [Claude Code] app/[storeId]/admin/page.tsx, app/api/xxx/route.ts — 機能名 (YYYY-MM-DD HH:MM)
git add WORKING.md && git commit -m "wip: 〇〇 開始" && git push origin dev
```

---

## 作業完了時

変更をコミット・プッシュした後、`WORKING.md` から自分の行を削除してください。

```bash
git add . && git commit -m "fix: ○○を修正" && git push origin dev
```

---

## よく使うコマンド

```bash
# ローカル開発サーバー起動
npm run dev

# 本番ビルド確認（push前に実行推奨）
npm run build

# 型チェック
npx tsc --noEmit
```

---

## 禁止事項・注意事項

- `node_modules/` は絶対にコミットしない
- `.env.local` など環境変数ファイルは Git に上げない
- Supabase の本番 DB へのスキーマ変更・DELETE は慎重に（必ずバックアップ確認）
- `main` ブランチへの直接 push 禁止（必ず `dev` 経由でマージ）

---

## コーディング規約

- **TypeScript** を厳守（`any` は原則禁止）
- スタイルは **Tailwind CSS のみ**（カスタム CSS ファイルへの追記は原則禁止）
- `use client` は最小限に。デフォルトは Server Component で実装する
- API ルートは `app/api/` 配下に配置

---

## ドメイン知識の参照先

Claudeが業務ロジックを実装する際は以下を必ず参照すること。

| ファイル | 内容 |
|---|---|
| `gyoumuiriran.md` | 制服販売店の業務棚卸一覧（営業・採寸・発注・納品など全業務） |
| `domain_knowledge_uniform_shop.md` | 制服販売店のドメイン知識まとめ |

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
**必ず `dev` ブランチで動作確認してから `main` にマージしてください。**

---

## よくあるトラブル

| 症状 | 対処 |
|---|---|
| Supabase Realtime が繋がらない | ブラウザのコンソールでWebSocket エラーを確認。Supabase ダッシュボードでRealtimeが有効か確認。 |
| LINE LIFF が動かない | LIFF はスマホ実機（LINE アプリ内ブラウザ）での確認が必須。PC ブラウザでは動作しない機能あり。 |
| Vercel デプロイが失敗する | `npm run build` をローカルで実行して型エラー・ビルドエラーを先に解消する。 |
| 環境変数が読めない | Vercel のプロジェクト設定で環境変数が登録されているか確認。`.env.local` はローカル専用。 |
