'use client'

import { useState } from 'react'
import { Loader2, Trash2, Plus, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { repairItemIcon } from '@/lib/repairIcons'

const sb = supabase as any
const INPUT = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-amber-500 bg-white'

export interface ImportItem { name: string; icon: string; price: number | null; selected: boolean }
export interface ImportGarment { name: string; icon: string; selected: boolean; items: ImportItem[] }

// preset/OCR の素朴な配列 → 選択フラグ付きの編集モデルへ変換
// 項目アイコンは内容（名前）から推測して自動付与（プレビューで編集可）
export function bulkFromParsed(
  garments: { name?: string; icon?: string; items?: { name?: string; icon?: string; price?: number | null }[] }[],
): ImportGarment[] {
  return (garments ?? []).map(g => ({
    name: g.name ?? '', icon: g.icon || '✂️', selected: true,
    items: (g.items ?? []).map(it => ({
      name: it.name ?? '', icon: it.icon || repairItemIcon(it.name ?? ''),
      price: (it.price ?? null) as number | null, selected: true,
    })),
  }))
}

// プリセット/OCR で取り込んだ内容を編集→一括登録するモーダル
export function BulkImportModal({ storeId, title, initial, onClose, onDone }: {
  storeId: string
  title: string
  initial: ImportGarment[]
  onClose: () => void
  onDone: (msg: string) => void
}) {
  const [garments, setGarments] = useState<ImportGarment[]>(initial)
  const [saving, setSaving] = useState(false)

  const patchG = (gi: number, patch: Partial<ImportGarment>) =>
    setGarments(prev => prev.map((g, i) => i === gi ? { ...g, ...patch } : g))
  const patchI = (gi: number, ii: number, patch: Partial<ImportItem>) =>
    setGarments(prev => prev.map((g, i) => i !== gi ? g : { ...g, items: g.items.map((it, j) => j === ii ? { ...it, ...patch } : it) }))
  const addItem = (gi: number) =>
    setGarments(prev => prev.map((g, i) => i !== gi ? g : { ...g, items: [...g.items, { name: '', icon: '✂️', price: 0, selected: true }] }))
  const removeItem = (gi: number, ii: number) =>
    setGarments(prev => prev.map((g, i) => i !== gi ? g : { ...g, items: g.items.filter((_, j) => j !== ii) }))

  const selectedCount = garments
    .filter(g => g.selected)
    .reduce((a, g) => a + g.items.filter(it => it.selected && it.name.trim()).length, 0)

  const runImport = async () => {
    setSaving(true)
    try {
      // 既存服種（名前で重複回避）
      const { data: exG } = await sb.from('repair_garment_types').select('id, name, sort_order').eq('store_id', storeId)
      const existing = ((exG ?? []) as { id: string; name: string; sort_order: number }[])
      let gSort = existing.reduce((m, g) => Math.max(m, g.sort_order), 0)
      let created = 0

      for (const g of garments) {
        if (!g.selected) continue
        const items = g.items.filter(it => it.selected && it.name.trim())
        if (items.length === 0) continue

        const gName = g.name.trim() || 'その他'
        // 服種を取得 or 新規作成
        let gid = existing.find(x => x.name === gName)?.id
        if (!gid) {
          gSort += 10
          const { data: ins } = await sb.from('repair_garment_types').insert({
            store_id: storeId, code: `g_${Date.now().toString(36)}_${gSort}`,
            name: gName, icon: g.icon || '✂️', sort_order: gSort,
          }).select('id').single()
          gid = ins?.id
          if (gid) existing.push({ id: gid, name: gName, sort_order: gSort })
        }
        if (!gid) continue

        // 既存項目（名前で重複回避）
        const { data: exI } = await sb.from('repair_items').select('name, sort_order').eq('garment_type_id', gid)
        const exItems = ((exI ?? []) as { name: string; sort_order: number }[])
        let iSort = exItems.reduce((m, it) => Math.max(m, it.sort_order), 0)

        for (const it of items) {
          if (exItems.some(x => x.name === it.name.trim())) continue
          iSort += 10
          await sb.from('repair_items').insert({
            store_id: storeId, garment_type_id: gid,
            code: `i_${Date.now().toString(36)}_${iSort}`, name: it.name.trim(),
            icon: it.icon || repairItemIcon(it.name),
            base_price: it.price ?? 0, price_unit: 'per_item',
            measurements: [], manual: null, requires_quote: it.price == null, lead_time_days: null,
            sort_order: iSort,
          })
          exItems.push({ name: it.name.trim(), sort_order: iSort })
          created++
        }
      }
      onDone(`${created}件の項目を追加しました`)
    } catch {
      onDone('追加に失敗しました')
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-2xl rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b px-5 py-3.5 z-10">
          <h2 className="font-black text-gray-900">{title}</h2>
          <p className="text-[11px] text-gray-400">チェックを外すと取り込みません。名前・価格はその場で編集できます（価格を空欄にすると要見積もり扱い）。</p>
        </div>

        <div className="p-4 space-y-3">
          {garments.length === 0 && <p className="text-center text-gray-400 text-sm py-8">取り込める内容がありませんでした</p>}
          {garments.map((g, gi) => (
            <div key={gi} className={`rounded-2xl border ${g.selected ? 'border-amber-200 bg-amber-50/40' : 'border-gray-200 opacity-60'}`}>
              <div className="flex items-center gap-2 p-3">
                <input type="checkbox" checked={g.selected} onChange={e => patchG(gi, { selected: e.target.checked })} />
                <input className={INPUT + ' w-12 text-center'} value={g.icon} onChange={e => patchG(gi, { icon: e.target.value })} />
                <input className={INPUT + ' flex-1 font-bold'} value={g.name} onChange={e => patchG(gi, { name: e.target.value })} placeholder="服種名" />
              </div>
              {g.selected && (
                <div className="px-3 pb-3 space-y-1.5">
                  {g.items.map((it, ii) => (
                    <div key={ii} className="flex items-center gap-2 bg-white rounded-xl px-2 py-1.5">
                      <input type="checkbox" checked={it.selected} onChange={e => patchI(gi, ii, { selected: e.target.checked })} />
                      <input className={INPUT + ' w-10 text-center px-1'} value={it.icon} onChange={e => patchI(gi, ii, { icon: e.target.value })} aria-label="アイコン" />
                      <input className={INPUT + ' flex-1'} value={it.name} onChange={e => patchI(gi, ii, { name: e.target.value })} placeholder="項目名" />
                      <div className="flex items-center gap-0.5">
                        <span className="text-gray-400 text-sm">¥</span>
                        <input type="number" className={INPUT + ' w-20 text-right'} value={it.price ?? ''} placeholder="未定"
                          onChange={e => patchI(gi, ii, { price: e.target.value === '' ? null : Number(e.target.value) })} />
                      </div>
                      <button onClick={() => removeItem(gi, ii)} className="text-gray-300 hover:text-red-500"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  <button onClick={() => addItem(gi)} className="w-full flex items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-200 py-1.5 text-xs font-bold text-gray-400 hover:border-amber-400 hover:text-amber-500">
                    <Plus size={13} />項目を追加
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="sticky bottom-0 bg-white border-t px-5 py-3 flex items-center gap-3">
          <span className="text-xs text-gray-500 font-bold flex-1">{selectedCount}項目を取り込みます</span>
          <button onClick={onClose} className="px-4 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm">やめる</button>
          <button onClick={runImport} disabled={saving || selectedCount === 0}
            className="px-5 py-2.5 rounded-xl bg-amber-500 text-white font-black text-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}取り込む
          </button>
        </div>
      </div>
    </div>
  )
}
