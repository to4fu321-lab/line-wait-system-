'use client'

import { useEffect, useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type SeasonType = 'peak' | 'handover' | 'summer' | 'normal' | 'prep'

interface DashboardStats {
  todayReservations: number
}

function getSeason(month: number): SeasonType {
  if (month >= 11 || month <= 1) return 'prep'     // 11〜1月: 採寸受付・繁忙準備
  if (month >= 2 && month <= 3)  return 'peak'     // 2〜3月: 最繁忙期（採寸・発注）
  if (month === 4)               return 'handover'  // 4月: 引渡し期
  if (month >= 5 && month <= 6)  return 'summer'   // 5〜6月: 夏服・在校生
  return 'normal'                                    // 7〜10月: 通常期・準備
}

const SEASON_CONFIG: Record<SeasonType, {
  label: string
  emoji: string
  desc: string
  bg: string
  badge: string
  text: string
}> = {
  peak: {
    label: '最繁忙期',
    emoji: '🔥',
    desc: '採寸・発注・入荷の最繁忙期です',
    bg: 'bg-red-50 border-red-200',
    badge: 'bg-red-500 text-white',
    text: 'text-red-700',
  },
  handover: {
    label: '引渡し期',
    emoji: '📦',
    desc: '入学式前。お渡し対応・サイズ交換が集中します',
    bg: 'bg-orange-50 border-orange-200',
    badge: 'bg-orange-500 text-white',
    text: 'text-orange-700',
  },
  summer: {
    label: '夏服受付',
    emoji: '☀️',
    desc: '夏服・在校生追加購入の受付シーズンです',
    bg: 'bg-yellow-50 border-yellow-200',
    badge: 'bg-yellow-500 text-white',
    text: 'text-yellow-700',
  },
  prep: {
    label: '繁忙期準備',
    emoji: '📋',
    desc: '新入生採寸受付開始。学校マスターの確認を',
    bg: 'bg-indigo-50 border-indigo-200',
    badge: 'bg-indigo-500 text-white',
    text: 'text-indigo-700',
  },
  normal: {
    label: '通常期',
    emoji: '📅',
    desc: '学校マスター更新・シーズン準備を進めましょう',
    bg: 'bg-gray-50 border-gray-200',
    badge: 'bg-gray-400 text-white',
    text: 'text-gray-600',
  },
}

export function SeasonDashboard({ storeId }: { storeId: string }) {
  const [stats, setStats] = useState<DashboardStats>({
    todayReservations: 0,
  })
  const [loading, setLoading] = useState(true)

  const month = new Date().getMonth() + 1
  const season = getSeason(month)
  const config = SEASON_CONFIG[season]

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      try {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const todayEnd = new Date()
        todayEnd.setHours(23, 59, 59, 999)

        const { count } = await (supabase as any)
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('store_id', storeId)
          .gte('reserved_at', todayStart.toISOString())
          .lte('reserved_at', todayEnd.toISOString())
          .in('status', ['confirmed', 'arrived'])

        setStats({ todayReservations: count ?? 0 })
      } catch {
        // テーブルが未作成の場合も静かに0表示
      }
      setLoading(false)
    })()
  }, [storeId])

  const hasAnything = stats.todayReservations > 0

  if (season === 'normal' && !loading && !hasAnything) {
    return null
  }

  return (
    <div className={`rounded-2xl border px-4 py-3 ${config.bg}`}>
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-base">{config.emoji}</span>
        <span className={`text-xs font-black px-2 py-0.5 rounded-full ${config.badge}`}>
          {config.label}
        </span>
        <span className={`text-xs ${config.text} flex-1 hidden sm:block`}>{config.desc}</span>
      </div>

      <a href={`/${storeId}/admin/reservations`}
        className="flex items-center gap-3 bg-white/70 rounded-xl px-3 py-2.5 active:opacity-70">
        <CalendarDays size={16} className="text-indigo-500 shrink-0" />
        <span className="text-[11px] font-bold text-indigo-500">今日の予約</span>
        <span className="ml-auto text-2xl font-black tabular-nums text-indigo-700 leading-none">
          {loading ? '—' : stats.todayReservations}
        </span>
        <span className="text-xs text-indigo-400">件</span>
      </a>
    </div>
  )
}
