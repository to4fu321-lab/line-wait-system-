'use client'

import { useState } from 'react'
import { Loader2, Check, X, Pencil } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { RepairRow, PurchaseRow } from './types'

export function EditModal({ kind, item, onClose, onSave, onToast }: {
  kind: 'repair' | 'purchase'
  item: RepairRow | PurchaseRow
  onClose: () => void
  onSave: () => void
  onToast: (t: 'ok' | 'err', m: string) => void
}) {
  const [saving,   setSaving]   = useState(false)
  const [itemName, setItemName] = useState(item.item_name)
  const [content,  setContent]  = useState(kind === 'repair' ? (item as RepairRow).content : '')
  const [maker,    setMaker]    = useState(kind === 'purchase' ? ((item as PurchaseRow).maker ?? '') : '')
  const [price,    setPrice]    = useState(String(item.price ?? ''))
  const [deadline, setDeadline] = useState(kind === 'repair' ? ((item as RepairRow).desired_completion_date ?? '') : '')
  const [notes,    setNotes]    = useState(item.notes ?? '')

  async function handleSave() {
    if (!itemName.trim()) return
    setSaving(true)
    const table = kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const patch: Record<string, unknown> = {
      item_name: itemName.trim(),
      notes:     notes.trim() || null,
      price:     price ? Number(price) : null,
      updated_at: new Date().toISOString(),
    }
    if (kind === 'repair') {
      patch.content = content.trim()
      patch.desired_completion_date = deadline || null
    } else {
      patch.maker = maker.trim() || null
    }
    const { error } = await (supabase as any).from(table).update(patch).eq('id', item.id)
    setSaving(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onToast('ok', '変更を保存しました')
    onSave()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Pencil size={15} className="text-indigo-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-black text-gray-900">注文内容を変更</h2>
            <p className="text-xs text-gray-400 font-medium">
              {kind === 'repair' ? '✂️ お直し依頼' : '📦 追加購入'} — {(kind === 'repair' ? (item as RepairRow).customer?.name : (item as PurchaseRow).customer?.name) ?? '顧客不明'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pt-4 pb-8 space-y-4">
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">品名・商品名 <span className="text-red-500">*</span></label>
          <input type="text" value={itemName} onChange={e => setItemName(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="例: ○○中学校 スラックス Mサイズ" />
        </div>
        {kind === 'repair' && (
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">お直し内容</label>
            <input type="text" value={content} onChange={e => setContent(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="例: 裾上げ 3cm、サイズ変更 M→L" />
          </div>
        )}
        {kind === 'purchase' && (
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">メーカー</label>
            <input type="text" value={maker} onChange={e => setMaker(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="例: カンコー" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">金額（税込）</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="1200" />
          </div>
          {kind === 'repair' && (
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">希望完了日</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">
            {kind === 'purchase' ? 'サイズ' : '備考メモ'}
          </label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none resize-none"
            placeholder={kind === 'purchase' ? '例: 165A / 73cm / LL' : '数量変更・サイズ変更などの追記事項'} />
        </div>
        <button onClick={handleSave} disabled={saving || !itemName.trim()}
          className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-md shadow-indigo-600/25 active:scale-[0.98] transition-all">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          変更を保存する
        </button>
        </div>
      </div>
    </div>
  )
}
