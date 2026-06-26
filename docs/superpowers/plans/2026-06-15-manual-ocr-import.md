# マニュアル OCR 一括取込 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 学校マニュアル・見積書（PDF/画像/Excel）をAIで読み取り、学校マスタ（商品・価格・着用規定・特記事項）を一括登録できる4ステップウィザードを実装する。

**Architecture:** 新規 `lib/ocr/` ライブラリ層がファイル種別（画像/PDF/Excel）を判定してClaude APIを呼び出す。`/api/ocr/` エンドポイント群がジョブ管理とDB保存を担当。マスタ管理ページに「マニュアルから取込」ボタンとウィザードモーダルを追加する。処理は同期的に行い（Vercel Pro 300s上限内）、完了後にプレビュー確認画面へ遷移する。

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase (PostgreSQL), Anthropic claude-haiku-4-5 (Vision + Document API), xlsx (SheetJS for Excel), Tailwind CSS

---

## ファイル構成

| ファイル | 種別 | 責務 |
|---|---|---|
| `supabase/migrations/20260615_schools_ocr_columns.sql` | 新規 | schoolsテーブルに着用規定等4列追加 |
| `supabase/migrations/20260615_ocr_jobs.sql` | 新規 | ocr_jobsテーブル作成 |
| `types/ocr.ts` | 新規 | OcrJob / SchoolManualExtraction 型定義 |
| `types/master.ts` | 修正 | SchoolMasterに新4列を追加 |
| `lib/ocr/schemas/school-manual.ts` | 新規 | Claude向けプロンプト + 抽出スキーマ定数 |
| `lib/ocr/extractors/image.ts` | 新規 | JPG/PNG → Claude Vision |
| `lib/ocr/extractors/pdf.ts` | 新規 | PDF → Claude Document API |
| `lib/ocr/extractors/excel.ts` | 新規 | Excel/CSV → SheetJS → Claude |
| `lib/ocr/engine.ts` | 新規 | ファイル種別振り分け + 共通認証ヘルパー |
| `app/api/ocr/process/route.ts` | 新規 | FormData受信→OCR処理→jobをDBに保存 |
| `app/api/ocr/status/[id]/route.ts` | 新規 | jobの進捗・結果を返す |
| `app/api/ocr/import/[id]/route.ts` | 新規 | 確認後にマスタDBへ保存 |
| `app/[storeId]/admin/master/manage/_components/ManualImportWizard.tsx` | 新規 | 4ステップウィザード全体 |
| `app/[storeId]/admin/master/manage/page.tsx` | 修正 | 「マニュアルから取込」ボタン追加 |

---

## Task 1: DB マイグレーション

**Files:**
- Create: `supabase/migrations/20260615_schools_ocr_columns.sql`
- Create: `supabase/migrations/20260615_ocr_jobs.sql`

- [ ] **Step 1: schools テーブルのマイグレーションファイルを作成**

```sql
-- supabase/migrations/20260615_schools_ocr_columns.sql
ALTER TABLE schools ADD COLUMN IF NOT EXISTS wearing_regulations text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS special_notes       text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS schedule_notes      text;
ALTER TABLE schools ADD COLUMN IF NOT EXISTS extra_info          text;
```

- [ ] **Step 2: ocr_jobs テーブルのマイグレーションファイルを作成**

```sql
-- supabase/migrations/20260615_ocr_jobs.sql
CREATE TABLE IF NOT EXISTS ocr_jobs (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     text        NOT NULL,
  job_type     text        NOT NULL,   -- 'school_manual'
  status       text        NOT NULL DEFAULT 'pending',
                                        -- pending | processing | done | error
  input_meta   jsonb,                   -- { file_name, file_type, page_count }
  result       jsonb,                   -- SchoolManualExtraction
  tokens_used  integer,
  error_msg    text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ocr_jobs_store_id_idx ON ocr_jobs(store_id);
ALTER TABLE ocr_jobs ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 3: Supabase MCPでマイグレーションを適用**

Supabase MCP の `apply_migration` ツールを2回実行（schools → ocr_jobs の順）。
プロジェクトID: `ffbixfbddxguhdhayqqy`

- [ ] **Step 4: 適用確認**

Supabase MCP の `list_tables` または `execute_sql` で以下を確認:
```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'schools' AND column_name IN
  ('wearing_regulations','special_notes','schedule_notes','extra_info');

SELECT table_name FROM information_schema.tables
WHERE table_name = 'ocr_jobs';
```
期待値: 4列と1テーブルが返る。

- [ ] **Step 5: コミット**

```bash
git add supabase/migrations/
git commit -m "feat: DB migrations for OCR jobs and school manual columns"
```

---

## Task 2: TypeScript 型定義

**Files:**
- Create: `types/ocr.ts`
- Modify: `types/master.ts` (SchoolMaster に4列追加)

- [ ] **Step 1: types/ocr.ts を作成**

```typescript
// types/ocr.ts

export type OcrJobStatus = 'pending' | 'processing' | 'done' | 'error'
export type OcrJobType = 'school_manual'

export interface OcrInputMeta {
  file_name: string
  file_type: 'image' | 'pdf' | 'excel'
  page_count?: number
}

// Claude が抽出する構造化データ
export interface SchoolManualItem {
  item_name:       string
  category:        string | null   // PRODUCT_CATEGORY_OPTIONS に準拠
  gender:          string | null   // 男子用 | 女子用 | 男女共通
  maker:           string | null
  maker_code:      string | null
  required:        boolean
  avg_qty:         number | null
  notes:           string | null
  eo_price_tax_in: number | null
  sizes: Array<{
    label:        string   // 例: 155, W60, S, M
    price_tax_in: number
  }>
  confidence: 'high' | 'medium' | 'low'
}

export interface SchoolManualExtraction {
  school_name:          string | null
  wearing_regulations:  string | null
  special_notes:        string | null
  schedule_notes:       string | null
  extra_info:           string | null
  items:                SchoolManualItem[]
  confidence:           'high' | 'medium' | 'low'
  warnings:             string[]
}

export interface OcrJob {
  id:          string
  store_id:    string
  job_type:    OcrJobType
  status:      OcrJobStatus
  input_meta:  OcrInputMeta | null
  result:      SchoolManualExtraction | null
  tokens_used: number | null
  error_msg:   string | null
  created_at:  string
  updated_at:  string
}

