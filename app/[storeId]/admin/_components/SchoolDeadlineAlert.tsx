'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Clock, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface DeadlineSchool {
  id: string
  name: string
  order_deadline: string | null
  pickup_deadline: string | null
  daysUntilOrder: number | null
  daysUntilPickup: number | null
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(dateStr)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function DeadlineBadge({ days, label }: { days: number; label: string }) {
  const isOverdue = days < 0
  const isCritical = days >= 0 && days <= 3
  const isWarning = days >= 4 && days <= 7

  const cls = isOverdue  ? 'bg-red-100 text-red-700 border-red-300' :
              isCritical ? 'bg-red-50 text-red-600 border-red-200' :
              isWarning  ? 'bg-yellow-50 text-yellow-600 border-yellow-200' :
                           'bg-gray-50 text-gray-500 border-gray-200'

  const icon = isOverdue ? '❗' : isCritical ? '🔴' : isWarning ? '🟡' : '🟢'

  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-lg border ${cls}`}>
      {icon} {label}
      {isOverdue ? '期限切れ' : `あと${days}日`}
    </span>
  )
}

export function SchoolDeadlineAlert({ storeId }: { storeId: string }) {
  const [schools, setSchools] = useState<DeadlineSchool[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      try {
        const sevenDaysLater = new Date()
        sevenDaysLater.setDate(sevenDaysLater.getDate() + 7)

        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)

        const { data, error } = await (supabase as any)
          .from('schools')
          .select('id, name, order_deadline, pickup_deadline')
          .eq('store_id', storeId)
          .eq('active', true)
          .or([
            `order_deadline.gte.${yesterday.toISOString().split('T')[0]},order_deadline.lte.${sevenDaysLater.toISOString().split('T')[0]}`,
            `pickup_deadline.gte.${yesterday.toISOString().split('T')[0]},pickup_deadline.lte.${sevenDaysLater.toISOString().split('T')[0]}`,
          ].join(','))
          .order('order_deadline', { ascending: true })

        if (error || !data) {
          setLoading(false)
          return
        }

        const enriched: DeadlineSchool[] = data
          .map((s: { id: string; name: string; order_deadline: string | null; pickup_deadline: string | null }) => ({
            ...s,
            daysUntilOrder: daysUntil(s.order_deadline),
            daysUntilPickup: daysUntil(s.pickup_deadline),
          }))
          .filter((s: DeadlineSchool) =>
            (s.daysUntilOrder !== null && s.daysUntilOrder <= 7) ||
            (s.daysUntilPickup !== null && s.daysUntilPickup <= 7)
          )
          .sort((a: DeadlineSchool, b: DeadlineSchool) => {
            const aMin = Math.min(
              a.daysUntilOrder ?? 999,
              a.daysUntilPickup ?? 999,
            )
            const bMin = Math.min(
              b.daysUntilOrder ?? 999,
              b.daysUntilPickup ?? 999,
            )
            return aMin - bMin
          })

        setSchools(enriched)
      } catch {
        // order_deadline カラムが未作成でも静かに処理
      }
      setLoading(false)
    })()
  }, [storeId])

  if (loading || schools.length === 0) return null

  const criticalCount = schools.filter(s =>
    (s.daysUntilOrder !== null && s.daysUntilOrder <= 3) ||
    (s.daysUntilPickup !== null && s.daysUntilPickup <= 3)
  ).length

  return (
    <div className={`rounded-2xl border ${criticalCount > 0 ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <AlertTriangle size={14} className={criticalCount > 0 ? 'text-red-500' : 'text-yellow-500'} />
        <span className={`text-xs font-black ${criticalCount > 0 ? 'text-red-700' : 'text-yellow-700'}`}>
          締切アラート — {schools.length}校
        </span>
        {criticalCount > 0 && (
          <span className="ml-auto bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">
            {criticalCount}校が3日以内
          </span>
        )}
      </div>

      <div className="px-3 pb-3 space-y-1.5">
        {schools.slice(0, 5).map(school => (
          <a key={school.id}
            href={`/${storeId}/admin/schools/${school.id}`}
            className="flex items-center gap-2 bg-white/80 rounded-xl px-3 py-2 active:opacity-70 border border-white/60">
            <Clock size={12} className="text-gray-400 shrink-0" />
            <span className="text-xs font-bold text-gray-800 flex-1 truncate">{school.name}</span>
            <div className="flex items-center gap-1 shrink-0">
              {school.daysUntilOrder !== null && school.daysUntilOrder <= 7 && (
                <DeadlineBadge days={school.daysUntilOrder} label="発注" />
              )}
              {school.daysUntilPickup !== null && school.daysUntilPickup <= 7 && (
                <DeadlineBadge days={school.daysUntilPickup} label="引渡" />
              )}
            </div>
            <ChevronRight size={12} className="text-gray-400 shrink-0" />
          </a>
        ))}

        {schools.length > 5 && (
          <p className="text-[10px] text-center text-gray-400 pt-1">
            他{schools.length - 5}校の締切もあります
          </p>
        )}
      </div>
    </div>
  )
}
