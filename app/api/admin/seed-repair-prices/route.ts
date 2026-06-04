export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// ─────────────────────────────────────────────
// 2026/10 改定 学生服加工料金表
// ─────────────────────────────────────────────

interface PresetDef {
  item_name: string
  repair_type: string
  default_price: number | null
  notes: string | null
}

interface CategoryDef {
  categoryName: string
  sortOrder: number
  presets: PresetDef[]
}

const SEED_DATA: CategoryDef[] = [
  {
    categoryName: 'ジャケット上着',
    sortOrder: 1,
    presets: [
      { item_name: '袖丈 詰め・出し',                         repair_type: 'sleeve',        default_price: 2000, notes: null },
      { item_name: '袖丈 詰め（内あげ手まつり）',              repair_type: 'sleeve',        default_price: 1800, notes: null },
      { item_name: 'ボタン付け（1箇所）',                     repair_type: 'button',        default_price:  200, notes: null },
      { item_name: '袖丈 詰め グローイング',                   repair_type: 'sleeve',        default_price: 4000, notes: 'グローイング' },
      { item_name: '袖丈 詰め グローイング ダブル',            repair_type: 'sleeve',        default_price: 8000, notes: 'グローイング ダブル' },
      { item_name: '脇・バスト 詰め（グローイング）',          repair_type: 'size_exchange', default_price: 4000, notes: 'グローイング' },
      { item_name: '肩巾 詰め',                               repair_type: 'other',         default_price: 9000, notes: null },
      { item_name: '着丈 詰め・出し（グローイング）',          repair_type: 'other',         default_price: 4000, notes: 'グローイング' },
      { item_name: 'グローイング以外のお直し（脇幅・着丈）',   repair_type: 'other',         default_price:  null, notes: 'お見積り' },
    ],
  },
  {
    categoryName: '詰襟学生服上着',
    sortOrder: 2,
    presets: [
      { item_name: '衿取替え',                repair_type: 'other',  default_price: 3500, notes: null },
      { item_name: 'かぎホック直し',          repair_type: 'tear',   default_price:  900, notes: null },
      { item_name: '衿吊り交換',              repair_type: 'other',  default_price:  900, notes: null },
      { item_name: 'チェンジボタン（5箇所）', repair_type: 'button', default_price:  600, notes: null },
      { item_name: 'しつけ',                  repair_type: 'other',  default_price:  500, notes: null },
      { item_name: 'バッチ交換（プレス）',     repair_type: 'badge',  default_price:  400, notes: null },
      { item_name: '氏名片布付',              repair_type: 'other',  default_price:  600, notes: null },
      { item_name: 'レザー交換裏地ほどき有り', repair_type: 'tear',  default_price: 1700, notes: '裏地ほどき有り' },
    ],
  },
  {
    categoryName: 'スラックス',
    sortOrder: 3,
    presets: [
      { item_name: '裾丈（シングル）靴ずれなし',     repair_type: 'hem',   default_price:  700, notes: '加算: ヘム12〜15cm+400 / 15〜18cm+500 / スナップ+300 / グローイング+2000' },
      { item_name: '裾丈（シングル）靴ずれあり',     repair_type: 'hem',   default_price:  900, notes: '靴ずれあり / 加算: ヘム12〜15cm+400 / 15〜18cm+500 / スナップ+300 / グローイング+2000' },
      { item_name: '裾丈（ダブル）靴ずれなし',       repair_type: 'hem',   default_price: 1200, notes: 'ダブル / 加算: ヘム12〜15cm+400 / 15〜18cm+500 / ダブルスナップ+400 / ダブルダブル+2000' },
      { item_name: '裾丈（ダブル）靴ずれあり',       repair_type: 'hem',   default_price: 1400, notes: 'ダブル・靴ずれあり / 加算: ヘム12〜15cm+400 / 15〜18cm+500 / ダブルスナップ+400 / ダブルダブル+2000' },
      { item_name: '裾丈（グローイング）靴ずれなし', repair_type: 'hem',   default_price: 2000, notes: 'グローイング' },
      { item_name: '裾丈（グローイング）靴ずれあり', repair_type: 'hem',   default_price: 2200, notes: 'グローイング・靴ずれあり' },
      { item_name: '靴ずれ付け',                     repair_type: 'hem',   default_price:  500, notes: null },
      { item_name: 'ウエスト詰め・出し',             repair_type: 'waist', default_price: 1800, notes: null },
      { item_name: 'ウエスト三方詰め',               repair_type: 'waist', default_price: 4400, notes: null },
      { item_name: 'ベルトループ移動（一箇所）',     repair_type: 'other', default_price:  200, notes: null },
      { item_name: 'ファスナー取替え',               repair_type: 'tear',  default_price: 2800, notes: null },
      { item_name: '前カン取替え',                   repair_type: 'tear',  default_price: 1600, notes: null },
    ],
  },
  {
    categoryName: 'スカート',
    sortOrder: 4,
    presets: [
      { item_name: '裾から丈詰・出し（ボックス）',           repair_type: 'hem',   default_price: 2700, notes: null },
      { item_name: '裾から丈詰・出し（車ひだ）',             repair_type: 'hem',   default_price: 3100, notes: null },
      { item_name: 'ウエストから丈詰・出し（車ひだ）',       repair_type: 'waist', default_price: 4000, notes: 'ウエストから丈調整' },
      { item_name: 'ウエストから丈詰・出し（ボックス）',     repair_type: 'waist', default_price: 6000, notes: 'ウエストから丈調整' },
      { item_name: 'ウエスト 詰め・出し',                   repair_type: 'waist', default_price: 3500, notes: null },
      { item_name: 'ウエスト グローイング仕様',             repair_type: 'waist', default_price: 1800, notes: 'グローイング' },
      { item_name: 'ウエスト 詰め・出し（ベルト作成要）',   repair_type: 'waist', default_price: 4600, notes: 'ベルト作成込み' },
      { item_name: '3段カン→アジャスターに交換',            repair_type: 'other', default_price: 1000, notes: null },
    ],
  },
  {
    categoryName: 'セーラー服',
    sortOrder: 5,
    presets: [
      { item_name: '袖丈 詰め・出し',   repair_type: 'sleeve', default_price: 3000, notes: '小学校セーラー対応+2000' },
      { item_name: '肩幅 詰め',        repair_type: 'other',  default_price: 5400, notes: null },
      { item_name: '脇巾 詰め',        repair_type: 'other',  default_price: 4000, notes: null },
      { item_name: 'ボタン付け（1箇所）', repair_type: 'button', default_price:  200, notes: null },
    ],
  },
  {
    categoryName: 'ベスト',
    sortOrder: 6,
    presets: [
      { item_name: '脇巾・バスト 詰め', repair_type: 'other', default_price: 3200, notes: null },
      { item_name: '肩巾 詰め',        repair_type: 'other', default_price: 2800, notes: null },
    ],
  },
  {
    categoryName: 'コート',
    sortOrder: 7,
    presets: [
      { item_name: '袖丈 詰め・出し（尾錠移動あり）', repair_type: 'sleeve', default_price: 3200, notes: '尾錠移動あり' },
      { item_name: '着丈 詰め・出し',                 repair_type: 'other',  default_price: 4000, notes: null },
      { item_name: 'トグル付け（1個）',               repair_type: 'button', default_price: 1000, notes: null },
    ],
  },
  {
    categoryName: 'エンブレム・その他',
    sortOrder: 8,
    presets: [
      { item_name: 'エンブレム付け（ミシン）大',           repair_type: 'embroidery', default_price: 1600, notes: '裏地ほどき有り+700' },
      { item_name: 'エンブレム付け（ミシン）小',           repair_type: 'embroidery', default_price: 1300, notes: '裏地ほどき有り+700' },
      { item_name: 'エンブレム付け（手縫い）大',           repair_type: 'embroidery', default_price: 2200, notes: null },
      { item_name: 'エンブレム付け（手縫い）小',           repair_type: 'embroidery', default_price: 1700, notes: null },
      { item_name: '仕上げ（袋入れ・たたみ・シール貼りなど）', repair_type: 'other', default_price:  300, notes: null },
      { item_name: '伝票記入代（1枚）',                   repair_type: 'other',      default_price:  300, notes: null },
    ],
  },
]

