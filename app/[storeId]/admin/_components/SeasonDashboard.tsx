'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Package, ClipboardList, CheckCircle2, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type SeasonType = 'peak' | 'handover' | 'summer' | 'normal' | 'prep'

interface DashboardStats {
  todayReservations: number
  pendingOrders: number
  readyForPickup: number
  uncalledOrders: number
}

function getSeason(month: number): SeasonType {
  if (month >= 11 || month <= 1) return 'prep'    // 11〜1月: 採寸受付・繁忙準備
  if (month >= 2 && month <= 3)  return 'peak'    // 2〜3月: 最繁忙期（採寸・発注）
  if (month === 4)               return 'handover' // 4月: 引渡し期
  if (month >= 5 && month <= 6)  return 'summer'  // 5〜6月: 夏服・在校生
  return 'normal'                                   // 7〜10月: 通常期・準備
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
    pendingOrders: 0,
    readyForPickup: 0,
    uncalledOrders: 0,
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

        const [rsvRes, ordersRes, readyRes] = await Promise.all([
          (supabase as any)
            .from('reservations')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId)
            .gte('reserved_at', todayStart.toISOString())
            .lte('reserved_at', todayEnd.toISOString())
            .in('status', ['confirmed', 'arrived']),

          (supabase as any)
            .from('uniform_orders')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId)
            .in('status', ['confirmed', 'processing']),

          (supabase as any)
            .from('uniform_orders')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId)
            .eq('status', 'ready'),
        ])

        setStats({
          todayReservations: rsvRes.count ?? 0,
          pendingOrders: ordersRes.count ?? 0,
          readyForPickup: readyRes.count ?? 0,
          uncalledOrders: readyRes.count ?? 0,
        })
      } catch {
        // テーブルが未作成の場合も静かに0表示
      }
      setLoading(false)
    })()
  }, [storeId])

  if (season === 'normal' && !loading && stats.pendingOrders === 0 && stats.readyForPickup === 0) {
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

      <div className="grid grid-cols-3 gap-2">
        {/* 今日の予約 */}
        <a href={`/${storeId}/admin/reservations`}
          className="flex flex-col items-center gap-1 bg-white/70 rounded-xl px-2 py-2.5 active:opacity-70">
          <CalendarDays size={16} className="text-indigo-500" />
          <span className="text-xl font-black tabular-nums text-indigo-700 leading-none">
            {loading ? '—' : stats.todayReservations}
          </span>
          <span className="text-[10px] font-bold text-indigo-500">今日の予約</span>
        </a>

        {/* 手配中受注 */}
        <a href={`/${storeId}/admin/purchase`}
          className="flex flex-col items-center gap-1 bg-white/70 rounded-xl px-2 py-2.5 active:opacity-70">
          <ClipboardList size={16} className={stats.pendingOrders > 0 ? 'text-amber-500' : 'text-gray-400'} />
          <span className={`text-xl font-black tabular-nums leading-none ${stats.pendingOrders > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
            {loading ? '—' : stats.pendingOrders}
          </span>
          <span className={`text-[10px] font-bold ${stats.pendingOrders > 0 ? 'text-amber-500' : 'text-gray-400'}`}>
            手配中
          </span>
        </a>

        {/* 引渡し待ち */}
        <a href={`/${storeId}/admin/repair`}
          className="flex flex-col items-center gap-1 bg-white/70 rounded-xl px-2 py-2.5 active:opacity-70">
          <Package size={16} className={stats.readyForPickup > 0 ? 'text-emerald-500' : 'text-gray-400'} />
          <span className={`text-xl font-black tabular-nums leading-none ${stats.readyForPickup > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
            {loading ? '—' : stats.readyForPickup}
          </span>
          <span className={`text-[10px] font-bold ${stats.readyForPickup > 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
            お渡し待ち
          </span>
        </a>
      </div>

      {stats.readyForPickup > 0 && !loading && (
        <a href={`/${storeId}/admin/repair`}
          className="flex items-center gap-1.5 mt-2 px-2 py-1.5 bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 active:opacity-70">
          <CheckCircle2 size={12} />
          <span>{stats.readyForPickup}件のお渡し準備が完了しています</span>
          <ChevronRight size={12} className="ml-auto" />
        </a>
      )}
    </div>
  )
}
