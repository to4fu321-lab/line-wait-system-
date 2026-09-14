'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Store } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// どの画面を開いていても今どの店舗を操作しているか分かるように、
// 常に同じ位置（左上）に店舗名を出す。複数店舗を運用しているとき、
// 画面によって店舗名の表示位置・有無がバラバラで分かりにくかったための対応。
export function StoreNameBadge() {
  const params  = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const [name, setName] = useState('')

  useEffect(() => {
    if (!storeId) return
    let cancelled = false
    supabase.from('stores').select('name').eq('id', storeId).single().then(({ data }) => {
      if (!cancelled && data?.name) setName(data.name)
    })
    return () => { cancelled = true }
  }, [storeId])

  if (!name) return null

  return (
    <div className="fixed top-3 left-3 z-[150] flex items-center gap-1 bg-gray-900/85 backdrop-blur text-white rounded-full pl-2 pr-3 py-1.5 shadow-lg pointer-events-none">
      <Store size={13} className="shrink-0" />
      <span className="text-[11px] font-bold truncate max-w-[40vw]">{name}</span>
    </div>
  )
}
