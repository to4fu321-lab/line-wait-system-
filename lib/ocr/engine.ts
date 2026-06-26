// ============================================================
// OCR エンジン: ファイル種別を判定して適切な抽出器へ振り分け、
//   Claude へ送信して学校マニュアル構造化 JSON を得る。
//   設計: docs/superpowers/specs/2026-06-15-manual-ocr-import-design.md
// ============================================================
import Anthropic from '@anthropic-ai/sdk'
import { classifyFile, type OcrBlock } from './types'
import { imageBlock } from './extractors/image'
import { pdfBlock } from './extractors/pdf'
import { sheetToText } from './extractors/excel'
import {
  SCHOOL_MANUAL_PROMPT,
  type SchoolManualExtraction,
  type SchoolManualItem,
} from './schemas/school-manual'

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'
const IMAGE_BATCH = 15 // 1リクエストあたりの最大画像枚数（API上限20の安全マージン）

export interface OcrRunResult {
  extraction: SchoolManualExtraction
  tokensUsed: number
  fileCount:  number
}

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function emptyExtraction(): SchoolManualExtraction {
  return {
    school_name: null, wearing_regulations: null, special_notes: null,
    schedule_notes: null, extra_info: null, items: [], confidence: 'medium', warnings: [],
  }
}

// Claude のテキスト応答から JSON を取り出してパース
function parseExtraction(text: string): SchoolManualExtraction {
  const fence = text.match(/```json\s*([\s\S]*?)```/)
  const raw = fence ? fence[1] : (text.match(/\{[\s\S]*\}/)?.[0] ?? '')
  if (!raw) throw new Error('OCR応答からJSONを抽出できませんでした')
  const obj = JSON.parse(raw)
  const base = emptyExtraction()
  return {
    school_name:         obj.school_name ?? null,
    wearing_regulations: obj.wearing_regulations ?? null,
    special_notes:       obj.special_notes ?? null,
    schedule_notes:      obj.schedule_notes ?? null,
    extra_info:          obj.extra_info ?? null,
    items:               Array.isArray(obj.items) ? obj.items.map(normalizeItem) : [],
    confidence:          obj.confidence ?? base.confidence,
    warnings:            Array.isArray(obj.warnings) ? obj.warnings.map(String) : [],
  }
}

function toNumberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d.-]/g, ''))
  return Number.isFinite(n) ? n : null
}

function normalizeItem(it: any): SchoolManualItem {
  return {
    item_name:       String(it?.item_name ?? '').trim() || '(名称不明)',
    category:        it?.category ?? null,
    gender:          it?.gender ?? null,
    maker:           it?.maker ?? null,
    maker_code:      it?.maker_code ?? null,
    required:        it?.required !== false,
    avg_qty:         toNumberOrNull(it?.avg_qty),
    notes:           it?.notes ?? null,
    eo_price_tax_in: toNumberOrNull(it?.eo_price_tax_in),
    sizes: Array.isArray(it?.sizes)
      ? it.sizes.map((s: any) => ({ label: String(s?.label ?? '').trim(), price_tax_in: toNumberOrNull(s?.price_tax_in) }))
      : [],
    confidence:      it?.confidence === 'low' || it?.confidence === 'medium' ? it.confidence : 'high',
  }
}

// 複数リクエストの抽出結果を1つにマージ
function mergeExtractions(parts: SchoolManualExtraction[]): SchoolManualExtraction {
  const merged = emptyExtraction()
  const texts: Record<'wearing_regulations' | 'special_notes' | 'schedule_notes' | 'extra_info', string[]> = {
    wearing_regulations: [], special_notes: [], schedule_notes: [], extra_info: [],
  }
  let lowSeen = false, highSeen = false
  for (const p of parts) {
    if (!merged.school_name && p.school_name) merged.school_name = p.school_name
    for (const k of Object.keys(texts) as (keyof typeof texts)[]) {
      if (p[k]) texts[k].push(p[k] as string)
    }
    merged.items.push(...p.items)
    merged.warnings.push(...p.warnings)
    if (p.confidence === 'low') lowSeen = true
    if (p.confidence === 'high') highSeen = true
  }
  merged.wearing_regulations = texts.wearing_regulations.join('\n\n') || null
  merged.special_notes       = texts.special_notes.join('\n\n') || null
  merged.schedule_notes      = texts.schedule_notes.join('\n\n') || null
  merged.extra_info          = texts.extra_info.join('\n\n') || null
  merged.confidence = lowSeen ? 'low' : (highSeen ? 'high' : 'medium')
  return merged
}

async function callClaude(client: Anthropic, model: string, blocks: OcrBlock[]): Promise<{ extraction: SchoolManualExtraction; tokens: number }> {
  const res = await client.messages.create({
    model,
    max_tokens: 8192,
    messages: [{
      role: 'user',
      // SDK の content block 型へ cast（OcrBlock は構造的に一致）
      content: [...blocks, { type: 'text', text: SCHOOL_MANUAL_PROMPT }] as any,
    }],
  })
  const text = res.content.find((c) => c.type === 'text')
  const out = text && text.type === 'text' ? text.text : ''
  const tokens = (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0)
  return { extraction: parseExtraction(out), tokens }
}

export async function runSchoolManualOcr(
  files: File[],
  opts: { model?: string } = {},
): Promise<OcrRunResult> {
  const model = opts.model ?? DEFAULT_MODEL
  const client = getClient()

  // 種別ごとにリクエスト用ブロック群を構築
  const imageBlocks: OcrBlock[] = []
  const pdfRequests: OcrBlock[][] = []
  const sheetTexts: string[] = []

  for (const f of files) {
    const kind = classifyFile(f)
    if (kind === 'image') imageBlocks.push(await imageBlock(f))
    else if (kind === 'pdf') pdfRequests.push([await pdfBlock(f)])
    else if (kind === 'sheet') {
      const txt = await sheetToText(f)
      if (txt) sheetTexts.push(`## ファイル: ${f.name}\n${txt}`)
    }
  }

  const requests: OcrBlock[][] = []
  for (let i = 0; i < imageBlocks.length; i += IMAGE_BATCH) {
    requests.push(imageBlocks.slice(i, i + IMAGE_BATCH))
  }
  requests.push(...pdfRequests)
  if (sheetTexts.length > 0) {
    requests.push([{ type: 'text', text: `以下は表計算ファイルをCSV化したものです。\n\n${sheetTexts.join('\n\n')}` }])
  }

  if (requests.length === 0) {
    throw new Error('対応ファイル（画像 / PDF / Excel / CSV）がありません')
  }

  const parts: SchoolManualExtraction[] = []
  let tokensUsed = 0
  for (const blocks of requests) {
    const { extraction, tokens } = await callClaude(client, model, blocks)
    parts.push(extraction)
    tokensUsed += tokens
  }

  return { extraction: mergeExtractions(parts), tokensUsed, fileCount: files.length }
}
