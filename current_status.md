# 現在の進捗状況

> 更新: 2026-06-24

---

## 完了したステップ

### ✅ ステップ1: 市場リサーチと競合ブロック戦略
- 成果物: `docs/research/market_and_barrier_analysis.md`
- 少子化・ジェンダーレス制服・販売店高齢化・人手不足の最新動向を分析
- 競合システム（アラジンオフィス、RESERVA、T&Y等）の弱点を特定
- 「学校別ルールDB」「LINE保護者連携」「年間カレンダー連動」が最強の参入障壁と結論

### ✅ ステップ2: 仮説検証と要件定義
- 成果物: `docs/hypotheses/feature_requirements.md`
- P0（今サイクル）: F-01 シーズンダッシュボード、F-02 締切アラート、F-03 在校生フォロー自動化
- P1（次サイクル）: F-04〜F-06
- P2（将来）: F-07〜F-10

### ✅ ステップ3: 機能実装
- **SeasonDashboard コンポーネント新規作成** (`app/[storeId]/admin/_components/SeasonDashboard.tsx`)
  - 11種の月別シーズン判定（繁忙期準備/最繁忙期/引渡し期/夏服受付/通常期）
  - 今日の予約数・手配中受注・お渡し待ち件数のリアルタイム表示
- **SchoolDeadlineAlert コンポーネント新規作成** (`app/[storeId]/admin/_components/SchoolDeadlineAlert.tsx`)
  - 発注締切7日以内の学校を自動抽出・赤/黄バッジで表示
- **admin/page.tsx 更新**: 両コンポーネントをコンテンツ先頭に配置
- **types/school.ts 更新**: 締切日フィールド追加
- **SQLマイグレーション追加**: `supabase/migrations/20260624_school_deadlines.sql`

### ✅ ステップ4: マニュアル作成
- 成果物: `docs/manuals/store_onboarding_guide.md`
- IT非熟練スタッフが読める5ステップ初期設定ガイド
- 採寸会当日・日常操作・年間スケジュール対応表
- 在校生フォロー自動化の説明
- よくあるトラブルと対処法

---

## 次に実施すること（次サイクル）

1. **DBマイグレーション適用**: `supabase/migrations/20260624_school_deadlines.sql` を Supabase SQL Editor で実行
2. **P1機能の実装開始**: F-05（発注数量自動集計）の要件を `docs/todo.md` に記録してから実装
3. **在校生フォロー（F-03）の実装**: `admission_year`フィールドをCRMに追加 → 通知スケジュール機能を実装

---

## 保留事項

- F-03（在校生年次フォロー）: CRMの`children`テーブルへの`admission_year`追加は次サイクルで実施
- F-05（発注数量集計）: 大規模変更のため `docs/todo.md` に記録し、実装前にオーナーに確認する
