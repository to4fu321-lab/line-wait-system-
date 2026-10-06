// ============================================================================
//  お直しマスタのコピー（#35）
//  - copyGarment(): 大分類を、配下の作業（基本料金）・オプションごと複製する
//  - copyItem():    作業を、オプションごと複製する（コピー先の大分類は選べる）
//  「学生部門 → 一般部門」のように価格だけ違うセットを作る用途があるので、
//  コピー時に価格の一括調整（+円 / ×%）をかけられるようにしている。
//
//  ブラウザから3テーブルに順に insert するため、途中で失敗すると中途半端な
//  コピーが残りうる。失敗時は今回作った親行を消して巻き戻す（子は ON DELETE
//  CASCADE で一緒に消える）。マニュアルの参考画像は Storage のパスを共有する
//  だけで、作業の削除時に画像は消さない作りなので共有しても壊れない。
// ============================================================================

import { supabase } from './supabase'
import type { Database } from '@/types/supabase'

type ItemRow = Database['public']['Tables']['repair_items']['Row']
type OptionRow = Database['public']['Tables']['repair_options']['Row']

export type PriceAdjust =
  | { mode: 'none' }
  | { mode: 'add'; yen: number }            // 基本料金に +○円（マイナス可）
  | { mode: 'pct'; pct: number; options: boolean } // ×○%（オプションの加算額にも掛けるか）

export type CopyResult =
  | { ok: true; items: number; options: number }
  | { ok: false; error: string }

/** 基本料金の調整。0円未満にはしない */
export function adjustBase(price: number, adj: PriceAdjust): number {
  if (adj.mode === 'add') return Math.max(0, Math.round(price + adj.yen))
  if (adj.mode === 'pct') return Math.max(0, Math.round(price * adj.pct / 100))
  return price
}

/**
 * オプション加算額の調整。
 * 「+○円」は基本料金にだけ掛ける（加算0円や値引き(-)のオプションに足すと意味が変わるため）。
 * 「×%」は指定があれば加算額にも掛ける（符号はそのまま、0円は0円のまま）。
 */
export function adjustDelta(delta: number, adj: PriceAdjust): number {
  if (adj.mode === 'pct' && adj.options) return Math.round(delta * adj.pct / 100)
  return delta
}

