# マニュアル OCR 一括取込機能 設計書

**作成日**: 2026-06-15  
**フェーズ**: Phase 1  
**ステータス**: 承認済み

---

## 背景・目的

学生服販売店の 9 割以上が紙によるアナログ管理を行っている。DX 化を進めるには、紙のマニュアル・見積書・伝票を「瞬時にデータ化するグラデーション」が必要であり、OCR 処理はそのコア技術と位置づける。

Phase 1 では学校マスタデータ（商品・価格・着用規定・特記事項）の一括取込を実装し、将来的に注文・お直し伝票への拡張基盤とする。

---

## スコープ（Phase 1）

| 対象 | 内容 |
|---|---|
| 入力形式 | JPG / PNG（スマホ撮影含む）、PDF（最大 100 ページ）、Excel / CSV |
| 抽出データ | 学校名、商品一覧（品名・カテゴリ・性別・メーカー・品番）、サイズ×価格、着用規定、特記事項・販売スケジュール、その他情報 |
| 取込先 | `schools` / `products` / `school_requirements` / `prices` テーブル |
| UI | マスタ管理ページ内の 4 ステップウィザードモーダル |

---

## アーキテクチャ

### OCR ライブラリ層（新規）

```
lib/ocr/
  engine.ts             Claude Vision / Document / Excel への振り分け
  schemas/
    school-manual.ts    学校マニュアル用 JSON スキーマ定義
  extractors/
    image.ts            JPG/PNG → Claude Vision (messages API)
    pdf.ts              PDF → Claude Document API（ネイティブ、変換不要）
    excel.ts            Excel/CSV → SheetJS でテキスト化 → Claude
```

- **Claude モデル**: `claude-haiku-4-5-20251001`（コスト最適化。精度要求の高い箇所は Sonnet に切替可能なよう engine に引数を設ける）
- **PDF**: Anthropic Document API で最大 100 ページをそのまま送信。変換ライブラリ不要。
- **Excel**: `xlsx`（SheetJS）ライブラリでシートをテキスト/JSON に変換後、Claude に構造抽出させる。`npm install xlsx` が必要。
- **画像複数枚**: 1 リクエスト最大 20 枚。20 枚超はバッチ分割して順次処理し結果をマージ。

### API 層（新規）

```
app/api/ocr/
  process/route.ts      ファイル受信 → ocr_jobs 登録 → バックグラウンド処理開始
  status/[id]/route.ts  ジョブ進捗ポーリング（ページ単位の進捗を返す）
  import/[id]/route.ts  プレビュー確認後に DB へ保存（POST）
```

- 既存の `/api/slip-ocr` は変更せず共存。将来的に `lib/ocr/engine` に統合移行予定。
- Vercel 関数タイムアウト対策: Haiku の処理速度により 8 ページ PDF は概ね 30 秒以内。Pro プランの 300 秒上限内に収まる想定。超過リスクがある場合はページ分割処理で対応。

### DB 変更

#### `schools` テーブルに列追加

```sql
ALTER TABLE schools ADD COLUMN IF NOT EXISTS wearing_regulations text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS special_notes       text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS schedule_notes      text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS extra_info          text;
```

#### `ocr_jobs` テーブル（新規作成）

```sql
CREATE TABLE ocr_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        text        NOT NULL,
  job_type        text        NOT NULL,  -- 'school_manual' | 'order_slip' | 'repair_slip'
  status          text        NOT NULL DEFAULT 'pending',
                                         -- pending | processing | done | error
  input_meta      jsonb,                 -- ファイル名、ページ数など
  progress        jsonb,                 -- { current: 5, total: 8, page_labels: [...] }
  result          jsonb,                 -- 抽出結果（プレビュー用）
  tokens_used     integer,               -- Anthropic API トークン消費量（課金管理用）
  error_msg       text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```

### 抽出スキーマ（`school-manual.ts`）

```typescript
interface SchoolManualExtraction {
  school_name:          string | null       // 学校名
  wearing_regulations:  string | null       // 着用規定（自由テキスト）
  special_notes:        string | null       // 特記事項
  schedule_notes:       string | null       // 販売スケジュール・締切
  extra_info:           string | null       // その他情報
  items: Array<{
    item_name:          string
    category:           string | null       // PRODUCT_CATEGORY_OPTIONS に準拠
    gender:             string | null       // 男子用 | 女子用 | 男女共通
    maker:              string | null
    maker_code:         string | null
    required:           boolean
    avg_qty:            number | null
    notes:              string | null       // 商品個別メモ
    eo_price_tax_in:    number | null       // 別寸（EO）価格
    sizes: Array<{
      label:            string             // 例: 155, W60, S, M
      price_tax_in:     number
    }>
    confidence:         'high' | 'medium' | 'low'
  }>
  confidence:           'high' | 'medium' | 'low'
  warnings:             string[]
}
```

