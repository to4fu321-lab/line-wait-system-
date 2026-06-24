'use client'

import { useEffect, useState } from 'react'
import { ChevronRight, Package, ClipboardList, CheckCircle2, CalendarDays, Scissors } from 'lucide-react'
import { supabase } from '@/lib/supabase'

type SeasonType = 'peak' | 'handover' | 'summer' | 'normal' | 'prep'

interface DashboardStats {
  todayReservations: number
  pendingPurchaseOrders: number  // purchase_orders: on_order/ordered/stocked
  readyForPickup: number         // repair_histories: completed + purchase_orders: arrived
  activeRepairs: number          // repair_histories: received (加工中)
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
    pendingPurchaseOrders: 0,
    readyForPickup: 0,
    activeRepairs: 0,
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

        const [rsvRes, pendingRes, readyRepairRes, arrivedPurchaseRes, activeRepairRes] = await Promise.all([
          // 今日の予約（reservations テーブル）
          (supabase as any)
            .from('reservations')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId)
            .gte('reserved_at', todayStart.toISOString())
            .lte('reserved_at', todayEnd.toISOString())
            .in('status', ['confirmed', 'arrived']),

          // 手配中の発注（purchase_orders: 未入荷）
          (supabase as any)
            .from('purchase_orders')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId)
            .not('status', 'in', '("arrived","delivered")'),

          // お直し完了・未渡し（repair_histories: completed）
          (supabase as any)
            .from('repair_histories')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId)
            .eq('status', 'completed'),

          // 入荷済み・未渡し（purchase_orders: arrived）
          (supabase as any)
            .from('purchase_orders')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId)
            .eq('status', 'arrived'),

          // お直し加工中（repair_histories: received）
          (supabase as any)
            .from('repair_histories')
            .select('id', { count: 'exact', head: true })
            .eq('store_id', storeId)
            .eq('status', 'received'),
        ])

        setStats({
          todayReservations:     rsvRes.count ?? 0,
          pendingPurchaseOrders: pendingRes.count ?? 0,
          readyForPickup:        (readyRepairRes.count ?? 0) + (arrivedPurchaseRes.count ?? 0),
          activeRepairs:         activeRepairRes.count ?? 0,
        })
      } catch {
        // テーブルが未作成の場合も静かに0表示
      }
      setLoading(false)
    })()
  }, [storeId])

  const hasAnything = stats.pendingPurchaseOrders > 0 || stats.readyForPickup > 0 || stats.activeRepairs > 0 || stats.todayReservations > 0

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

      <div className="grid grid-cols-4 gap-1.5">
        {/* 今日の予約 */}
        <a href={`/${storeId}/admin/reservations`}
          className="flex flex-col items-center gap-1 bg-white/70 rounded-xl px-1 py-2.5 active:opacity-70">
          <CalendarDays size={14} className="text-indigo-500" />
          <span className="text-lg font-black tabular-nums text-indigo-700 leading-none">
            {loading ? '—' : stats.todayReservations}
          </span>
          <span className="text-[9px] font-bold text-indigo-500 text-center leading-tight">今日の<br/>予約</span>
        </a>

        {/* お直し加工中 */}
        <a href={`/${storeId}/admin/repairs`}
          className="flex flex-col items-center gap-1 bg-white/70 rounded-xl px-1 py-2.5 active:opacity-70">
          <Scissors size={14} className={stats.activeRepairs > 0 ? 'text-violet-500' : 'text-gray-400'} />
          <span className={`text-lg font-black tabular-nums leading-none ${stats.activeRepairs > 0 ? 'text-violet-700' : 'text-gray-400'}`}>
            {loading ? '—' : stats.activeRepairs}
          </span>
          <span className={`text-[9px] font-bold text-center leading-tight ${stats.activeRepairs > 0 ? 'text-violet-500' : 'text-gray-400'}`}>
            お直し<br/>加工中
          </span>
        </a>

        {/* 手配中発注 */}
        <a href={`/${storeId}/admin/repairs`}
          className="flex flex-col items-center gap-1 bg-white/70 rounded-xl px-1 py-2.5 active:opacity-70">
          <ClipboardList size={14} className={stats.pendingPurchaseOrders > 0 ? 'text-amber-500' : 'text-gray-400'} />
          <span className={`text-lg font-black tabular-nums leading-none ${stats.pendingPurchaseOrders > 0 ? 'text-amber-700' : 'text-gray-400'}`}>
            {loading ? '—' : stats.pendingPurchaseOrders}
          </span>
          <span className={`text-[9px] font-bold text-center leading-tight ${stats.pendingPurchaseOrders > 0 ? 'text-amber-500' : 'text-gray-400'}`}>
            発注<br/>手配中
          </span>
        </a>

        {/* お渡し待ち */}
        <a href={`/${storeId}/admin/repairs`}
          className="flex flex-col items-center gap-1 bg-white/70 rounded-xl px-1 py-2.5 active:opacity-70">
          <Package size={14} className={stats.readyForPickup > 0 ? 'text-emerald-500' : 'text-gray-400'} />
          <span className={`text-lg font-black tabular-nums leading-none ${stats.readyForPickup > 0 ? 'text-emerald-700' : 'text-gray-400'}`}>
            {loading ? '—' : stats.readyForPickup}
          </span>
          <span className={`text-[9px] font-bold text-center leading-tight ${stats.readyForPickup > 0 ? 'text-emerald-500' : 'text-gray-400'}`}>
            お渡し<br/>待ち
          </span>
        </a>
      </div>

      {stats.readyForPickup > 0 && !loading && (
        <a href={`/${storeId}/admin/repairs`}
          className="flex items-center gap-1.5 mt-2 px-2 py-1.5 bg-emerald-100 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 active:opacity-70">
          <CheckCircle2 size={12} />
          <span>{stats.readyForPickup}件のお渡し準備が完了しています — 連絡を忘れずに</span>
          <ChevronRight size={12} className="ml-auto" />
        </a>
      )}
    </div>
  )
}
