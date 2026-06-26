// ============================================================================
//  お直しマスタ プリセット（標準お直し一式）
//  - seedRepairPresets(): 服種>項目>オプションを「追記式・冪等」で投入。
//    既存（同 code）はスキップし、不足分のみ追加する。店舗は金額を直すだけ。
//  - buildSizeTier(): サイズ段階の択一オプションを生成（page.tsx の generateSizes と同規則）。
//  - SIZE_RANGE_PRESETS: 生成モーダルの「クイック範囲」チップ用プリセット。
//  内容のベースは sql/repair-system-seed.sql。サイズ系項目にはタップ選択の段階を同梱。
// ============================================================================

import { supabase } from './supabase'
import type { PriceUnit, MeasurementDef, RepairManual } from '@/types/repair'

// ── プリセット定義の型（ローカル） ──────────────────────────────
interface PresetOption {
  group_label:      string | null
  group_select:     'single' | 'multi'
  code:             string
  name:             string
  price_delta:      number
  default_selected?: boolean
  requires_quote?:  boolean
  manual?:          RepairManual | null
}
interface PresetItem {
  code:           string
  name:           string
  icon:           string
  base_price:     number
  price_unit:     PriceUnit
  measurements?:  MeasurementDef[]
  lead_time_days?: number | null
  requires_quote?: boolean
  options?:       PresetOption[]
}
interface PresetGarment {
  code:  string
  name:  string
  icon:  string
  items: PresetItem[]
}

// ── サイズ段階生成（プリセット定義 & クイック範囲で共用） ────────
export function buildSizeTier(opts: {
  groupCode:   string                // code のユニーク化に使う英数キー（例: tsume）
  group:       string                // 表示グループ名（例: 詰め幅）
  min:         number
  max:         number
  step:        number
  unit?:       string                // 既定 cm（'文字' なども可）
  labelStyle?: 'upto' | 'exact'      // 〜Ncm / Ncm
  baseAdd?:    number                // 先頭バンドの加算（既定0）
  stepAdd?:    number                // 1段ふえるごとの加算（既定0=一律）
}): PresetOption[] {
  const { groupCode, group, min, max, step, unit = 'cm', labelStyle = 'upto', baseAdd = 0, stepAdd = 0 } = opts
  const out: PresetOption[] = []
  if (!(step > 0) || !(max >= min)) return out
  let idx = 0
  for (let v = min; v <= max + 1e-9 && out.length < 60; v += step) {
    const val = Math.round(v * 100) / 100
    out.push({
      group_label:  group,
      group_select: 'single',
      code:         `sz_${groupCode}_${val}`,
      name:         labelStyle === 'upto' ? `〜${val}${unit}` : `${val}${unit}`,
      price_delta:  Math.round(baseAdd + stepAdd * idx),
      default_selected: idx === 0 && stepAdd !== 0,   // 増分方式は先頭(=基本料金内)を初期選択
    })
    idx++
  }
  return out
}

// ── 生成モーダル「クイック範囲」チップ ───────────────────────────
export const SIZE_RANGE_PRESETS: {
  label: string; min: number; max: number; step: number; unit: string; labelStyle: 'upto' | 'exact'
}[] = [
  // 長さ（cm）
  { label: '〜5cm',          min: 1, max: 5,  step: 1, unit: 'cm', labelStyle: 'upto'  },
  { label: '〜10cm',         min: 1, max: 10, step: 1, unit: 'cm', labelStyle: 'upto'  },
  { label: '〜20cm',         min: 2, max: 20, step: 2, unit: 'cm', labelStyle: 'upto'  },
  { label: '1cm刻み(1〜10)', min: 1, max: 10, step: 1, unit: 'cm', labelStyle: 'exact' },
  // 文字数（ネーム刺繍など）
  { label: '〜3文字',        min: 3, max: 3,  step: 1, unit: '文字', labelStyle: 'upto' },
  { label: '3〜10文字',      min: 3, max: 10, step: 1, unit: '文字', labelStyle: 'upto' },
]

// ── 特殊素材マニュアル（裾上げ） ────────────────────────────────
const SPECIAL_FABRIC_MANUAL: RepairManual = {
  title: '特殊素材の裾上げ注意',
  body:  'アイロン温度に注意。千鳥不可。職人確認のうえ個別見積もり。',
  severity: 'danger',
  images: [],
}

