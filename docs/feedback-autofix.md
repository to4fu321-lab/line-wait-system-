# フィードバック自動修正ループ

現場フィードバック → GitHub Issue → Claude が自動トリアージ／修正PR、までを自動化する仕組み。

## 流れ
1. 店舗スタッフが管理画面の「要望・不具合」ボタンから投稿
2. `POST /api/feedback` が Supabase に保存し、`GITHUB_TOKEN` 設定時に **ラベル `feedback` 付きの Issue** を自動作成
3. `.github/workflows/feedback-autofix.yml` が Issue（ラベル `feedback`）をトリガに起動し、Claude が:
   - **質問** → Issue に回答して `question` で完了
   - **軽微で安全な修正** → `auto/feedback-<番号>` ブランチで修正し `Closes #<番号>` の PR を作成
   - **判断・設計が必要 / 影響大 / 不明確** → 原因推定・対応案をコメントし `needs-decision` ラベル
4. PR を人間（運用側）がレビュー → マージ → Vercel 自動デプロイ

## 必要な準備（リポジトリ設定）
1. **Vercel 環境変数**（Issue 自動作成用）
   - `GITHUB_TOKEN` … Issues 書き込み権限のある PAT（`NEXT_PUBLIC_` は付けない）
   - `GITHUB_REPO` … `to4fu321-lab/line-wait-system-`（既定値あり）
2. **GitHub Actions Secret**（自動修正用）
   - `ANTHROPIC_API_KEY` … Settings → Secrets and variables → Actions に登録
3. **GitHub Actions 権限**
   - Settings → Actions → General → Workflow permissions で
     「Allow GitHub Actions to create and approve pull requests」を有効化

## 安全装置
- DBマイグレーションの本番適用・シークレット変更・破壊的操作・大規模リファクタは自動修正しない
- 不確実なものは「直さずトリアージ（needs-decision）」に倒す
- 修正は必ず PR 経由（直接 main へはコミットしない）。最終マージは人間が判断

## 手動実行
ワークフローは `workflow_dispatch`（Issue 番号指定）でも実行可能。既存 Issue にも適用できる。
