'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { MessageSquare, ChevronDown } from 'lucide-react'

// ============================================================
// 定型文ピッカー
// 入力欄の近くに置くボタン。タップで定型文マスタ(message_templates)を
// 一覧表示し、選んだ本文を onInsert(text) で親へ渡す。
//   category を指定すると、その用途 + 'general'(汎用) のみ表示。
// ============================================================
export default function TemplatePicker({
  category, onInsert, label = '定型文',
}: {
  category?: string
  onInsert: (text: string) => void
  label?: string
}) {
  const { storeId } = useParams<{ storeId: string }>()
  const [open, setOpen]   = useState(false)
  const [items, setItems] = useState<{ id: string; title: string; body: string }[]>([])
  const [loaded, setLoaded] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const fetchItems = useCallback(async () => {
    if (!storeId) return
    const { data } = await (supabase as any)
      .from('message_templates').select('id, title, body, category, is_active')
      .eq('store_id', storeId).order('sort_order').order('created_at')
    const rows = (data ?? []).filter((r: any) =>
      r.is_active !== false && (!category || r.category === category || r.category === 'general'))
    setItems(rows); setLoaded(true)
  }, [storeId, category])

  useEffect(() => { if (open && !loaded) fetchItems() }, [open, loaded, fetchItems])

  // 外側クリックで閉じる
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-700 active:opacity-70">
        <MessageSquare size={12} />{label}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-1 w-64 max-h-72 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-xl">
          {!loaded ? (
            <p className="px-3 py-3 text-xs text-gray-400">読み込み中...</p>
          ) : items.length === 0 ? (
            <p className="px-3 py-3 text-xs text-gray-400">定型文がありません。<br />マスタ管理 → 定型文テンプレートで登録できます。</p>
          ) : (
            items.map(t => (
              <button key={t.id} type="button"
                onClick={() => { onInsert(t.body); setOpen(false) }}
                className="w-full text-left px-3 py-2.5 border-b border-gray-50 last:border-0 hover:bg-indigo-50 active:bg-indigo-100 transition-colors">
                <p className="text-xs font-bold text-gray-800 truncate">{t.title}</p>
                <p className="text-[10px] text-gray-400 line-clamp-2 mt-0.5 whitespace-pre-wrap">{t.body}</p>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
