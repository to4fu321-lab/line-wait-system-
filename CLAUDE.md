# line-wait-system — 開発ガイド

## エージェント協調ルール

このリポジトリは **Claude Code** と **AntiGravity** の2エージェントが共同開発しています。
作業開始前に必ず以下を確認・実行してください。

---

## 作業開始前に必ず行うこと

```bash
# 1. 最新を取得
git pull origin main

# 2. 誰が何を作業中か確認
cat WORKING.md
```

`WORKING.md` に他のエージェントの作業が記録されている場合は、
**同じファイルへの変更を避けるか、作業完了を待ってから開始**してください。

---

## 作業開始時

`WORKING.md` を更新してコミット・プッシュしてください。

```bash
# 例: Claude Code が page.tsx を修正する場合
# WORKING.md に以下を追記してプッシュ
echo "- [Claude Code] app/[storeId]/page.tsx — フリガナ修正 ($(date '+%Y-%m-%d %H:%M'))" >> WORKING.md
git add WORKING.md && git commit -m "wip: Claude Code — フリガナ修正 開始" && git push origin main
```

---

## 作業完了時

変更をコミット・プッシュした後、`WORKING.md` から自分の行を削除してください。

```bash
# 完了後に WORKING.md をクリア（自分の行だけ削除）
git add . && git commit -m "fix: ○○を修正" && git push origin main
```

---

## 担当エリア（目安）

| エージェント | 主な担当 |
|-------------|---------|
| **Claude Code** | `app/api/` `lib/` `types/` Supabase・LINE・デプロイ |
| **AntiGravity** | `app/[storeId]/` のUI・デザイン・レイアウト調整 |

※ 担当外でも作業可能。ただし `WORKING.md` で宣言してから着手すること。

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
