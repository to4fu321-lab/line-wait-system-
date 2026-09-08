'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Megaphone, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface FixNotice {
  id: string
  message: string
  created_at: string
}

const DISMISS_KEY = (storeId: string) => `fix_notice_dismissed_${storeId}`

// フィードバックで報告した不具合の修正完了を、運用者から店舗へ知らせるバナー。
// feedback_notices（store_id = 自店舗 または null=全店舗）のうち、
// 最後に閉じた通知より新しいものがあれば表示する。
export function FixNoticeBanner() {
  const params  = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''

  const [notice, setNotice] = useState<FixNotice | null>(null)

  useEffect(() => {
    if (!storeId) return
    let cancelled = false

    const load = async () => {
      const { data } = await (supabase as any)
        .from('feedback_notices')
        .select('id, message, created_at, store_id')
        .or(`store_id.eq.${storeId},store_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(1)

      if (cancelled) return
      const latest = data?.[0] as (FixNotice & { store_id: string | null }) | undefined
      if (!latest) return

      const dismissedAt = localStorage.getItem(DISMISS_KEY(storeId))
      if (dismissedAt && new Date(dismissedAt) >= new Date(latest.created_at)) return

      setNotice(latest)
    }

    load()
    return () => { cancelled = true }
  }, [storeId])

  const dismiss = () => {
    if (!notice) return
    localStorage.setItem(DISMISS_KEY(storeId), notice.created_at)
    setNotice(null)
  }

  if (!notice) return null

  return (
    <div className="fixed top-0 inset-x-0 z-[200] flex items-center gap-3 bg-emerald-600 text-white px-4 shadow-lg"
      style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(48px + env(safe-area-inset-top))' }}>
      <Megaphone size={18} className="shrink-0" />
      <div className="flex-1 min-w-0 py-3">
        <span className="text-sm font-bold">{notice.message}</span>
      </div>
      <button onClick={dismiss} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors shrink-0">
        <X size={16} />
      </button>
    </div>
  )
}