// ─────────────────────────────────────────────
// GET: ドライラン（登録予定一覧を返す）
// ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get('storeId')
  if (!storeId) {
    return NextResponse.json({ ok: false, error: 'storeId パラメータが必要です（?storeId=xxx）' }, { status: 400 })
  }

  const { data: existingCats } = await (supabase as any)
    .from('repair_item_categories')
    .select('id, name')
    .eq('store_id', storeId)

  const existingCatNames = new Set<string>((existingCats ?? []).map((c: any) => c.name))

  const { data: existingPresets } = await (supabase as any)
    .from('repair_price_presets')
    .select('item_name, category_id')
    .eq('store_id', storeId)

  const existingPresetKeys = new Set<string>(
    (existingPresets ?? []).map((p: any) => `${p.category_id}|${p.item_name}`)
  )
  const catIdByName = Object.fromEntries(
    (existingCats ?? []).map((c: any) => [c.name, c.id])
  )

  const preview: { category: string; item_name: string; repair_type: string; price: number | null; notes: string | null; status: 'new' | 'skip' }[] = []

  for (const cat of SEED_DATA) {
    for (const p of cat.presets) {
      const existingCatId = catIdByName[cat.categoryName]
      const key = `${existingCatId ?? '__new__'}|${p.item_name}`
      const isDupName = existingCatNames.has(cat.categoryName) && existingPresetKeys.has(key)
      preview.push({
        category:     cat.categoryName,
        item_name:    p.item_name,
        repair_type:  p.repair_type,
        price:        p.default_price,
        notes:        p.notes,
        status:       isDupName ? 'skip' : 'new',
      })
    }
  }

  const newCount  = preview.filter(p => p.status === 'new').length
  const skipCount = preview.filter(p => p.status === 'skip').length

  return NextResponse.json({
    ok: true,
    summary: { total: preview.length, new: newCount, skip: skipCount },
    preview,
  })
}