// import API へ送るリクエスト body
export interface OcrImportRequest {
  storeId:     string
  storePin:    string
  schoolId:    string | null   // null = 新規作成
  schoolName:  string          // 新規作成時は確定後の名前、既存紐付け時は表示用
  selectedIndices: number[]    // items 配列のインデックス（全選択なら全インデックス）
  // ユーザーが編集した規定テキスト（Step3 で修正可能）
  wearingRegulations: string | null
  specialNotes:       string | null
  scheduleNotes:      string | null
  extraInfo:          string | null
}
```

- [ ] **Step 2: types/master.ts の SchoolMaster に4列を追加**

`types/master.ts` の `SchoolMaster` インターフェース（104〜116行付近）を修正:

```typescript
export interface SchoolMaster {
  id:                   string
  store_id:             string
  name:                 string
  kana:                 string
  short_name:           string
  sort_order:           number
  active:               boolean
  notes:                string
  wearing_regulations:  string | null  // 着用規定
  special_notes:        string | null  // 特記事項
  schedule_notes:       string | null  // 販売スケジュール
  extra_info:           string | null  // その他情報
  created_at:           string
  updated_at:           string
}
```

- [ ] **Step 3: コミット**

```bash
git add types/ocr.ts types/master.ts
git commit -m "feat: add OCR job types and school manual extraction types"
```

---

## Task 3: OCR スキーマ定義（Claude プロンプト）

**Files:**
- Create: `lib/ocr/schemas/school-manual.ts`

- [ ] **Step 1: ディレクトリを作成**

```bash
mkdir -p lib/ocr/schemas
```

- [ ] **Step 2: lib/ocr/schemas/school-manual.ts を作成**

```typescript
// lib/ocr/schemas/school-manual.ts
// Claude に渡すプロンプトと期待する JSON スキーマを定義する。

export const SCHOOL_MANUAL_PROMPT = `あなたは学生服販売店のデータ入力を支援するAIです。
添付された学校の制服マニュアル・価格表・見積書・着用規定書などを読み取り、
以下の JSON 形式で情報を抽出してください。

【抽出ルール】
- 読み取れない・記載がない項目は null にする（省略禁止）
- 価格は税込の数値のみ（¥・円・カンマは除く）
- サイズは表記をそのまま抽出（155, 160A, W60, S, M など）
- メーカー品番（maker_code）は型番・品番・品コードのいずれも対象
- required は「必須」「必需品」の記載があれば true、「任意」「希望者のみ」なら false、不明は true
- category は以下のいずれかに最も近いものを選ぶ:
  制服（上着）/ スラックス・スカート / シャツ・ブラウス / セーター・ベスト /
  ネクタイ・リボン / 体操着 / 上靴 / カバン・バッグ / その他
- gender は「男子用」「女子用」「男女共通」のいずれか
- confidence は全体の読み取り精度: high=明確, medium=一部推測, low=判読困難
- 商品ごとの confidence も同様に設定し、不確かな箇所は warnings に記述

出力形式（JSON のみ。コードブロック不要）:
{
  "school_name": "学校名 | null",
  "wearing_regulations": "着用規定の全文（改行・箇条書き含む） | null",
  "special_notes": "特記事項（学年色・注意事項など） | null",
  "schedule_notes": "販売スケジュール・EO締切など | null",
  "extra_info": "上記に分類できないその他の情報 | null",
  "items": [
    {
      "item_name": "商品名",
      "category": "カテゴリ",
      "gender": "男子用 | 女子用 | 男女共通",
      "maker": "メーカー名 | null",
      "maker_code": "品番 | null",
      "required": true,
      "avg_qty": null,
      "notes": "この商品の備考 | null",
      "eo_price_tax_in": null,
      "sizes": [
        { "label": "155", "price_tax_in": 28600 }
      ],
      "confidence": "high | medium | low"
    }
  ],
  "confidence": "high | medium | low",
  "warnings": ["読み取り不確かな箇所を日本語で列挙"]
}`

// Excel/CSV の場合はテキスト化したデータと一緒に渡すプロンプト
export function buildExcelPrompt(sheetText: string): string {
  return `${SCHOOL_MANUAL_PROMPT}

以下は Excel/CSV から抽出したテキストデータです:

\`\`\`
${sheetText}
\`\`\``
}
```

- [ ] **Step 3: コミット**

```bash
git add lib/ocr/schemas/school-manual.ts
git commit -m "feat: add school manual OCR prompt schema"
```

---

## Task 4: Image エクストラクタ

**Files:**
- Create: `lib/ocr/extractors/image.ts`

- [ ] **Step 1: lib/ocr/extractors/image.ts を作成**

```typescript
// lib/ocr/extractors/image.ts
// JPG/PNG/WebP をバッチで Claude Vision へ送信し、SchoolManualExtraction を返す。
// 1リクエスト最大20枚。超過時はバッチ分割してマージする。

import Anthropic from '@anthropic-ai/sdk'
import type { SchoolManualExtraction } from '@/types/ocr'
import { SCHOOL_MANUAL_PROMPT } from '@/lib/ocr/schemas/school-manual'

const BATCH_SIZE = 20

type ImageMime = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

function detectMime(buffer: Buffer, fileName: string): ImageMime {
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image/png'
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image/jpeg'
  if (buffer[0] === 0x47 && buffer[1] === 0x49) return 'image/gif'
  if (fileName.toLowerCase().endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

async function callClaude(
  client: Anthropic,
  buffers: Buffer[],
  fileNames: string[],
): Promise<{ extraction: SchoolManualExtraction; tokens: number }> {
  const imageContent = buffers.map((buf, i): Anthropic.ImageBlockParam => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: detectMime(buf, fileNames[i]),
      data: buf.toString('base64'),
    },
  }))

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        ...imageContent,
        { type: 'text', text: SCHOOL_MANUAL_PROMPT },
      ],
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
  const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const extraction = JSON.parse(json) as SchoolManualExtraction
  return { extraction, tokens: response.usage.input_tokens + response.usage.output_tokens }
}

// 複数バッチの結果をマージ（items を結合、school_name/規定は最初のバッチを優先）
function mergeExtractions(
  results: SchoolManualExtraction[],
): SchoolManualExtraction {
  if (results.length === 0) throw new Error('No extraction results')
  const base = results[0]
  for (let i = 1; i < results.length; i++) {
    base.items.push(...results[i].items)
    base.warnings.push(...results[i].warnings)
    if (!base.wearing_regulations && results[i].wearing_regulations)
      base.wearing_regulations = results[i].wearing_regulations
    if (!base.special_notes && results[i].special_notes)
      base.special_notes = results[i].special_notes
    if (!base.schedule_notes && results[i].schedule_notes)
      base.schedule_notes = results[i].schedule_notes
    if (!base.extra_info && results[i].extra_info)
      base.extra_info = results[i].extra_info
  }
  return base
}

export async function extractFromImages(
  client: Anthropic,
  buffers: Buffer[],
  fileNames: string[],
): Promise<{ extraction: SchoolManualExtraction; tokens: number }> {
  if (buffers.length <= BATCH_SIZE) {
    return callClaude(client, buffers, fileNames)
  }

  // バッチ分割
  let totalTokens = 0
  const results: SchoolManualExtraction[] = []
  for (let i = 0; i < buffers.length; i += BATCH_SIZE) {
    const batchBufs = buffers.slice(i, i + BATCH_SIZE)
    const batchNames = fileNames.slice(i, i + BATCH_SIZE)
    const { extraction, tokens } = await callClaude(client, batchBufs, batchNames)
    results.push(extraction)
    totalTokens += tokens
  }

  return { extraction: mergeExtractions(results), tokens: totalTokens }
}
```

- [ ] **Step 2: コミット**

```bash
git add lib/ocr/extractors/image.ts
git commit -m "feat: add image extractor for OCR (Claude Vision)"
```

---

## Task 5: PDF エクストラクタ

**Files:**
- Create: `lib/ocr/extractors/pdf.ts`

- [ ] **Step 1: lib/ocr/extractors/pdf.ts を作成**

```typescript
// lib/ocr/extractors/pdf.ts
// Anthropic Document API を使用。PDF をそのまま base64 で送信（変換不要）。
// 最大 100 ページ対応。

