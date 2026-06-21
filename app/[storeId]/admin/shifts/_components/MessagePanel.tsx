'use client'

import { useEffect, useState } from 'react'
import { Megaphone, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Staff } from '@/types/master'
import { MessageThread } from './MessageThread'

const sb = supabase as any

export function MessagePanel({ storeId, staff }: { storeId: string; staff: Staff[] }) {
  // selected: null=一覧, 'all'=全体, それ以外=staffId
  const [selected, setSelected] = useState<string | null>(null)
  const [unread, setUnread] = useState<Record<string, number>>({})

  useEffect(() => {
    // スタッフ発の未読数（manager向け）
    sb.from('shift_messages').select('staff_id').eq('store_id', storeId).eq('sender', 'staff').is('read_at', null)
      .then(({ data }: any) => {
        const m: Record<string, number> = {}
        for (const r of (data ?? [])) { const k = r.staff_id ?? 'all'; m[k] = (m[k] ?? 0) + 1 }
        setUnread(m)
      })
  }, [storeId, selected])

  if (selected) {
    const isAll = selected === 'all'
    const name = isAll ? '全体お知らせ' : (staff.find(s => s.id === selected)?.name ?? 'スタッフ')
    return (
      <div>
        <button onClick={() => setSelected(null)} className="flex items-center gap-1 text-sm text-gray-500 mb-2 hover:text-gray-700">
          <ChevronLeft size={16} />一覧へ
        </button>
        <p className="font-black text-gray-900 mb-2">{isAll ? '📣 ' : ''}{name}</p>
        <MessageThread storeId={storeId} staffId={isAll ? null : selected} sender="manager" />
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button onClick={() => setSelected('all')}
        className="w-full flex items-center gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 active:scale-[0.99] transition-all">
        <Megaphone size={18} className="text-amber-600" />
        <span className="text-sm font-bold text-amber-800 flex-1 text-left">全体お知らせ</span>
        {unread['all'] > 0 && <Badge n={unread['all']} />}
      </button>
      {staff.map(s => (
        <button key={s.id} onClick={() => setSelected(s.id)}
          className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 active:scale-[0.99] transition-all">
          <span className="w-3 h-3 rounded-full shrink-0" style={{ background: s.color || '#94a3b8' }} />
          <span className="text-sm font-bold text-gray-900 flex-1 text-left truncate">{s.name}</span>
          {unread[s.id] > 0 && <Badge n={unread[s.id]} />}
        </button>
      ))}
      {staff.length === 0 && <p className="text-sm text-gray-400 text-center py-8">スタッフが登録されていません</p>}
    </div>
  )
}

function Badge({ n }: { n: number }) {
  return <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 bg-red-500 text-white text-[10px] font-black rounded-full">{n}</span>
}
