# 変更履歴 (Changelog)

---

## [v0.2.0] — 2026-06-24 DXアプリ自律改善ループ サイクル1

### 新機能追加

#### 繁忙期シーズンダッシュボード (`SeasonDashboard`)
- **ファイル**: `app/[storeId]/admin/_components/SeasonDashboard.tsx`
- 管理画面トップに「今日のサマリー」パネルを追加
- 現在の月から「最繁忙期/引渡し期/夏服受付/繁忙期準備/通常期」を自動判定してUIの背景色が変化
- 今日の予約数・手配中受注件数・お渡し待ち件数をリアルタイム表示
- 各数字はタップで対応管理画面へジャンプ

#### 学校別締切アラート (`SchoolDeadlineAlert`)
- **ファイル**: `app/[storeId]/admin/_components/SchoolDeadlineAlert.tsx`
- 管理画面トップにSchoolDeadlineAlertコンポーネントを追加
- 発注締切・引渡し完了目標日が7日以内の学校を自動リストアップ
- 3日以内は赤、7日以内は黄色でバッジ表示
- 期限切れ（過去の日付）も「期限切れ」バッジで表示し続けることで見落とし防止

### データ型拡張

#### `types/school.ts` — School インターフェースに締切日フィールド追加
```typescript
order_deadline: string | null      // 発注締切日 (YYYY-MM-DD)
pickup_deadline: string | null     // 引渡し完了目標日 (YYYY-MM-DD)
measurement_start: string | null   // 採寸受付開始日 (YYYY-MM-DD)
measurement_end: string | null     // 採寸受付終了日 (YYYY-MM-DD)
```

### データベースマイグレーション

#### `supabase/migrations/20260624_school_deadlines.sql`
- `schools`テーブルに4フィールドを追加（`order_deadline`, `pickup_deadline`, `measurement_start`, `measurement_end`）

### ドキュメント追加

| ファイル | 内容 |
|---|---|
| `docs/research/market_and_barrier_analysis.md` | 市場リサーチ・競合ブロック戦略分析 |
| `docs/hypotheses/feature_requirements.md` | 機能要件定義書 v1.0 |
| `docs/manuals/store_onboarding_guide.md` | 店舗スタッフ向け導入・操作マニュアル |

---

## [v0.1.0] — （既存コード・初期リリース）

- LINE LIFF連携・整理番号発行・呼び出し・お直し管理・学校マスター・採寸パネル
- CRM顧客管理・予約管理・テイクアウト管理