// ── 標準プリセット本体（ベース: sql/repair-system-seed.sql ＋ サイズ段階） ──
export const REPAIR_PRESET: PresetGarment[] = [
  {
    code: 'slacks', name: 'スラックス', icon: '👖',
    items: [
      {
        code: 'hem', name: '裾上げ', icon: '✂️', base_price: 1200, price_unit: 'per_item',
        measurements: [
          { key: 'hem_length_mm', label: '仕上がり丈', unit: 'mm', required: true },
          { key: 'fold_keep_mm',  label: '折り返し残し', unit: 'mm' },
        ],
        lead_time_days: 5,
        options: [
          { group_label: '仕上げ方法', group_select: 'single', code: 'matsuri', name: 'まつり縫い',       price_delta: 0,   default_selected: true },
          { group_label: '仕上げ方法', group_select: 'single', code: 'stitch',  name: 'シングルステッチ', price_delta: 200 },
          { group_label: '仕上げ方法', group_select: 'single', code: 'chidori', name: '千鳥がけ',         price_delta: 300 },
          { group_label: null, group_select: 'multi', code: 'nonslip', name: 'すべり止めテープ', price_delta: 200 },
          { group_label: null, group_select: 'multi', code: 'special_fabric', name: '特殊素材（撥水・防シワ等）', price_delta: 0, requires_quote: true, manual: SPECIAL_FABRIC_MANUAL },
        ],
      },
      {
        code: 'waist', name: 'ウエスト詰め・出し', icon: '📏', base_price: 1500, price_unit: 'per_item',
        measurements: [{ key: 'waist_adjust_mm', label: '増減量', unit: 'mm', required: true }],
        lead_time_days: 5,
        options: [
          ...buildSizeTier({ groupCode: 'tsume', group: '詰め幅', min: 1, max: 5, step: 1 }),
          ...buildSizeTier({ groupCode: 'dashi', group: '出し幅', min: 1, max: 5, step: 1 }),
        ],
      },
      { code: 'tear', name: '破れ補修', icon: '🩹', base_price: 1000, price_unit: 'per_item', lead_time_days: 7 },
    ],
  },
  {
    code: 'skirt', name: 'スカート', icon: '👗',
    items: [
      {
        code: 'hem', name: '丈詰め', icon: '✂️', base_price: 1500, price_unit: 'per_item',
        measurements: [{ key: 'hem_length_mm', label: '仕上がり丈', unit: 'mm', required: true }],
        lead_time_days: 5,
        options: buildSizeTier({ groupCode: 'skhem', group: '詰め丈', min: 2, max: 20, step: 2 }),
      },
      {
        code: 'waist', name: 'ウエスト調整', icon: '📏', base_price: 1500, price_unit: 'per_item',
        measurements: [{ key: 'waist_adjust_mm', label: '増減量', unit: 'mm', required: true }],
        lead_time_days: 5,
        options: buildSizeTier({ groupCode: 'skwaist', group: '調整幅', min: 1, max: 5, step: 1 }),
      },
    ],
  },
  {
    code: 'jacket', name: '上着（ブレザー・学ラン）', icon: '🧥',
    items: [
      {
        code: 'sleeve', name: '袖丈直し', icon: '👔', base_price: 2000, price_unit: 'per_item',
        measurements: [{ key: 'sleeve_adjust_mm', label: '袖丈増減', unit: 'mm', required: true }],
        lead_time_days: 7,
        options: buildSizeTier({ groupCode: 'sode', group: '袖丈', min: 1, max: 5, step: 1 }),
      },
      { code: 'badge',  name: '校章付け',       icon: '🏅', base_price: 500, price_unit: 'per_item', lead_time_days: 3 },
      { code: 'button', name: 'ボタン付け替え', icon: '🔘', base_price: 300, price_unit: 'per_item', lead_time_days: 3 },
      {
        // ネーム刺繍は「3文字まで固定 → 超過は1文字ごとに加算」の帯モデル。
        // 基本料金=3文字までの価格、文字数バンドで超過分を加算（受付はタップ選択）。
        // ローマ字が別単価のときは別項目（例: ネーム刺繍（ローマ字））を作るのが簡単。
        code: 'embroidery', name: 'ネーム刺繍', icon: '🔤', base_price: 500, price_unit: 'per_item',
        measurements: [{ key: 'text', label: '刺繍文字（控え）', unit: '文字' }],
        lead_time_days: 7,
        options: [
          // 文字数: 〜3文字+0 / 〜4文字+100 / 〜5文字+200 …（超過1文字100円）
          ...buildSizeTier({ groupCode: 'mojisuu', group: '文字数', min: 3, max: 10, step: 1, unit: '文字', baseAdd: 0, stepAdd: 100 }),
          { group_label: '文字種', group_select: 'single', code: 'kanji', name: '漢字・かな', price_delta: 0, default_selected: true },
          { group_label: '文字種', group_select: 'single', code: 'romaji', name: 'ローマ字', price_delta: 0 },
          { group_label: '書体', group_select: 'single', code: 'gothic', name: 'ゴシック体', price_delta: 0, default_selected: true },
          { group_label: '書体', group_select: 'single', code: 'mincho', name: '明朝体',     price_delta: 0 },
          { group_label: '色',   group_select: 'single', code: 'navy',   name: '紺',         price_delta: 0, default_selected: true },
          { group_label: '色',   group_select: 'single', code: 'white',  name: '白',         price_delta: 0 },
          { group_label: '色',   group_select: 'single', code: 'gold',   name: '金（+料金）', price_delta: 100 },
        ],
      },
      { code: 'tear', name: '破れ補修', icon: '🩹', base_price: 1200, price_unit: 'per_item', lead_time_days: 7 },
    ],
  },
  {
    code: 'shirt', name: 'シャツ・ブラウス', icon: '👔',
    items: [
      { code: 'tear',   name: '破れ補修',         icon: '🩹', base_price: 800, price_unit: 'per_item', lead_time_days: 5 },
      { code: 'button', name: 'ボタン付け替え', icon: '🔘', base_price: 300, price_unit: 'per_item', lead_time_days: 3 },
    ],
  },
  {
    code: 'other', name: 'その他', icon: '📦',
    items: [
      { code: 'other', name: '特殊対応・その他（個別見積もり）', icon: '📝', base_price: 0, price_unit: 'per_item', lead_time_days: 7, requires_quote: true },
    ],
  },
]

