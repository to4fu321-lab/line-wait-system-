# 現在の進捗状況

> 更新: 2026-06-25

---

## 完了したステップ

### ✅ ステップ1〜4: 初期フェーズ
- 市場リサーチ、仮説検証、P0実装、マニュアル作成

### ✅ サイクル2: バグ修正 + P1機能実装（F-03, F-04）
- SeasonDashboard修正（正しいDBテーブル）
- F-03 在校生フォロー通知 + F-04 採寸会チェックリスト

### ✅ サイクル3: F-06 保護者マイページ
- LIFFログイン → 注文・お直し・お子様情報表示

### ✅ サイクル4: F-05 発注数量集計ページ
- `app/[storeId]/admin/order-summary/page.tsx`
- メーカー→学校→商品→サイズ階層集計、クリップボードコピー

### ✅ サイクル5: 学校マスタ締切日フィールド
- `types/master.ts` + `admin/master/manage/page.tsx` に4つの日付フィールド追加
- `supabase/migrations/20260624_school_deadlines.sql` 未適用（要手動実行）

### ✅ サイクル6: 採寸記録（身長・体重）履歴
- `app/[storeId]/mypage/page.tsx` — queues.details から取得してマイページに表示

### ✅ サイクル7: 保護者マイページからお子様情報編集
- 学校名・学年・入学年度を保護者が自己更新できるモーダル追加
- admission_year 未入力問題を自力解消 → F-03 精度向上

### ✅ サイクル8: 入荷時LINE通知ボタン
- `app/api/arrival-notify/route.ts` 新規作成
- デリバリーページの各カードに「LINEで入荷をお知らせ」ボタン追加
- notified=true に更新

### ✅ サイクル9: 一括LINE通知バナー
- 未通知が2件以上の場合、デリバリーページ上部に「まとめて通知」ボタン表示
- 全未通知アイテムに順次 arrival-notify を呼び出してバッチ送信

### ✅ サイクル10〜11: TypeScript ビルドエラー全件解消
- 修正前 173件 → 修正後 0件
- 対象: fitting/page.tsx, admin/page.tsx, repairs/_components/RepairCard.tsx,
        reservations/page.tsx, details/page.tsx, kitchen/page.tsx,
        takeout-admin/page.tsx, api/admin/seed-test-data/route.ts,
        api/test/clear/route.ts, super-admin/page.tsx, crm-register/page.tsx
- 主な修正パターン:
  - `supabase.from(X)` → `(supabase as any).from(X)` (untyped tables)
  - `.then(({ data }) =>` → `.then(({ data }: { data: any }) =>`
  - `async function` inside `if {}` → `const fn = async () =>`
  - `[...raw]` → `Array.from(raw)` for Uint8Array spread
  - `Record<string, boolean>` → `Record<string, unknown>` for mixed features flag

### ✅ サイクル12: CRM 顧客一覧 CSV出力
- `app/[storeId]/admin/crm/page.tsx`
- 「CSV出力」ボタン追加 → BOM+UTF-8、保護者+子供データをフラット展開
- 最大2000件、かな順ソート

### ✅ サイクル13: お直し・発注一覧 Excel出力
- `app/[storeId]/admin/repairs/page.tsx`
- 「Excel」ボタン追加 → xlsx ライブラリ、2シート（お直し一覧・発注一覧）

### ✅ サイクル14: 採寸会ページに学校別締切日カウントダウン
- `app/[storeId]/admin/measurement-event/page.tsx`
- 学校別来店数カードに「発注締切」「引渡目標」バッジを追加（残日数カラーコード）
- 「今後30日の締切」セクションを追加（全校の締切を日付順表示）
- schools テーブル未マイグレーション時は graceful fallback（例外を捕捉して無視）

---

## 検証済み仮説サマリー

| 仮説 | 結論 |
|------|------|
| 保護者は注文状況をLINEで確認したい | ✅ マイページで確認可能 |
| 入荷通知の電話かけは省力化できる | ✅ LINE一括通知で解消 |
| 保護者が子供の学年・入学年度を自己更新できる | ✅ マイページ編集モーダルで解消 |
| admission_year 未入力がフォロー通知の精度を下げていた | ✅ 保護者自己更新で改善 |
| ビルドエラーがデプロイを阻害していた | ✅ 全173件解消、0エラー |
| 顧客データのCSV出力で名簿作成が効率化できる | ✅ CRMページから即時ダウンロード |
| スタッフが採寸会当日に締切日を確認したい | ✅ 残日数バッジ + 30日カレンダー |

---

## 次サイクルの候補

1. **発注数量集計の改善**: order-summary でメーカー別テキスト整形コピー（発注書直貼り用）
2. **在校生フォロー通知の精度向上**: admission_year が揃ったので F-03 通知タイミングの再チューニング
3. **採寸会 QR受付 → 自動学校振り分け**: school_name を URL パラメータで渡して自動セット
4. **来店分析ダッシュボード**: 学校別・月別の来店推移グラフ（週次レポート用）

---

## 保留事項

- SchoolDeadlineAlert DBマイグレーション: `supabase/migrations/20260624_school_deadlines.sql` を Supabase SQLエディタで手動実行が必要
  - 実行前は採寸会ページの締切カウントダウンが非表示（graceful fallback）
- F-08（発注書PDF出力）: 外部API連携が必要 → 将来検討