import Anthropic from '@anthropic-ai/sdk'
import type { SchoolManualExtraction } from '@/types/ocr'
import { SCHOOL_MANUAL_PROMPT } from '@/lib/ocr/schemas/school-manual'

export async function extractFromPdf(
  client: Anthropic,
  buffer: Buffer,
): Promise<{ extraction: SchoolManualExtraction; tokens: number }> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: buffer.toString('base64'),
          },
        } as unknown as Anthropic.MessageParam['content'][number],
        // 注: SDK v0.100+ で DocumentBlockParam が利用可能。
        // 型エラーが出る場合は `as any` に変更すること。
        { type: 'text', text: SCHOOL_MANUAL_PROMPT },
      ],
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
  const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const extraction = JSON.parse(json) as SchoolManualExtraction
  const tokens = response.usage.input_tokens + response.usage.output_tokens
  return { extraction, tokens }
}
```

- [ ] **Step 2: コミット**

```bash
git add lib/ocr/extractors/pdf.ts
git commit -m "feat: add PDF extractor for OCR (Anthropic Document API)"
```

---

## Task 6: Excel エクストラクタ

**Files:**
- Create: `lib/ocr/extractors/excel.ts`

- [ ] **Step 1: xlsx パッケージをインストール**

```bash
npm install xlsx
npm install --save-dev @types/xlsx
```

インストール後 `package.json` の `dependencies` に `"xlsx": "^0.18.x"` が追加されることを確認。

- [ ] **Step 2: lib/ocr/extractors/excel.ts を作成**

```typescript
// lib/ocr/extractors/excel.ts
// SheetJS (xlsx) で Excel/CSV をテキスト化し Claude に渡す。

import Anthropic from '@anthropic-ai/sdk'
import * as XLSX from 'xlsx'
import type { SchoolManualExtraction } from '@/types/ocr'
import { buildExcelPrompt } from '@/lib/ocr/schemas/school-manual'

function bufferToSheetText(buffer: Buffer, fileName: string): string {
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const lines: string[] = []

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false })
    if (csv.trim()) {
      lines.push(`=== シート: ${sheetName} ===`)
      lines.push(csv)
    }
  }
  return lines.join('\n')
}

export async function extractFromExcel(
  client: Anthropic,
  buffer: Buffer,
  fileName: string,
): Promise<{ extraction: SchoolManualExtraction; tokens: number }> {
  const sheetText = bufferToSheetText(buffer, fileName)

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: [{ type: 'text', text: buildExcelPrompt(sheetText) }],
    }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
  const json = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
  const extraction = JSON.parse(json) as SchoolManualExtraction
  const tokens = response.usage.input_tokens + response.usage.output_tokens
  return { extraction, tokens }
}
```

- [ ] **Step 3: コミット**

```bash
git add lib/ocr/extractors/excel.ts package.json package-lock.json
git commit -m "feat: add Excel extractor for OCR (SheetJS + Claude)"
```

---

## Task 7: OCR エンジン（振り分けロジック）

**Files:**
- Create: `lib/ocr/engine.ts`

- [ ] **Step 1: lib/ocr/engine.ts を作成**

```typescript
// lib/ocr/engine.ts
// ファイル種別を判定して適切なエクストラクタに振り分ける。
// Supabase 認証ヘルパーも同梱（API ルートから再利用）。

import { timingSafeEqual } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type { SchoolManualExtraction, OcrInputMeta } from '@/types/ocr'
import { extractFromImages } from './extractors/image'
import { extractFromPdf }    from './extractors/pdf'
import { extractFromExcel }  from './extractors/excel'

// ── Supabase クライアント（サービスロール）────────────────────────
export function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ── PIN 検証（タイミング攻撃耐性）────────────────────────────────
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) { timingSafeEqual(bufA, bufA); return false }
  return timingSafeEqual(bufA, bufB)
}

export async function verifyStore(
  storeId: string,
  storePin: string,
): Promise<boolean> {
  const sb = getSupabaseAdmin()
  const { data } = await sb.from('stores').select('pin').eq('id', storeId).single()
  if (!data) return false
  return safeEqual(String(storePin), String(data.pin ?? ''))
}

// ── ファイル種別判定 ──────────────────────────────────────────────
export type FileType = 'image' | 'pdf' | 'excel'

export function detectFileType(buffer: Buffer, fileName: string): FileType {
  const lower = fileName.toLowerCase()
  // PDF マジックバイト
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46)
    return 'pdf'
  // PNG
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return 'image'
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8) return 'image'
  // 拡張子フォールバック
  if (lower.endsWith('.pdf')) return 'pdf'
  if (lower.match(/\.(xlsx?|csv)$/)) return 'excel'
  if (lower.match(/\.(jpe?g|png|webp|gif)$/)) return 'image'
  return 'image'
}

// ── メインエントリ ────────────────────────────────────────────────
export async function runOcrExtraction(
  buffers: Buffer[],
  fileNames: string[],
): Promise<{
  extraction: SchoolManualExtraction
  tokens: number
  inputMeta: OcrInputMeta
}> {
  if (buffers.length === 0) throw new Error('ファイルが指定されていません')

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が未設定です')
  const client = new Anthropic({ apiKey })

  // 複数ファイルの場合: 全て同じ種別として最初のファイルで判定
  const firstType = detectFileType(buffers[0], fileNames[0])
  const inputMeta: OcrInputMeta = {
    file_name: fileNames.join(', '),
    file_type: firstType,
    page_count: buffers.length,
  }

  let extraction: SchoolManualExtraction
  let tokens: number

  if (firstType === 'pdf') {
    // PDF は 1 ファイルずつ処理（複数 PDF は結果をマージ）
    const results: SchoolManualExtraction[] = []
    let totalTokens = 0
    for (let i = 0; i < buffers.length; i++) {
      const r = await extractFromPdf(client, buffers[i])
      results.push(r.extraction)
      totalTokens += r.tokens
    }
    extraction = results[0]
    for (let i = 1; i < results.length; i++) {
      extraction.items.push(...results[i].items)
      extraction.warnings.push(...results[i].warnings)
    }
    tokens = totalTokens
  } else if (firstType === 'excel') {
    const r = await extractFromExcel(client, buffers[0], fileNames[0])
    extraction = r.extraction
    tokens = r.tokens
  } else {
    const r = await extractFromImages(client, buffers, fileNames)
    extraction = r.extraction
    tokens = r.tokens
  }

  return { extraction, tokens, inputMeta }
}
```

- [ ] **Step 2: コミット**

```bash
git add lib/ocr/engine.ts
git commit -m "feat: add OCR engine with file type detection and store auth"
```

---

## Task 8: Process API エンドポイント

**Files:**
- Create: `app/api/ocr/process/route.ts`

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p app/api/ocr/process
```

