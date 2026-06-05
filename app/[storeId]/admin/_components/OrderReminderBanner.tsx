'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { PackageSearch, X, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export type ScheduleType = 'immediate' | 'daily' | 'interval' | 'weekly'

export interface OrderSchedule {
  type: ScheduleType
  time?: string         // "HH:MM" — daily / weekly で使用
  day_of_week?: number  // 0=日〜6=土 — weekly で使用
  interval_days?: number // N日ごと — interval で使用
}

function getMostRecentOccurrence(schedule: OrderSchedule): Date | null {
  const now = new Date()

  switch (schedule.type) {
    case 'immediate':
      return null // DB カウントで別途制御

    case 'daily': {
      const [h, m] = (schedule.time || '21:00').split(':').map(Number)
      const target = new Date(now)
      target.setHours(h, m, 0, 0)
      if (now < target) target.setDate(target.getDate() - 1)
      return target
    }

    case 'interval': {
      // 「N日前」をトリガー基点とする
      const days = schedule.interval_days ?? 7
      const target = new Date(now)
      target.setDate(target.getDate() - days)
      return target
    }

    case 'weekly': {
      const targetDay = schedule.day_of_week ?? 1
      const [h, m] = (schedule.time || '09:00').split(':').map(Number)
      const target = new Date(now)
      let daysBack = (now.getDay() - targetDay + 7) % 7
      if (daysBack === 0) {
        const todayTarget = new Date(now)
        todayTarget.setHours(h, m, 0, 0)
        if (now < todayTarget) daysBack = 7
      }
      target.setDate(target.getDate() - daysBack)
      target.setHours(h, m, 0, 0)
      return target
    }

    default:
      return null
  }
}

function shouldShow(schedule: OrderSchedule, lastDismissedAt: string | null): boolean {
  if (schedule.type === 'immediate') return true // count check は別途

  const occurrence = getMostRecentOccurrence(schedule)
  if (!occurrence || occurrence > new Date()) return false
  if (!lastDismissedAt) return true

  return new Date(lastDismissedAt) < occurrence
}

export function OrderReminderBanner() {
  const params  = useParams<{ storeId: string }>()
  const router  = useRouter()
  const storeId = params?.storeId ?? ''

  const [schedule,     setSchedule]     = useState<OrderSchedule | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [visible,      setVisible]      = useState(false)

  useEffect(() => {
    if (!storeId) return

    const load = async () => {
      const { data } = await (supabase as any)
        .from('stores')
        .select('order_schedule')
        .eq('id', storeId)
        .single()

      if (!data?.order_schedule) return
      const sch = data.order_schedule as OrderSchedule
      setSchedule(sch)

      if (sch.type === 'immediate') {
        const { count } = await (supabase as any)
          .from('purchase_orders')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', storeId)
          .eq('status', 'on_order')
        const c = count ?? 0
        setPendingCount(c)
        if (c > 0) setVisible(true)
        return
      }

      const lastDismissed = localStorage.getItem(`order_banner_dismissed_${storeId}`)
      if (shouldShow(sch, lastDismissed)) {
        const { count } = await (supabase as any)
          .from('purchase_orders')
          .select('*', { count: 'exact', head: true })
          .eq('store_id', storeId)
          .eq('status', 'on_order')
        setPendingCount(count ?? 0)
        setVisible(true)
      }
    }

    load()
  }, [storeId])

  const dismiss = () => {
    localStorage.setItem(`order_banner_dismissed_${storeId}`, new Date().toISOString())
    setVisible(false)
  }

  const goToOrders = () => {
    localStorage.setItem(`order_banner_dismissed_${storeId}`, new Date().toISOString())
    router.push(`/${storeId}/admin/repairs?tab=purchase&filter=on_order`)
  }

  if (!visible || !schedule) return null

  return (
    <div className="fixed top-0 inset-x-0 z-[200] flex items-center gap-3 bg-amber-500 text-white px-4 shadow-lg"
      style={{ paddingTop: 'env(safe-area-inset-top)', minHeight: 'calc(48px + env(safe-area-inset-top))' }}>
      <PackageSearch size={18} className="shrink-0" />
      <div className="flex-1 min-w-0 py-3">
        <span className="text-sm font-bold">発注タイミングです！</span>
        {pendingCount > 0 && (
          <span className="text-sm ml-2 opacity-90">未発注 {pendingCount}件</span>
        )}
      </div>
      <button
        onClick={goToOrders}
        className="flex items-center gap-1 px-3 py-1.5 bg-white/25 hover:bg-white/35 active:bg-white/20 rounded-lg text-xs font-bold whitespace-nowrap transition-colors"
      >
        発注画面へ <ChevronRight size={12} />
      </button>
      <button onClick={dismiss} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors shrink-0">
        <X size={16} />
      </button>
    </div>
  )
}
