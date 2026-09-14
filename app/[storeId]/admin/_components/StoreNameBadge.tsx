'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Store } from 'lucide-react'
import { supabase } from '@/lib/supabase'

// どの画面を開いていても今どの店舗を操作しているか分かるように、
// 常に同じ位置（画面上部の専用バー）に店舗名を出す。位置決めは
// 呼び出し側（AdminTopBar）に任せ、ここでは中身だけを返す
// （position: fixed で自前配置すると、各ページ独自のヘッダーと
//   重なってしまっていたため、実スペースを取る帯の中身に変更した）。
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
    <div className="flex items-center gap-1 min-w-0">
      <Store size={13} className="shrink-0 text-white/70" />
      <span className="text-[11px] font-bold text-white truncate">{name}</span>
    </div>
  )
}