// ── 追記式シード（既存は壊さない・不足分のみ追加） ──────────────
export async function seedRepairPresets(
  storeId: string,
): Promise<{ garments: number; items: number; options: number }> {
  let gAdded = 0, iAdded = 0, oAdded = 0
  const db = supabase as any

  // 既存服種
  const { data: exG } = await db.from('repair_garment_types')
    .select('id, code, sort_order').eq('store_id', storeId)
  const garmentByCode = new Map<string, string>((exG ?? []).map((g: any) => [g.code, g.id as string]))
  let gSort = Math.max(0, ...((exG ?? []).map((g: any) => g.sort_order ?? 0)))

  for (const pg of REPAIR_PRESET) {
    let garmentId = garmentByCode.get(pg.code)
    if (!garmentId) {
      gSort += 10
      const { data, error } = await db.from('repair_garment_types')
        .insert({ store_id: storeId, code: pg.code, name: pg.name, icon: pg.icon, sort_order: gSort })
        .select('id').single()
      if (error || !data) continue
      garmentId = data.id as string
      garmentByCode.set(pg.code, garmentId)
      gAdded++
    }
    const gid = garmentId

    // 既存項目（この服種配下）
    const { data: exI } = await db.from('repair_items')
      .select('id, code, sort_order').eq('store_id', storeId).eq('garment_type_id', gid)
    const itemByCode = new Map<string, string>((exI ?? []).map((it: any) => [it.code, it.id as string]))
    let iSort = Math.max(0, ...((exI ?? []).map((it: any) => it.sort_order ?? 0)))

    for (const pi of pg.items) {
      let itemId = itemByCode.get(pi.code)
      if (!itemId) {
        iSort += 10
        const { data, error } = await db.from('repair_items').insert({
          store_id: storeId, garment_type_id: gid,
          code: pi.code, name: pi.name, icon: pi.icon,
          base_price: pi.base_price, price_unit: pi.price_unit,
          measurements: pi.measurements ?? [], manual: null,
          lead_time_days: pi.lead_time_days ?? null,
          requires_quote: pi.requires_quote ?? false,
          sort_order: iSort,
        }).select('id').single()
        if (error || !data) continue
        itemId = data.id as string
        itemByCode.set(pi.code, itemId)
        iAdded++
      }
      const iid = itemId
      if (!pi.options?.length) continue

      // 既存オプション（この項目配下）
      const { data: exO } = await db.from('repair_options').select('code, sort_order').eq('item_id', iid)
      const optCodes = new Set<string>((exO ?? []).map((o: any) => o.code as string))
      let oSort = Math.max(0, ...((exO ?? []).map((o: any) => o.sort_order ?? 0)))

      const toInsert = pi.options
        .filter(po => !optCodes.has(po.code))
        .map(po => {
          oSort += 10
          return {
            store_id: storeId, item_id: iid,
            group_label: po.group_label, group_select: po.group_select,
            code: po.code, name: po.name,
            price_delta: po.price_delta, price_unit: 'per_item' as PriceUnit,
            default_selected: po.default_selected ?? false,
            requires_quote: po.requires_quote ?? false,
            manual: po.manual ?? null,
            sort_order: oSort,
          }
        })
      if (toInsert.length) {
        const { error } = await db.from('repair_options').insert(toInsert)
        if (!error) oAdded += toInsert.length
      }
    }
  }

  return { garments: gAdded, items: iAdded, options: oAdded }
}
