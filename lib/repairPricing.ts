// ──────────────────────────────────────────────────────────────
//  お直し 価格計算ロジック
//
//  明細金額 = base_price × 数量係数 + Σ option.price_delta
//    数量係数: per_item/per_pair → qty, per_cm → 長さcm, per_name → 文字数
//
//  オプションは item と同じ単位なら従量、違えば固定加算（例: 文字数課金の刺繍に
//  「金色 +100/式」のような固定オプションを混ぜられる）。
// ──────────────────────────────────────────────────────────────
import type {
  RepairItem, RepairOption, PriceUnit, SelectedOptionSnapshot,
} from '@/types/repair'

// 単位ごとの「数量係数」を inputs から求める
export function unitFactor(
  unit: PriceUnit,
  inputs: Record<string, string | number>,
  qty: number,
): number {
  switch (unit) {
    case 'per_cm': {
      // "10cm" のような単位付き入力も許容。数値化できなければ 0(NaN を料金に伝播させない)
      const n = Number(String(inputs.length_cm ?? '').replace(/[^\d.]/g, ''))
      return Number.isFinite(n) ? n : 0
    }
    case 'per_name': return charCount(inputs.text)
    case 'per_pair': // 2点1組でも「組数」= qty として扱う
    case 'per_item':
    default:         return qty || 1
  }
}

// 刺繍などの文字数（全角・半角どちらも1文字、空白除外）
export function charCount(text: unknown): number {
  if (typeof text !== 'string') return 0
  return Array.from(text.replace(/\s/g, '')).length
}

// オプション選択スナップショット配列から加算額を求める
export function optionsTotal(
  itemUnit: PriceUnit,
  options: Pick<SelectedOptionSnapshot, 'price_delta' | 'price_unit'>[],
  inputs: Record<string, string | number>,
  qty: number,
): number {
  let sum = 0
  for (const op of options) {
    // オプション単位が項目と同じなら従量、違えば固定（×1）
    const factor = op.price_unit === itemUnit ? unitFactor(itemUnit, inputs, qty) : 1
    sum += op.price_delta * factor
  }
  return sum
}

// マスタ計算（理論値）。final_price はここをベースに確定/上書きする。
export function calcLinePrice(args: {
  item:    Pick<RepairItem, 'base_price' | 'price_unit'>
  options: Pick<SelectedOptionSnapshot, 'price_delta' | 'price_unit'>[]
  inputs:  Record<string, string | number>
  qty:     number
}): number {
  const { item, options, inputs, qty } = args
  const factor = unitFactor(item.price_unit, inputs, qty)
  const base   = item.base_price * factor
  const opts   = optionsTotal(item.price_unit, options, inputs, qty)
  return Math.max(0, Math.round(base + opts))
}

// 選んだオプションが1つでも requires_quote なら見積もりモードへ
export function needsQuote(
  item: Pick<RepairItem, 'requires_quote'>,
  selected: Pick<RepairOption, 'requires_quote'>[],
): boolean {
  return item.requires_quote || selected.some(o => o.requires_quote)
}

// RepairOption → 明細に保存するスナップショットへ変換
export function toOptionSnapshot(o: RepairOption): SelectedOptionSnapshot {
  return {
    option_id:   o.id,
    code:        o.code,
    name:        o.name,
    group_label: o.group_label,
    price_delta: o.price_delta,
    price_unit:  o.price_unit,
  }
}

// 営業日加算（土日のみ休み想定のシンプル版。祝日は考慮しない）
export function addBusinessDays(from: Date, days: number): Date {
  const d = new Date(from)
  let remaining = days
  while (remaining > 0) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) remaining--
  }
  return d
}