- [ ] **Step 2: app/api/ocr/process/route.ts を作成**

```typescript
// app/api/ocr/process/route.ts
// FormData でファイルを受け取り、OCR処理してジョブをDBに保存する。
// 処理は同期的に行い完了後に job_id + result を返す。

export const dynamic = 'force-dynamic'
export const maxDuration = 300   // Vercel Pro: 5分上限

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verifyStore, runOcrExtraction } from '@/lib/ocr/engine'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const storeId  = formData.get('storeId')  as string | null
    const storePin = formData.get('storePin') as string | null
    const files    = formData.getAll('files') as File[]

    // ── 入力バリデーション ────────────────────────────────────────
    if (!storeId || !storePin) {
      return NextResponse.json({ ok: false, error: '認証情報が必要です' }, { status: 401 })
    }
    if (files.length === 0) {
      return NextResponse.json({ ok: false, error: 'ファイルが必要です' }, { status: 400 })
    }

    // ── 認証 ─────────────────────────────────────────────────────
    const ok = await verifyStore(storeId, storePin)
    if (!ok) {
      return NextResponse.json({ ok: false, error: '認証に失敗しました' }, { status: 401 })
    }

    // ── バッファ化 ────────────────────────────────────────────────
    const buffers   = await Promise.all(files.map(f => f.arrayBuffer().then(Buffer.from)))
    const fileNames = files.map(f => f.name)

    // ── ジョブ作成 ────────────────────────────────────────────────
    const sb = getSupabaseAdmin()
    const { data: job, error: jobErr } = await sb
      .from('ocr_jobs')
      .insert({ store_id: storeId, job_type: 'school_manual', status: 'processing' })
      .select()
      .single()
    if (jobErr || !job) {
      return NextResponse.json({ ok: false, error: 'ジョブ作成に失敗しました' }, { status: 500 })
    }

    // ── OCR 処理 ──────────────────────────────────────────────────
    let extraction, tokens, inputMeta
    try {
      ;({ extraction, tokens, inputMeta } = await runOcrExtraction(buffers, fileNames))
    } catch (e) {
      await sb.from('ocr_jobs')
        .update({ status: 'error', error_msg: String(e), updated_at: new Date().toISOString() })
        .eq('id', job.id)
      return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
    }

    // ── 結果保存 ──────────────────────────────────────────────────
    await sb.from('ocr_jobs').update({
      status:      'done',
      input_meta:  inputMeta,
      result:      extraction,
      tokens_used: tokens,
      updated_at:  new Date().toISOString(),
    }).eq('id', job.id)

    return NextResponse.json({ ok: true, jobId: job.id, result: extraction })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 3: 動作確認（curl）**

```bash
# テスト用画像でリクエスト（storeIdとstorePinは実際の値に替える）
curl -X POST http://localhost:3000/api/ocr/process \
  -F "storeId=YOUR_STORE_ID" \
  -F "storePin=YOUR_PIN" \
  -F "files=@/path/to/test-manual.jpg"
```

期待レスポンス:
```json
{ "ok": true, "jobId": "uuid...", "result": { "school_name": "...", "items": [...] } }
```

- [ ] **Step 4: コミット**

```bash
git add app/api/ocr/process/route.ts
git commit -m "feat: add OCR process API endpoint"
```

---

## Task 9: Status & Import API エンドポイント

**Files:**
- Create: `app/api/ocr/status/[id]/route.ts`
- Create: `app/api/ocr/import/[id]/route.ts`

- [ ] **Step 1: Status エンドポイントを作成**

```bash
mkdir -p app/api/ocr/status/\[id\]
mkdir -p app/api/ocr/import/\[id\]
```

```typescript
// app/api/ocr/status/[id]/route.ts
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verifyStore } from '@/lib/ocr/engine'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { searchParams } = new URL(req.url)
  const storeId  = searchParams.get('storeId')  ?? ''
  const storePin = searchParams.get('storePin') ?? ''

  if (!await verifyStore(storeId, storePin)) {
    return NextResponse.json({ ok: false, error: '認証エラー' }, { status: 401 })
  }

  const sb = getSupabaseAdmin()
  const { data } = await sb
    .from('ocr_jobs')
    .select('id, status, result, tokens_used, error_msg, input_meta')
    .eq('id', params.id)
    .eq('store_id', storeId)
    .single()

  if (!data) {
    return NextResponse.json({ ok: false, error: 'ジョブが見つかりません' }, { status: 404 })
  }

  return NextResponse.json({ ok: true, job: data })
}
```

- [ ] **Step 2: Import エンドポイントを作成**

```typescript
// app/api/ocr/import/[id]/route.ts
// 確認画面で承認されたデータを schools / products / school_requirements / prices に保存する。