// ─────────────────────────────────────────────
// POST: 実行（dryRun=true なら登録せず結果だけ返す）
// ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { storeId, dryRun = false } = await req.json() as { storeId: string; dryRun?: boolean }
  if (!storeId) {
    return NextResponse.json({ ok: false, error: 'storeId が必要です' }, { status: 400 })
  }

  const categoriesCreated: string[] = []
  const categoriesSkipped: string[] = []
  const presetsCreated:    string[] = []
  const presetsSkipped:    string[] = []
  const errors:            string[] = []

  // 既存カテゴリを取得
  const { data: existingCats, error: catFetchErr } = await (supabase as any)
    .from('repair_item_categories')
    .select('id, name')
    .eq('store_id', storeId)

  if (catFetchErr) {
    return NextResponse.json({ ok: false, error: `カテゴリ取得失敗: ${catFetchErr.message}` }, { status: 500 })
  }

  const catIdByName: Record<string, string> = Object.fromEntries(
    (existingCats ?? []).map((c: any) => [c.name, c.id])
  )

  // カテゴリを登録
  for (const cat of SEED_DATA) {
    if (catIdByName[cat.categoryName]) {
      categoriesSkipped.push(cat.categoryName)
      continue
    }
    if (dryRun) {
      categoriesCreated.push(`[DRY] ${cat.categoryName}`)
      continue
    }
    const { data: newCat, error: catInsertErr } = await (supabase as any)
      .from('repair_item_categories')
      .insert({ store_id: storeId, name: cat.categoryName, sort_order: cat.sortOrder, is_active: true })
      .select('id, name')
      .single()

    if (catInsertErr) {
      errors.push(`カテゴリ「${cat.categoryName}」: ${catInsertErr.message}`)
    } else {
      catIdByName[newCat.name] = newCat.id
      categoriesCreated.push(cat.categoryName)
    }
  }

  // 既存プリセットを取得
  const { data: existingPresets, error: presetFetchErr } = await (supabase as any)
    .from('repair_price_presets')
    .select('item_name, category_id')
    .eq('store_id', storeId)

  if (presetFetchErr) {
    return NextResponse.json({ ok: false, error: `プリセット取得失敗: ${presetFetchErr.message}` }, { status: 500 })
  }

  const existingPresetKeys = new Set<string>(
    (existingPresets ?? []).map((p: any) => `${p.category_id}|${p.item_name}`)
  )

  // プリセットを登録
  let sortCounter = 1
  for (const cat of SEED_DATA) {
    const catId = catIdByName[cat.categoryName]
    if (!catId && !dryRun) {
      errors.push(`カテゴリID不明のためスキップ: ${cat.categoryName}`)
      continue
    }

    for (const p of cat.presets) {
      const key = `${catId ?? '__new__'}|${p.item_name}`
      if (existingPresetKeys.has(key)) {
        presetsSkipped.push(`${cat.categoryName} / ${p.item_name}`)
        continue
      }

      if (dryRun) {
        presetsCreated.push(`[DRY] ${cat.categoryName} / ${p.item_name} ¥${p.default_price ?? 'お見積り'}`)
        continue
      }

      const { error: presetInsertErr } = await (supabase as any)
        .from('repair_price_presets')
        .insert({
          store_id:      storeId,
          category_id:   catId,
          item_name:     p.item_name,
          repair_type:   p.repair_type,
          default_price: p.default_price,
          notes:         p.notes,
          sort_order:    sortCounter++,
          is_active:     true,
        })

      if (presetInsertErr) {
        errors.push(`プリセット「${cat.categoryName} / ${p.item_name}」: ${presetInsertErr.message}`)
      } else {
        presetsCreated.push(`${cat.categoryName} / ${p.item_name}`)
      }
    }
  }

  return NextResponse.json({
    ok: errors.length === 0,
    dryRun,
    summary: {
      categories: { created: categoriesCreated.length, skipped: categoriesSkipped.length },
      presets:    { created: presetsCreated.length,    skipped: presetsSkipped.length    },
      errors:     errors.length,
    },
    categoriesCreated,
    categoriesSkipped,
    presetsCreated,
    presetsSkipped,
    errors,
  })
}
