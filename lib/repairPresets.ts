// ============================================================================
//  お直しマスタ プリセット（標準お直し一式）
//  - seedRepairPresets(): 服種>項目>オプションを「追記式・冪等」で投入。
//    既存（同 code）はスキップし、不足分のみ追加する。店舗は金額を直すだけ。
//  - buildSizeTier(): サイズ段階の択一オプションを生成（page.tsx の generateSizes と同規則）。
//  - SIZE_RANGE_PRESETS: 生成モーダルの「クイック範囲」チップ用プリセット。
//  内容のベースは sql/repair-system-seed.sql。サイズ系項目にはタップ選択の段階を同梱。
// ============================================================================

import { supabase } from './supabase'
import type { PriceUnit, MeasurementDef, FieldDef, RepairManual } from '@/types/repair'
import type { PresetKey } from './repairProfile'

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
  fields?:        FieldDef[]          // 受付で聞く入力（measurements の一般化）
  manual?:        RepairManual | null
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

// ============================================================================
//  ラケットショップ プリセット（ガット張り）
//  実店舗の「ガット張り申込用紙」の欄をそのまま写した最小形。
//  ・テンションは縦/横を分けず「ポンド数」1つ（実伝票がそうなっている）
//  ・機種・色は customer_rackets（Phase 2）から入るので項目には持たない
//  設計: docs/repair-flexible-catalog-design.md §4-4
// ============================================================================

// ラケットのメーカー候補（バドミントン・テニス共通で流通量の多い順）。
// マスタ(repair_items.fields)に入るデータなので、店ごとに追加・削除できる。
const RACKET_MAKERS = [
  'ヨネックス', 'ミズノ', 'ゴーセン', 'プリンス', 'ウイルソン',
  'バボラ', 'ヘッド', 'ダンロップ', 'ビクター', 'リーニン',
]

// 伝票下部の免責文をそのまま確認必須チェックにする
const RACKET_DISCLAIMER: RepairManual = {
  title:    'フレーム破損の免責について',
  body:     'フレームに傷やヒビ割れ等がありますと、適正ポンド数であっても破損してしまうことがあります。'
          + 'ご了承いただいた上でお預かりいたします。\n'
          + '※お客様に「傷やヒビで破損する可能性があっても張ってよいか」を必ず確認してください。',
  severity: 'danger',
  images:   [],
}

// 競技ごとに適正ポンド数の幅が違うので、レンジだけ差し替えて使う
function stringingFields(opts: { min: number; max: number; def: number }): FieldDef[] {
  return [
    // どのラケットに張るかが分からないと現場で特定できない。
    // 2本目以降は過去の入力がタップ候補で出るので、打つのは初回だけ。
    { key: 'racket', label: 'ラケット', type: 'text', required: true,
      suggest_from_history: true,
      // メーカーはタップで先頭に入る。機種名はそのまま続けて打てる。
      suggest_choices: RACKET_MAKERS,
      hint: 'メーカーをタップ →機種・色を入力（例: ヨネックス アストロクス100ZZ 赤）' },
    { key: 'tension_lbs', label: 'ポンド数', type: 'number', unit: 'P', required: true,
      default: opts.def, min: opts.min, max: opts.max, step: 1,
      hint: `適正範囲 ${opts.min}〜${opts.max}P` },
    { key: 'string_name', label: 'ガット名（カラー）', type: 'material',
      material_category: 'string',
      hint: '商品マスタの「string」カテゴリから銘柄→色でタップ選択。持ち込みは手入力' },
    { key: 'bring_in', label: 'ガット持ち込み', type: 'bool', default: false,
      hint: 'ON＝お客様持ち込み（ガット代なし）' },
    { key: 'over_3months', label: '購入後3ヶ月以上経過', type: 'bool', default: false,
      hint: '伝票の確認欄。フレーム破損リスクの判断材料' },
  ]
}

// 全競技で共通のグリップ関連オプション（伝票の「グリップ 有（布・ハード）・無」）
function gripOptions(): PresetOption[] {
  return [
    { group_label: 'グリップ', group_select: 'single', code: 'grip_none',  name: '無',           price_delta: 0, default_selected: true },
    { group_label: 'グリップ', group_select: 'single', code: 'grip_cloth', name: '有（布）',     price_delta: 0 },
    { group_label: 'グリップ', group_select: 'single', code: 'grip_hard',  name: '有（ハード）', price_delta: 0 },
    { group_label: null, group_select: 'multi', code: 'grip_wrap', name: 'グリップ巻く', price_delta: 0 },
  ]
}