export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdmin, verifyStore } from '@/lib/ocr/engine'
import type { OcrImportRequest, SchoolManualExtraction } from '@/types/ocr'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json() as OcrImportRequest
    const { storeId, storePin, schoolId, schoolName, selectedIndices,
            wearingRegulations, specialNotes, scheduleNotes, extraInfo } = body

    if (!await verifyStore(storeId, storePin)) {
      return NextResponse.json({ ok: false, error: '認証エラー' }, { status: 401 })
    }

    const sb = getSupabaseAdmin() as any

    // ── ジョブから result を取得 ──────────────────────────────────
    const { data: jobRow } = await sb
      .from('ocr_jobs')
      .select('result')
      .eq('id', params.id)
      .eq('store_id', storeId)
      .single()
    if (!jobRow?.result) {
      return NextResponse.json({ ok: false, error: 'ジョブデータが見つかりません' }, { status: 404 })
    }
    const extraction = jobRow.result as SchoolManualExtraction

    // ── 学校の upsert ─────────────────────────────────────────────
    let targetSchoolId = schoolId
    if (!targetSchoolId) {
      // 新規作成
      const { data: newSchool, error } = await sb
        .from('schools')
        .insert({
          store_id:            storeId,
          name:                schoolName,
          kana:                '',
          short_name:          '',
          sort_order:          0,
          active:              true,
          notes:               '',
          wearing_regulations: wearingRegulations,
          special_notes:       specialNotes,
          schedule_notes:      scheduleNotes,
          extra_info:          extraInfo,
        })
        .select()
        .single()
      if (error) throw new Error(`学校作成エラー: ${error.message}`)
      targetSchoolId = newSchool.id
    } else {
      // 既存校の規定・特記事項を更新
      await sb.from('schools').update({
        wearing_regulations: wearingRegulations,
        special_notes:       specialNotes,
        schedule_notes:      scheduleNotes,
        extra_info:          extraInfo,
        updated_at:          new Date().toISOString(),
      }).eq('id', targetSchoolId)
    }

    // ── 選択された商品を登録 ──────────────────────────────────────
    const selectedItems = selectedIndices.map(i => extraction.items[i]).filter(Boolean)
    let importedCount = 0
    let skippedCount  = 0

    for (const item of selectedItems) {
      // 商品マスタに upsert
      const { data: product, error: pErr } = await sb
        .from('products')
        .insert({
          store_id:    storeId,
          school_id:   targetSchoolId,
          name:        item.item_name,
          category:    item.category,
          gender:      item.gender,
          maker:       item.maker,
          maker_code:  item.maker_code,
          notes:       item.notes,
          sort_order:  importedCount,
          active:      true,
        })
        .select()
        .single()

      if (pErr || !product) { skippedCount++; continue }

      // school_requirements に upsert
      await sb.from('school_requirements').upsert({
        store_id:  storeId,
        school_id: targetSchoolId,
        product_id: product.id,
        required:   item.required,
        avg_qty:    item.avg_qty,
        sort_order: importedCount,
      }, { onConflict: 'school_id,product_id' })

      // prices に登録
      if (item.sizes.length > 0) {
        const priceRows = item.sizes.map((s, idx) => ({
          store_id:     storeId,
          school_id:    targetSchoolId,
          product_id:   product.id,
          size_label:   s.label,
          price_tax_in: s.price_tax_in,
          is_eo:        false,
          sort_order:   idx,
          active:       true,
        }))
        await sb.from('prices').insert(priceRows)
      }

      // EO 価格
      if (item.eo_price_tax_in) {
        await sb.from('prices').insert({
          store_id:     storeId,
          school_id:    targetSchoolId,
          product_id:   product.id,
          size_label:   'EO',
          price_tax_in: item.eo_price_tax_in,
          is_eo:        true,
          sort_order:   999,
          active:       true,
        })
      }

      importedCount++
    }

    return NextResponse.json({
      ok: true,
      schoolId:     targetSchoolId,
      schoolName,
      importedCount,
      skippedCount,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ ok: false, error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 3: コミット**

```bash
git add app/api/ocr/status app/api/ocr/import
git commit -m "feat: add OCR status and import API endpoints"
```

---

## Task 10: ManualImportWizard コンポーネント

**Files:**
- Create: `app/[storeId]/admin/master/manage/_components/ManualImportWizard.tsx`

- [ ] **Step 1: ディレクトリ作成**

```bash
mkdir -p "app/[storeId]/admin/master/manage/_components"
```

- [ ] **Step 2: ManualImportWizard.tsx を作成**

ファイルが長いため、セクションに分けて記載する。

```typescript
// app/[storeId]/admin/master/manage/_components/ManualImportWizard.tsx
'use client'

import { useState, useRef, useCallback } from 'react'
import type { SchoolManualExtraction, SchoolManualItem, OcrImportRequest } from '@/types/ocr'
import type { SchoolMaster } from '@/types/master'

// ────────────────────────────────────────────────────────────────
// 型
// ────────────────────────────────────────────────────────────────
type Step = 1 | 2 | 3 | 4
type SchoolMatchState = 'match' | 'new' | 'unknown'

interface ImportResult {
  schoolId:     string
  schoolName:   string
  importedCount: number
  skippedCount:  number
}

interface Props {
  storeId:  string
  storePin: string
  schools:  SchoolMaster[]   // 既存学校一覧（検索用）
  onClose:  () => void
  onImportComplete: () => void  // 取込完了後にマスタ再読込
}

// ────────────────────────────────────────────────────────────────
// ウィザードステップヘッダー
// ────────────────────────────────────────────────────────────────
function WizardHeader({ step }: { step: Step }) {
  const steps = ['アップロード', 'AI解析中', '確認・編集', '取込完了']
  return (
    <div className="flex items-center gap-0 mb-5 bg-white border border-zinc-200 rounded-2xl px-5 py-4">
      {steps.map((label, i) => {
        const n = (i + 1) as Step
        const done   = step > n
        const active = step === n
        return (
          <div key={n} className="flex items-center flex-1 min-w-0">
            <div className={`flex items-center gap-2 whitespace-nowrap text-xs font-semibold
              ${done ? 'text-emerald-600' : active ? 'text-indigo-600' : 'text-zinc-400'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                ${done ? 'bg-emerald-500 text-white' : active ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-400'}`}>
                {done ? '✓' : n}
              </span>
              {label}
            </div>
            {i < 3 && (
              <div className={`flex-1 h-0.5 mx-2 ${step > n ? 'bg-emerald-400' : 'bg-zinc-100'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Step 1: アップロード
// ────────────────────────────────────────────────────────────────
function Step1Upload({
  onUpload,
}: {
  onUpload: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files).filter(f =>
      f.type.startsWith('image/') ||
      f.type === 'application/pdf' ||
      f.name.match(/\.(xlsx?|csv)$/i)
    )
    setSelectedFiles(arr)
  }

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors
          ${dragging ? 'border-indigo-400 bg-indigo-50' : 'border-violet-300 bg-violet-50/30'}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
      >
        <div className="text-4xl mb-3">📂</div>
        <div className="text-sm font-bold text-zinc-800 mb-1">
          ファイルをドラッグ＆ドロップ、またはタップして選択
        </div>
        <div className="text-xs text-zinc-500 mb-3">複数ファイル同時アップロード対応</div>
        <div className="flex gap-2 justify-center flex-wrap">
          {[
            { label: '📷 JPG / PNG', cls: 'bg-amber-100 text-amber-800' },
            { label: '📄 PDF（最大100ページ）', cls: 'bg-red-100 text-red-800' },
            { label: '📊 Excel / CSV', cls: 'bg-emerald-100 text-emerald-800' },
          ].map(p => (
            <span key={p.label} className={`px-3 py-1 rounded-full text-[11px] font-bold ${p.cls}`}>{p.label}</span>
          ))}
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,.pdf,.xlsx,.xls,.csv"
          className="hidden"
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {selectedFiles.length > 0 && (
        <div className="mt-4 bg-white border border-zinc-200 rounded-xl p-3 space-y-1">
          {selectedFiles.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-zinc-700">
              <span>📎</span>
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-xs text-zinc-400">{(f.size / 1024).toFixed(0)} KB</span>
            </div>
          ))}
        </div>
      )}

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mt-4 text-xs text-indigo-800 leading-relaxed">
        💡 <strong>対応コンテンツ：</strong>学校別マニュアル・価格表・見積書・着用規定書・発注書など。
        AIが内容を自動判別し、商品・価格・着用規定・特記事項を一括抽出します。
      </div>

      <div className="flex justify-between mt-5">
        <span />
        <button
          disabled={selectedFiles.length === 0}
          onClick={() => onUpload(selectedFiles)}
          className="px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40
            bg-gradient-to-br from-indigo-500 to-violet-500"
        >
          解析開始 →
        </button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Step 2: 処理中スピナー
// ────────────────────────────────────────────────────────────────
function Step2Processing({ fileName }: { fileName: string }) {
  return (
    <div className="text-center py-12">
      <div className="inline-block w-14 h-14 border-4 border-zinc-200 border-t-indigo-600
        rounded-full animate-spin mb-6" />
      <div className="text-base font-bold text-zinc-800 mb-2">AIがマニュアルを読み取っています...</div>
      <div className="text-sm text-zinc-500">{fileName}</div>
      <div className="text-xs text-zinc-400 mt-4">完了まで10〜60秒かかる場合があります</div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// 学校マッチャー（Step 3 内）
// ────────────────────────────────────────────────────────────────
function SchoolMatcher({
  matchState,
  detectedName,
  matchedSchool,
  schools,
  onSchoolConfirmed,
}: {
  matchState: SchoolMatchState
  detectedName: string | null
  matchedSchool: SchoolMaster | null
  schools: SchoolMaster[]
  onSchoolConfirmed: (schoolId: string | null, schoolName: string) => void
}) {
  const [mode, setMode] = useState<'default' | 'search' | 'new'>(
    matchState === 'match' ? 'default' :
    matchState === 'new'   ? 'default' : 'new'
  )
  const [editedName, setEditedName] = useState(detectedName ?? '')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSchool, setSelectedSchool] = useState<SchoolMaster | null>(matchedSchool)

  const filtered = schools.filter(s =>
    !searchQuery || s.name.includes(searchQuery) || (s.kana && s.kana.includes(searchQuery))
  )

  // 既存マッチ (State A)
  if (matchState === 'match' && mode === 'default') {
    return (
      <div className="bg-white border border-zinc-200 rounded-xl p-3.5 flex items-center gap-3 mb-4">
        <span className="text-xl">🏫</span>
        <div className="flex-1">
          <div className="text-sm font-bold text-zinc-800">{matchedSchool?.name}</div>
          <div className="text-xs text-zinc-500">AIが学校名を検出 — 既存マスタと一致</div>
        </div>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700">✓ 既存校</span>
        <button
          onClick={() => { setMode('search'); onSchoolConfirmed(null, '') }}
          className="text-xs text-zinc-500 border border-zinc-200 rounded-lg px-2 py-1"
        >変更</button>
      </div>
    )
  }

  // 読み取れたが未登録 (State B)
  if (matchState === 'new' && mode === 'default') {
    return (
      <div className="border-2 border-orange-200 rounded-xl p-4 mb-4 bg-orange-50/30">
        <div className="text-xs font-bold text-orange-700 mb-3 flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-full bg-orange-200 text-orange-800">新規</span>
          AIが学校名を検出しましたが、マスタに未登録です
        </div>
        <div className="text-xs text-zinc-500 mb-1.5">AIが読み取った学校名（修正できます）</div>
        <input
          value={editedName}
          onChange={e => setEditedName(e.target.value)}
          className="w-full border border-zinc-300 rounded-lg px-3 py-2 text-sm font-semibold
            text-zinc-800 bg-white focus:outline-none focus:border-indigo-400"
        />
        <div className="text-[11px] text-zinc-400 mt-1 mb-3">※ 誤認識があればここで修正してください</div>
        <div className="flex gap-2">
          <button
            onClick={() => { onSchoolConfirmed(null, editedName); setMode('default') }}
            className="flex-1 py-2 text-xs font-bold rounded-xl border-2 border-indigo-400
              bg-indigo-50 text-indigo-700"
          >➕ この名前で新規作成</button>
          <button
            onClick={() => setMode('search')}
            className="flex-1 py-2 text-xs font-bold rounded-xl border-2 border-zinc-300
              bg-white text-zinc-700"
          >🔍 既存の学校に紐付け</button>
        </div>
      </div>
    )
  }

  // 検索パネル (State B-search / State C-search)
  if (mode === 'search') {
    return (
      <div className="border-2 border-amber-200 rounded-xl p-4 mb-4 bg-amber-50/20">
        <div className="text-xs font-bold text-amber-700 mb-3">🔍 既存の学校を検索して紐付け</div>
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="学校名で検索…"
          className="w-full border border-violet-300 rounded-lg px-3 py-2 text-sm mb-2
            focus:outline-none focus:border-indigo-400"
        />
        <div className="border border-zinc-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
          {filtered.map(s => (
            <div
              key={s.id}
              onClick={() => { setSelectedSchool(s); onSchoolConfirmed(s.id, s.name) }}
              className={`flex items-center gap-2 px-3 py-2.5 cursor-pointer border-b border-zinc-100
                last:border-0 text-sm transition-colors
                ${selectedSchool?.id === s.id ? 'bg-indigo-50' : 'hover:bg-zinc-50'}`}
            >
              <span>🏫</span>
              <span className="font-semibold text-zinc-800 flex-1">{s.name}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-3 py-4 text-xs text-zinc-400 text-center">該当する学校がありません</div>
          )}
        </div>
        {selectedSchool && (
          <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200
            rounded-lg px-3 py-2">
            ✓ {selectedSchool.name} に紐付けます
          </div>
        )}
        <button
          onClick={() => setMode('new')}
          className="mt-2 text-xs text-zinc-500 underline"
        >新規作成に切り替え</button>
      </div>
    )
  }

  // 新規入力パネル (State C-new / B 切替後)
  return (
    <div className="border-2 border-amber-200 rounded-xl p-4 mb-4 bg-amber-50/20">
      <div className="text-sm font-bold text-amber-800 mb-3">⚠️ 学校名を入力してください</div>
      <input
        value={editedName}
        onChange={e => { setEditedName(e.target.value); onSchoolConfirmed(null, e.target.value) }}
        placeholder="学校名を手入力（例：○○市立○○中学校）"
        className="w-full border border-violet-300 rounded-lg px-3 py-2 text-sm mb-1
          focus:outline-none focus:border-indigo-400"
      />
      <div className="text-[11px] text-zinc-400">ふりがな・略称は登録後に設定できます</div>
      {editedName.trim() && (
        <div className="mt-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200
          rounded-lg px-3 py-2">
          ➕ {editedName.trim()} を新規作成します
        </div>
      )}
      <button
        onClick={() => setMode('search')}
        className="mt-2 text-xs text-zinc-500 underline"
      >既存の学校を検索して紐付ける</button>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Step 3: 確認・編集
// ────────────────────────────────────────────────────────────────
function Step3Review({
  extraction,
  schools,
  onConfirm,
  onBack,
}: {
  extraction: SchoolManualExtraction
  schools: SchoolMaster[]
  onConfirm: (data: {
    schoolId: string | null; schoolName: string
    wearingRegulations: string | null; specialNotes: string | null
    scheduleNotes: string | null; extraInfo: string | null
    selectedIndices: number[]
  }) => void
  onBack: () => void
}) {
  const [tab, setTab] = useState<'regs' | 'items'>('regs')
  const [checkedIndices, setCheckedIndices] = useState<Set<number>>(
    new Set(extraction.items.map((_, i) => i))
  )
  const [wearingReg, setWearingReg] = useState(extraction.wearing_regulations ?? '')
  const [specNotes,  setSpecNotes]  = useState(extraction.special_notes ?? '')
  const [schedNotes, setSchedNotes] = useState(extraction.schedule_notes ?? '')
  const [extraInfo,  setExtraInfo]  = useState(extraction.extra_info ?? '')

  // 学校マッチ状態の判定
  const matchedSchool = schools.find(s => s.name === extraction.school_name) ?? null
  const matchState: SchoolMatchState =
    matchedSchool ? 'match' :
    extraction.school_name ? 'new' : 'unknown'

  // 初期学校 ID / 名前を useState の初期値関数で設定（useEffect は不要）
  const [schoolId,   setSchoolId]   = useState<string | null>(
    () => matchedSchool?.id ?? null
  )
  const [schoolName, setSchoolName] = useState<string>(
    () => matchedSchool?.name ?? extraction.school_name ?? ''
  )

  const toggleItem = (i: number) => {
    setCheckedIndices(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  const toggleAll = (checked: boolean) => {
    setCheckedIndices(checked ? new Set(extraction.items.map((_, i) => i)) : new Set())
  }

  const canSubmit = schoolName.trim().length > 0

  return (
    <div>
      <SchoolMatcher
        matchState={matchState}
        detectedName={extraction.school_name}
        matchedSchool={matchedSchool}
        schools={schools}
        onSchoolConfirmed={(id, name) => { setSchoolId(id); setSchoolName(name) }}
      />

      {/* タブ */}
      <div className="flex gap-1 bg-zinc-100 rounded-xl p-1 mb-4">
        {[
          { key: 'regs',  label: '着用規定・特記事項' },
          { key: 'items', label: `商品・価格（${extraction.items.length}件）` },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as 'regs' | 'items')}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors
              ${tab === t.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500'}`}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'regs' && (
        <div className="space-y-3">
          {[
            { label: '📋 着用規定', val: wearingReg, set: setWearingReg },
            { label: '📅 販売スケジュール', val: schedNotes, set: setSchedNotes },
            { label: '⚠️ 特記事項', val: specNotes, set: setSpecNotes },
            { label: '📝 その他情報', val: extraInfo, set: setExtraInfo },
          ].map(f => (
            <div key={f.label} className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
              <div className="px-3 py-2 border-b border-zinc-100 text-xs font-bold text-zinc-700">
                {f.label}
              </div>
              <textarea
                value={f.val}
                onChange={e => f.set(e.target.value)}
                rows={3}
                placeholder="（取込後に手動入力も可）"
                className="w-full px-3 py-2 text-xs text-zinc-700 leading-relaxed resize-none
                  focus:outline-none focus:bg-indigo-50/30"
              />
            </div>
          ))}
        </div>
      )}

      {tab === 'items' && (
        <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-zinc-50">
                <th className="px-3 py-2 text-left">
                  <input
                    type="checkbox"
                    checked={checkedIndices.size === extraction.items.length}
                    onChange={e => toggleAll(e.target.checked)}
                    className="accent-indigo-600"
                  />
                </th>
                <th className="px-3 py-2 text-left font-semibold text-zinc-500">商品名</th>
                <th className="px-3 py-2 text-left font-semibold text-zinc-500">カテゴリ</th>
                <th className="px-3 py-2 text-left font-semibold text-zinc-500">サイズ×価格</th>
                <th className="px-3 py-2 text-left font-semibold text-zinc-500">精度</th>
              </tr>
            </thead>
            <tbody>
              {extraction.items.map((item, i) => (
                <tr key={i} className="border-t border-zinc-100">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={checkedIndices.has(i)}
                      onChange={() => toggleItem(i)}
                      className="accent-indigo-600"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-zinc-800">{item.item_name}</div>
                    {item.maker_code && (
                      <div className="text-[11px] text-zinc-400">{item.maker} / {item.maker_code}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-zinc-600">{item.category ?? '—'}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 flex-wrap">
                      {item.sizes.slice(0, 3).map((s, si) => (
                        <span key={si} className="bg-zinc-100 rounded px-1.5 py-0.5 text-[11px]">
                          {s.label} ¥{s.price_tax_in.toLocaleString()}
                        </span>
                      ))}
                      {item.sizes.length > 3 && (
                        <span className="text-[11px] text-zinc-400">+{item.sizes.length - 3}件</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`font-bold ${
                      item.confidence === 'high' ? 'text-emerald-600' :
                      item.confidence === 'low'  ? 'text-red-500' : 'text-amber-500'}`}>
                      {item.confidence === 'high' ? '高' : item.confidence === 'low' ? '低' : '⚠ 要確認'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-between mt-5 gap-2">
        <button
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 border border-zinc-200 bg-white"
        >← 戻る</button>
        <div className="flex gap-2">
          <button
            disabled={!canSubmit || checkedIndices.size === 0}
            onClick={() => onConfirm({
              schoolId, schoolName: schoolName.trim(),
              wearingRegulations: wearingReg || null,
              specialNotes: specNotes || null,
              scheduleNotes: schedNotes || null,
              extraInfo: extraInfo || null,
              selectedIndices: [...checkedIndices],
            })}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-indigo-600
              border border-violet-300 bg-white disabled:opacity-40"
          >選択した商品のみ取込</button>
          <button
            disabled={!canSubmit}
            onClick={() => onConfirm({
              schoolId, schoolName: schoolName.trim(),
              wearingRegulations: wearingReg || null,
              specialNotes: specNotes || null,
              scheduleNotes: schedNotes || null,
              extraInfo: extraInfo || null,
              selectedIndices: extraction.items.map((_, i) => i),
            })}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white
              bg-gradient-to-br from-indigo-500 to-violet-500 disabled:opacity-40"
          >✅ すべて取り込む</button>
        </div>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// Step 4: 完了
// ────────────────────────────────────────────────────────────────
function Step4Complete({
  result,
  onReset,
  onClose,
}: {
  result: ImportResult
  onReset: () => void
  onClose: () => void
}) {
  return (
    <div>
      <div className="bg-white border border-zinc-200 rounded-2xl p-8 text-center mb-4">
        <div className="text-5xl mb-4">✅</div>
        <div className="text-lg font-black text-zinc-800 mb-1">
          {result.schoolName} のデータを取込みました
        </div>
        <div className="text-sm text-zinc-500 mb-6">取込完了</div>
        <div className="grid grid-cols-2 gap-3 text-left">
          {[
            { num: result.importedCount, label: '商品を登録' },
            { num: result.skippedCount, label: 'スキップ（エラー）' },
          ].map(r => (
            <div key={r.label} className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
              <div className="text-2xl font-black text-indigo-600">{r.num}</div>
              <div className="text-xs text-zinc-500 mt-1">{r.label}</div>
            </div>
          ))}
        </div>
      </div>
      {result.skippedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-800 mb-4">
          ⚠️ {result.skippedCount}件がスキップされました。マスタ管理で手動確認してください。
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={onReset}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-indigo-600
            border border-violet-300 bg-white"
        >📂 別のマニュアルを取込む</button>
        <button
          onClick={onClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white
            bg-gradient-to-br from-indigo-500 to-violet-500"
        >マスタ管理で確認 →</button>
      </div>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────
// メインコンポーネント
// ────────────────────────────────────────────────────────────────
export default function ManualImportWizard({ storeId, storePin, schools, onClose, onImportComplete }: Props) {
  const [step,       setStep]       = useState<Step>(1)
  const [jobId,      setJobId]      = useState<string | null>(null)
  const [extraction, setExtraction] = useState<SchoolManualExtraction | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [fileName,   setFileName]   = useState('')

  const handleUpload = useCallback(async (files: File[]) => {
    setError(null)
    setFileName(files.map(f => f.name).join(', '))
    setStep(2)

    const formData = new FormData()
    formData.append('storeId',  storeId)
    formData.append('storePin', storePin)
    files.forEach(f => formData.append('files', f))

    try {
      const res = await fetch('/api/ocr/process', { method: 'POST', body: formData })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? 'OCR処理に失敗しました')
      setJobId(json.jobId)
      setExtraction(json.result)
      setStep(3)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setStep(1)
    }
  }, [storeId, storePin])

  const handleConfirm = useCallback(async (data: {
    schoolId: string | null; schoolName: string
    wearingRegulations: string | null; specialNotes: string | null
    scheduleNotes: string | null; extraInfo: string | null
    selectedIndices: number[]
  }) => {
    if (!jobId) return
    setError(null)

    const body: OcrImportRequest = {
      storeId, storePin,
      schoolId:           data.schoolId,
      schoolName:         data.schoolName,
      selectedIndices:    data.selectedIndices,
      wearingRegulations: data.wearingRegulations,
      specialNotes:       data.specialNotes,
      scheduleNotes:      data.scheduleNotes,
      extraInfo:          data.extraInfo,
    }

    try {
      const res = await fetch(`/api/ocr/import/${jobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error ?? '取込に失敗しました')
      setImportResult({
        schoolId:     json.schoolId,
        schoolName:   json.schoolName,
        importedCount: json.importedCount,
        skippedCount:  json.skippedCount,
      })
      setStep(4)
      onImportComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [jobId, storeId, storePin, onImportComplete])

  const handleReset = () => {
    setStep(1); setJobId(null); setExtraction(null)
    setImportResult(null); setError(null); setFileName('')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-zinc-50 rounded-3xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-black text-zinc-800">📂 マニュアルから取込</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400
              hover:bg-zinc-200 transition-colors text-lg"
          >×</button>
        </div>

        <WizardHeader step={step} />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700 mb-4">
            ⚠️ {error}
          </div>
        )}

        {step === 1 && <Step1Upload onUpload={handleUpload} />}
        {step === 2 && <Step2Processing fileName={fileName} />}
        {step === 3 && extraction && (
          <Step3Review
            extraction={extraction}
            schools={schools}
            onConfirm={handleConfirm}
            onBack={() => setStep(1)}
          />
        )}
        {step === 4 && importResult && (
          <Step4Complete
            result={importResult}
            onReset={handleReset}
            onClose={() => { onClose(); onImportComplete() }}
          />
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: コミット**

```bash
git add "app/[storeId]/admin/master/manage/_components/ManualImportWizard.tsx"
git commit -m "feat: add ManualImportWizard 4-step UI component"
```

---

## Task 11: Master Manage ページへの統合

**Files:**
- Modify: `app/[storeId]/admin/master/manage/page.tsx`

- [ ] **Step 1: ページ先頭のimportを追加**

`page.tsx` の既存 import 群の末尾に追加:

```typescript
import ManualImportWizard from './_components/ManualImportWizard'
```

- [ ] **Step 2: MasterManagePage コンポーネント内に state を追加**

`MasterManagePage` 関数の先頭付近（既存の `useState` と同じ場所）に追加:

```typescript
const [showOcrWizard, setShowOcrWizard] = useState(false)
```

- [ ] **Step 3: 「マニュアルから取込」ボタンを追加**

ページのヘッダー部分（学校選択UIの近く、既存の「学校を追加」ボタンがある行）に追加:

```tsx
<button
  onClick={() => setShowOcrWizard(true)}
  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold
    bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-sm"
>
  📂 マニュアルから取込
</button>
```

- [ ] **Step 4: ウィザードモーダルをレンダリング**

`return` の最後（`</div>` 閉じタグの直前）に追加:

```tsx
{showOcrWizard && (
  <ManualImportWizard
    storeId={storeId}
    storePin={storePin}          // ページの既存 storePin state を渡す
    schools={schools}            // ページの既存 schools state を渡す
    onClose={() => setShowOcrWizard(false)}
    onImportComplete={async () => {
      setShowOcrWizard(false)
      await loadAll()            // マスタ再読込（既存の reload 関数名に合わせる）
    }}
  />
)}
```

> **注意**: `storePin` と `loadAll`（または相当する再読込関数）の実際の変数名は `page.tsx` の実装に合わせること。`page.tsx` を Read で確認してから編集すること。

- [ ] **Step 5: ビルド確認**

```bash
npm run build
```

TypeScript エラーがないことを確認。エラーがあれば型を修正する。

- [ ] **Step 6: コミット**

```bash
git add "app/[storeId]/admin/master/manage/page.tsx"
git commit -m "feat: integrate ManualImportWizard into master manage page"
```

---

## Task 12: 動作確認 & 最終プッシュ

- [ ] **Step 1: 開発サーバーを起動**

```bash
npm run dev
```

- [ ] **Step 2: 動作確認チェックリスト**

実際のブラウザで以下を確認:

| 確認項目 | 期待動作 |
|---|---|
| マスタ管理ページに「マニュアルから取込」ボタンが表示される | ✓ |
| ボタンクリックでウィザードモーダルが開く | ✓ |
| Step 1 で JPG/PDF/Excel をドラッグ＆ドロップできる | ✓ |
| Step 2 でスピナーが表示される | ✓ |
| Step 3 で学校名マッチング（A/B/C パターン）が正しく動作する | ✓ |
| Step 3 の着用規定・特記事項タブが編集できる | ✓ |
| Step 3 の商品タブでチェックボックスの選択/解除ができる | ✓ |
| 「すべて取り込む」でStep 4 に遷移する | ✓ |
| Step 4 の完了画面に登録件数が表示される | ✓ |
| マスタ管理に戻ると学校・商品・価格が登録されている | ✓ |
| 学校名不明（パターンC）で手入力して新規作成できる | ✓ |

- [ ] **Step 3: .gitignore に .superpowers を追加（未追加の場合）**

```bash
echo ".superpowers/" >> .gitignore
```

- [ ] **Step 4: 最終コミット & プッシュ**

```bash
git add .gitignore
git commit -m "chore: add .superpowers to gitignore"
git push origin main
```

---

## 実装後の確認事項

- `page.tsx` の `storePin` 取得方法を確認すること（セッション・URLパラメータ等、既存実装に依存）
- Vercel 環境変数に `ANTHROPIC_API_KEY` が設定されていることを確認
- Vercel Pro プランの場合 `maxDuration = 300` が有効になる（Hobby は 60s）
- Excel 対応は `xlsx` パッケージのインストールが必要（Task 6 Step 1）