// UNIQUE(store_id, code) の衝突を避けるため、時刻＋乱数＋連番で作る
const newCode = (prefix: string, i = 0) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}_${i}`

const errMsg = (e: unknown) => (e as { message?: string })?.message ?? String(e)

/**
 * 作業（とそのオプション）を targetGarmentId 配下に複製する。
 * 作った作業の id を返す（巻き戻しに使う）。失敗したら throw。
 */
async function cloneItems(
  storeId: string,
  sources: ItemRow[],
  targetGarmentId: string,
  adj: PriceAdjust,
  opts: { startSort?: number; rename?: (src: ItemRow) => string },
  created: string[],
): Promise<{ items: number; options: number }> {
  if (sources.length === 0) return { items: 0, options: 0 }

  // 返却行の並び順に頼らず、code で元の作業と対応づける
  const codeBySource = new Map(sources.map((s, i) => [s.id, newCode('i', i)]))
  const { data: newItems, error: iErr } = await supabase.from('repair_items').insert(
    sources.map((s, i) => ({
      store_id: storeId,
      garment_type_id: targetGarmentId,
      code: codeBySource.get(s.id)!,
      name: opts.rename ? opts.rename(s) : s.name,
      icon: s.icon,
      base_price: adjustBase(s.base_price, adj),
      price_unit: s.price_unit,
      measurements: s.measurements,
      fields: s.fields,
      manual: s.manual,
      lead_time_days: s.lead_time_days,
      requires_quote: s.requires_quote,
      active: s.active,
      sort_order: opts.startSort != null ? opts.startSort + i * 10 : s.sort_order,
    })),
  ).select('id, code')
  if (iErr) throw iErr
  created.push(...(newItems ?? []).map(r => r.id))

  const newIdByCode = new Map((newItems ?? []).map(r => [r.code, r.id]))
  const newIdBySource = new Map<string, string>()
  for (const s of sources) {
    const id = newIdByCode.get(codeBySource.get(s.id)!)
    if (!id) throw new Error('作業のコピー結果を確認できませんでした')
    newIdBySource.set(s.id, id)
  }

  const { data: srcOptions, error: oFetchErr } = await supabase.from('repair_options')
    .select('*').in('item_id', sources.map(s => s.id)).order('sort_order')
  if (oFetchErr) throw oFetchErr
  const options = (srcOptions ?? []) as OptionRow[]
  if (options.length > 0) {
    const { error: oErr } = await supabase.from('repair_options').insert(
      options.map((o, i) => ({
        store_id: storeId,
        item_id: newIdBySource.get(o.item_id)!,
        code: newCode('o', i),
        name: o.name,
        group_label: o.group_label,
        group_select: o.group_select,
        price_delta: adjustDelta(o.price_delta, adj),
        price_unit: o.price_unit,
        default_selected: o.default_selected,
        requires_quote: o.requires_quote,
        fields: o.fields,
        manual: o.manual,
        active: o.active,
        sort_order: o.sort_order,
      })),
    )
    if (oErr) throw oErr
  }
  return { items: sources.length, options: options.length }
}

/** 大分類を配下の作業・オプションごと複製する */
export async function copyGarment(
  storeId: string,
  sourceGarmentId: string,
  input: { name: string; icon: string | null; sortOrder: number; adjust: PriceAdjust },
): Promise<CopyResult> {
  let newGarmentId: string | null = null
  try {
    const { data: srcItems, error: fErr } = await supabase.from('repair_items')
      .select('*').eq('store_id', storeId).eq('garment_type_id', sourceGarmentId).order('sort_order')
    if (fErr) throw fErr

    const { data: g, error: gErr } = await supabase.from('repair_garment_types').insert({
      store_id: storeId, code: newCode('g'), name: input.name, icon: input.icon, sort_order: input.sortOrder,
    }).select('id').single()
    if (gErr) throw gErr
    newGarmentId = g.id

    const r = await cloneItems(storeId, (srcItems ?? []) as ItemRow[], g.id, input.adjust, {}, [])
    return { ok: true, ...r }
  } catch (e) {
    // 大分類を消せば配下の作業・オプションも CASCADE で消える
    if (newGarmentId) await supabase.from('repair_garment_types').delete().eq('id', newGarmentId)
    return { ok: false, error: errMsg(e) }
  }
}

/** 作業をオプションごと複製する。コピー先の大分類の末尾に追加 */
export async function copyItem(
  storeId: string,
  sourceItemId: string,
  input: { targetGarmentId: string; name: string; adjust: PriceAdjust },
): Promise<CopyResult> {
  const created: string[] = []
  try {
    // 画面の state は古い可能性があるので、元の作業は DB から読み直す
    const { data: sourceItem, error: sErr } = await supabase.from('repair_items')
      .select('*').eq('id', sourceItemId).single()
    if (sErr) throw sErr

    const { data: last, error: lErr } = await supabase.from('repair_items')
      .select('sort_order').eq('garment_type_id', input.targetGarmentId)
      .order('sort_order', { ascending: false }).limit(1)
    if (lErr) throw lErr
    const startSort = (last?.[0]?.sort_order ?? 0) + 10

    const r = await cloneItems(storeId, [sourceItem], input.targetGarmentId, input.adjust,
      { startSort, rename: () => input.name }, created)
    return { ok: true, ...r }
  } catch (e) {
    // 作業を消せばオプションも CASCADE で消える
    if (created.length > 0) await supabase.from('repair_items').delete().in('id', created)
    return { ok: false, error: errMsg(e) }
  }
}