export const RACKET_PRESET: PresetGarment[] = [
  {
    code: 'badminton', name: 'バドミントン', icon: '🏸',
    items: [
      {
        code: 'stringing', name: 'ガット張り', icon: '🎯',
        base_price: 0, price_unit: 'per_item',
        fields: stringingFields({ min: 15, max: 30, def: 24 }),
        manual: RACKET_DISCLAIMER,
        lead_time_days: 2,
        options: gripOptions(),
      },
    ],
  },
  {
    code: 'tennis', name: 'テニス', icon: '🎾',
    items: [
      {
        code: 'stringing', name: 'ガット張り', icon: '🎯',
        base_price: 0, price_unit: 'per_item',
        fields: stringingFields({ min: 35, max: 65, def: 50 }),
        manual: RACKET_DISCLAIMER,
        lead_time_days: 2,
        options: gripOptions(),
      },
    ],
  },
  {
    code: 'soft_tennis', name: 'ソフトテニス', icon: '🥎',
    items: [
      {
        code: 'stringing', name: 'ガット張り', icon: '🎯',
        base_price: 0, price_unit: 'per_item',
        fields: stringingFields({ min: 20, max: 40, def: 30 }),
        manual: RACKET_DISCLAIMER,
        lead_time_days: 2,
        options: gripOptions(),
      },
    ],
  },
  {
    // 制服プリセットにも code:'other' の服種があるため、併用店で衝突しないよう別コードにする
    code: 'racket_other', name: 'ラケットその他', icon: '🔧',
    items: [
      {
        code: 'repair', name: 'その他・修理（個別見積もり）', icon: '📝',
        base_price: 0, price_unit: 'per_item',
        fields: [{ key: 'symptom', label: '症状・ご要望', type: 'text', required: true }],
        lead_time_days: 7, requires_quote: true,
      },
    ],
  },
]

// ── 標準セット ──────────────────────────────────────────────
//  「どの語彙で見せるか(profile)」と「どのセットを取り込むか(PresetKey)」は
//  別の判断。両方やる店は両方取り込める（追記式・冪等なので順不同・再実行可）。
export const PRESETS_BY_KEY: Record<PresetKey, PresetGarment[]> = {
  uniform: REPAIR_PRESET,
  racket:  RACKET_PRESET,
}

// ── 追記式シード（既存は壊さない・不足分のみ追加） ──────────────
export async function seedRepairPresets(
  storeId: string,
  presetKey: PresetKey = 'uniform',
): Promise<{ garments: number; items: number; options: number; error?: string }> {
  let gAdded = 0, iAdded = 0, oAdded = 0
  // 失敗を握りつぶすと「追加分はありませんでした」と嘘の成功を返してしまうので、
  // 最初のエラーを持ち帰って呼び出し側で表示する
  let firstError: string | null = null
  const db = supabase as any
  const preset = PRESETS_BY_KEY[presetKey] ?? REPAIR_PRESET

  // 既存服種
  const { data: exG } = await db.from('repair_garment_types')
    .select('id, code, sort_order').eq('store_id', storeId)
  const garmentByCode = new Map<string, string>((exG ?? []).map((g: any) => [g.code, g.id as string]))
  let gSort = Math.max(0, ...((exG ?? []).map((g: any) => g.sort_order ?? 0)))

  for (const pg of preset) {
    let garmentId = garmentByCode.get(pg.code)
    if (!garmentId) {
      gSort += 10
      const { data, error } = await db.from('repair_garment_types')
        .insert({ store_id: storeId, code: pg.code, name: pg.name, icon: pg.icon, sort_order: gSort })
        .select('id').single()
      if (error || !data) { firstError ??= error?.message ?? `${pg.name} の追加に失敗しました`; continue }
      garmentId = data.id as string
      garmentByCode.set(pg.code, garmentId)
      gAdded++
    }
    const gid = garmentId

    // 既存項目（この服種配下）
    const { data: exI } = await db.from('repair_items')
      .select('id, code, sort_order, fields').eq('store_id', storeId).eq('garment_type_id', gid)
    const itemByCode  = new Map<string, string>((exI ?? []).map((it: any) => [it.code, it.id as string]))
    const itemFieldsBy = new Map<string, FieldDef[]>((exI ?? []).map((it: any) => [it.code, (it.fields ?? []) as FieldDef[]]))
    let iSort = Math.max(0, ...((exI ?? []).map((it: any) => it.sort_order ?? 0)))

    for (const pi of pg.items) {
      let itemId = itemByCode.get(pi.code)
      if (itemId && pi.fields?.length) {
        // 取り込み済みの項目にも、プリセット側で後から増えた入力欄を足す。
        // 既存キーには触らないので、店が直した内容は壊れない（追記式）。
        const cur  = itemFieldsBy.get(pi.code) ?? []
        const have = new Set(cur.map(f => f.key))
        const add  = pi.fields.filter(f => !have.has(f.key))
        if (add.length) {
          // プリセットの並び順を保つため、定義順にマージし直す
          const merged = [...pi.fields.filter(f => !have.has(f.key)), ...cur]
          const { error } = await db.from('repair_items').update({ fields: merged }).eq('id', itemId)
          if (error) firstError ??= error.message
          else iAdded += 0   // 新規追加ではないので件数には数えない
        }
      }
      if (!itemId) {
        iSort += 10
        const { data, error } = await db.from('repair_items').insert({
          store_id: storeId, garment_type_id: gid,
          code: pi.code, name: pi.name, icon: pi.icon,
          base_price: pi.base_price, price_unit: pi.price_unit,
          measurements: pi.measurements ?? [],
          fields: pi.fields ?? [],
          manual: pi.manual ?? null,
          lead_time_days: pi.lead_time_days ?? null,
          requires_quote: pi.requires_quote ?? false,
          sort_order: iSort,
        }).select('id').single()
        if (error || !data) { firstError ??= error?.message ?? `${pi.name} の追加に失敗しました`; continue }
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
        if (error) firstError ??= error.message
        else oAdded += toInsert.length
      }
    }
  }

  return { garments: gAdded, items: iAdded, options: oAdded, error: firstError ?? undefined }
}