---

## UI フロー（4 ステップウィザード）

マスタ管理ページ（`/[storeId]/admin/master/manage`）に「マニュアルから取込」ボタンを追加。クリックでモーダルウィザードが開く。

### Step 1: アップロード
- ドラッグ＆ドロップ / ファイル選択
- 対応形式: JPG・PNG・PDF・Excel・CSV
- 複数ファイル同時アップロード可

### Step 2: AI 解析中
- ページごとのリアルタイム進捗（`/api/ocr/status/[id]` をポーリング）
- ページ番号チップと処理ログを表示
- 処理完了後、自動で Step 3 へ遷移

### Step 3: 内容確認・編集

**学校マッチング（3 パターン）**

| パターン | 条件 | UI |
|---|---|---|
| A. 既存校と一致 | AI が学校名を検出 + マスタに存在 | 一致した学校名を表示。「変更」ボタンでパターン B へ |
| B. 読み取れたが未登録 | AI が学校名を検出 + マスタに未存在 | 読み取った名前を編集可能入力欄で表示。「この名前で新規作成」または「既存校に紐付け（検索）」を選択 |
| C. 学校名が読み取れず | 学校名の検出なし | 「新規学校として登録（手入力）」または「既存校を検索」を選択 |

**コンテンツ確認タブ**
- **着用規定・特記事項タブ**: 着用規定 / 販売スケジュール / 特記事項 を個別に編集可
- **商品・価格タブ**: チェックボックスで個別選択。信頼度（高/中/⚠要確認）を表示

**取込オプション**
- 「選択した商品のみ取込」: チェックが入った行だけ保存
- 「すべて取り込む」: 全件保存

### Step 4: 取込完了
- 登録件数サマリ（商品数・サイズ×価格数・規定/特記事項の更新有無）
- スキップした件数と理由を表示
- 「別のマニュアルを取込む」/ 「マスタ管理で確認」ボタン

---

## 学校マッチングロジック（API 側）

```
1. AI が抽出した school_name を取得
2. store_id + name で完全一致検索
3. 一致 → パターン A（matched_school_id を返す）
4. 不一致 + school_name あり → パターン B（detected_name を返す）
   ※ UI 側で「既存校に紐付け」を選んだ場合は前方一致・部分一致で候補リストを絞り込む
5. school_name が null → パターン C
```

---

## プラン制・従量課金への対応（後付け可能）

`ocr_jobs.tokens_used` に毎回のトークン消費を記録する。現時点では記録のみ。後から以下を追加できる：

- `stores.features` に `ocr_master` フラグを追加してプラン別 ON/OFF
- 月間ジョブ数カウントによる上限制御
- スーパー管理画面でのトークン消費レポート

---

## 対象ファイル

| ファイル | 種別 |
|---|---|
| `lib/ocr/engine.ts` | 新規作成 |
| `lib/ocr/schemas/school-manual.ts` | 新規作成 |
| `lib/ocr/extractors/image.ts` | 新規作成 |
| `lib/ocr/extractors/pdf.ts` | 新規作成 |
| `lib/ocr/extractors/excel.ts` | 新規作成 |
| `app/api/ocr/process/route.ts` | 新規作成 |
| `app/api/ocr/status/[id]/route.ts` | 新規作成 |
| `app/api/ocr/import/[id]/route.ts` | 新規作成 |
| `app/[storeId]/admin/master/manage/page.tsx` | 既存修正（ボタン追加 + ウィザードモーダル追加） |
| `app/[storeId]/admin/master/manage/_components/ManualImportWizard.tsx` | 新規作成 |
| `types/master.ts` | 既存修正（`SchoolMaster` に新列を追加） |
| `supabase/migrations/20260615_ocr_jobs.sql` | 新規作成 |
| `supabase/migrations/20260615_schools_columns.sql` | 新規作成 |

---

## 除外スコープ（Phase 2 以降）

- 注文・お直し伝票の `/api/slip-ocr` を `lib/ocr/engine` へ統合移行
- グループ（多店舗）間でのマスタ共有
- OCR 利用量レポート・課金ダッシュボード
- リアルタイム WebSocket 進捗（現在はポーリング）
