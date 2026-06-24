# 現在の進捗状況

> 更新: 2026-06-24

---

## 完了したステップ

### ✅ ステップ1: 市場リサーチと競合ブロック戦略
- 成果物: `docs/research/market_and_barrier_analysis.md`

### ✅ ステップ2: 仮説検証と要件定義
- 成果物: `docs/hypotheses/feature_requirements.md`

### ✅ ステップ3-Cycle1: P0機能実装
- SeasonDashboard、SchoolDeadlineAlert
- SQLマイグレーション（school_deadlines）

### ✅ ステップ4: マニュアル作成
- 成果物: `docs/manuals/store_onboarding_guide.md`

### ✅ サイクル2: バグ修正 + P1機能実装（F-03, F-04）
- **SeasonDashboard修正**: repair_histories/purchase_ordersの正しいテーブル・ステータス値に修正
- **F-03 在校生フォロー通知**: `app/[storeId]/admin/followup/page.tsx` + `/api/followup-notify`
  - admission_yearから学年自動計算（4月基準）
  - LINE連携済み保護者への一斉送信（夏服/成長/卒業テンプレ3種）
- **F-04 採寸会チェックリスト**: `app/[storeId]/admin/measurement-event/page.tsx`
  - 前日準備/当日対応/終了後 3カテゴリ
  - localStorage日付別永続化、カスタム項目、進捗バー

### ✅ サイクル3: F-06 保護者マイページ
- **F-06 保護者マイページ**: `app/[storeId]/mypage/page.tsx` 新規作成
  - LIFF認証 → line_user_idで顧客特定
  - お子様情報・手配中注文・お直し進捗を一覧表示
  - 過去の履歴（渡し済み最大5件）表示
  - purchase_orders/repair_histories の status badge表示
- **purpose viewにマイページリンク追加**: `app/[storeId]/page.tsx`
  - 登録済み顧客にのみ表示

---

## 検証済み仮説（サイクル3）

| 仮説 | 結論 |
|------|------|
| 保護者は注文状況をLINE上で確認したい | ✅ → マイページで確認可能に |
| 既存LIFF認証フローを再利用できる | ✅ → initLiff/getLineProfileで顧客特定 |
| purchase_orders/repair_historiesはcustomer_idで紐づく | ✅ → types/crm.tsで確認済み |

---

## 次に実施すること（次サイクル）

1. **F-05 発注数量自動集計**: 
   - uniform_ordersを学校別・商品別・サイズ別に集計するビュー
   - 新規ページ `app/[storeId]/admin/order-summary/` に作成
   - **実装規模**: 中（既存テーブルからSELECT集計のみ）
2. **SchoolDeadlineAlert DBマイグレーション適用**: 
   - `supabase/migrations/20260624_school_deadlines.sql` をSupabase SQLエディタで実行
3. **F-07 サイズ履歴トラッキング**: 
   - childrenテーブルに身長・体重履歴を追加（年次変化の可視化）

---

## 保留事項

- F-07（サイズ履歴）: childrenテーブルにheight_history jsonb列を追加する必要あり → 次サイクル
- F-08（発注書PDF出力）: 外部API連携が必要 → 将来検討