// ── BulkImportModal向けシンプルプリセット（プリセットボタン用） ──
export interface BulkPresetItem { name: string; price: number }
export interface BulkPresetGarment { name: string; icon: string; items: BulkPresetItem[] }

export const REPAIR_PRESETS: BulkPresetGarment[] = [
  {
    name: '学ラン上着', icon: 'gakuran',
    items: [
      { name: '袖丈詰め', price: 2000 },
      { name: '着丈詰め', price: 3000 },
      { name: '肩幅詰め', price: 3000 },
      { name: 'ボタン付け替え', price: 1000 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: '学ランズボン', icon: 'trousers',
    items: [
      { name: '裾上げ', price: 1500 },
      { name: 'ウエスト詰め', price: 2000 },
      { name: 'ウエスト出し', price: 2000 },
      { name: '股下直し', price: 2000 },
    ],
  },
  {
    name: 'ブレザー', icon: 'blazer',
    items: [
      { name: '袖丈詰め', price: 2500 },
      { name: '着丈詰め', price: 3500 },
      { name: '肩幅詰め', price: 3500 },
      { name: '身幅詰め', price: 3000 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: 'スラックス', icon: 'trousers',
    items: [
      { name: '裾上げ（シングル）', price: 1500 },
      { name: '裾上げ（ダブル）', price: 2000 },
      { name: 'ウエスト詰め', price: 2000 },
      { name: 'ウエスト出し', price: 2000 },
    ],
  },
  {
    name: 'スカート', icon: 'skirt',
    items: [
      { name: '丈詰め', price: 2000 },
      { name: 'ウエスト詰め', price: 2000 },
      { name: 'ウエスト出し', price: 2000 },
      { name: 'ホック付け替え', price: 800 },
    ],
  },
  {
    name: 'セーラー服', icon: 'sailor',
    items: [
      { name: '着丈詰め', price: 3000 },
      { name: '袖丈詰め', price: 2000 },
      { name: '身幅詰め', price: 3000 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: 'ジャージ', icon: 'jersey',
    items: [
      { name: '裾上げ', price: 1500 },
      { name: '袖丈詰め', price: 1500 },
      { name: 'ウエストゴム交換', price: 1500 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: 'ワイシャツ・ブラウス', icon: 'shirt',
    items: [
      { name: '袖丈詰め', price: 1500 },
      { name: '着丈詰め', price: 1500 },
      { name: '名前刺繍', price: 500 },
    ],
  },
  {
    name: 'セーター・ベスト', icon: 'sweater',
    items: [
      { name: '着丈詰め', price: 2500 },
      { name: '袖丈詰め', price: 2000 },
      { name: '名前刺繍', price: 500 },
    ],
  },
]
