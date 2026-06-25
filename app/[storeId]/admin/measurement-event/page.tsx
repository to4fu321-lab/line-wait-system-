'use client'

// ============================================================
// 採寸会準備チェックリストページ
// 採寸会の前日〜当日を通じて「やること」を可視化する
// ============================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckCircle2, Circle, Users, Package,
  ClipboardList, ChevronDown, ChevronUp, RefreshCw,
  Plus, Trash2, CalendarDays, Clock, AlertCircle
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '../_components/BottomNav'

interface CheckItem {
  id: string
  label: string
  checked: boolean
  category: 'prep' | 'event' | 'post'
}

const DEFAULT_CHECKLIST: CheckItem[] = [
  // 前日準備
  { id: 'p1', label: '学校別名簿を印刷・確認した', checked: false, category: 'prep' },
  { id: 'p2', label: '商品見本品（サイズ別）を準備した', checked: false, category: 'prep' },
  { id: 'p3', label: '受付票・番号札・筆記具を準備した', checked: false, category: 'prep' },
  { id: 'p4', label: '決済端末・レシートロールを確認した', checked: false, category: 'prep' },
  { id: 'p5', label: '会場レイアウトを設計・確認した', checked: false, category: 'prep' },
  { id: 'p6', label: '応援スタッフに学校ルールを共有した', checked: false, category: 'prep' },
  { id: 'p7', label: '採寸記録シート（タブレット/紙）を準備した', checked: false, category: 'prep' },
  { id: 'p8', label: '刺繍・加工指示書のフォーマットを確認した', checked: false, category: 'prep' },

  // 当日
  { id: 'e1', label: '開店前に受付順番・導線を全員で確認した', checked: false, category: 'event' },
  { id: 'e2', label: 'QRコード受付画面を表示した', checked: false, category: 'event' },
  { id: 'e3', label: 'サイズ見本品を試着可能な状態にした', checked: false, category: 'event' },
  { id: 'e4', label: '受付票に学校名・購入必要品を案内できる状態にした', checked: false, category: 'event' },
  { id: 'e5', label: '刺繍名の漢字確認を忘れないよう掲示した', checked: false, category: 'event' },

  // 終了後
  { id: 'a1', label: '受注データを全件入力・確認した', checked: false, category: 'post' },
  { id: 'a2', label: '刺繍指示の文字・位置を再確認した', checked: false, category: 'post' },
  { id: 'a3', label: '未到着の方のリストを作成した', checked: false, category: 'post' },
  { id: 'a4', label: '発注数量を集計し、発注書を準備した', checked: false, category: 'post' },
  { id: 'a5', label: 'サイズ見本品を元の棚に戻した', checked: false, category: 'post' },
]

const CATEGORY_CONFIG = {
  prep:  { label: '前日準備', emoji: '📋', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200' },
  event: { label: '当日対応', emoji: '🎯', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  post:  { label: '終了後',   emoji: '✅', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
}

interface SchoolStat {
  school_name: string
  todayCount: number
  orderDeadline?: string | null
  pickupDeadline?: string | null
}

interface UpcomingDeadline {
  school_name: string
  deadline_type: 'order' | 'pickup'
  deadline_date: string
  days_left: number
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.ceil((new Date(dateStr).getTime() - today.getTime()) / 86400000)
}

function DeadlineBadge({ label, days }: { label: string; days: number }) {
  const colorClass =
    days === 0 ? 'bg-red-100 text-red-700' :
    days <= 3  ? 'bg-red-50 text-red-600' :
    days <= 7  ? 'bg-amber-100 text-amber-600' :
    days <= 14 ? 'bg-yellow-50 text-yellow-600' :
                 'bg-gray-100 text-gray-500'
  return (
    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full ${colorClass}`}>
      {label} {days === 0 ? '今日！' : `あと${days}日`}
    </span>
  )
}

const STORAGE_KEY_PREFIX = 'measurement_checklist_'

export default function MeasurementEventPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()

  const [items, setItems]           = useState<CheckItem[]>(DEFAULT_CHECKLIST)
  const [eventDate, setEventDate]   = useState(() => new Date().toISOString().split('T')[0])
  const [schoolStats, setSchoolStats] = useState<SchoolStat[]>([])
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<UpcomingDeadline[]>([])
  const [loadingStats, setLoadingStats] = useState(false)
  const [openCats, setOpenCats]     = useState<Set<string>>(new Set(['prep', 'event', 'post']))
  const [newItemText, setNewItemText] = useState('')
  const [addingTo, setAddingTo]     = useState<'prep' | 'event' | 'post' | null>(null)

  const storageKey = `${STORAGE_KEY_PREFIX}${storeId}_${eventDate}`

  // localStorageから復元
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = JSON.parse(saved) as CheckItem[]
        setItems(DEFAULT_CHECKLIST.map(d => ({
          ...d,
          checked: parsed.find(p => p.id === d.id)?.checked ?? false,
        })))
      } else {
        setItems(DEFAULT_CHECKLIST.map(d => ({ ...d, checked: false })))
      }
    } catch { /* ignore */ }
  }, [storageKey])

  // localStorageに保存
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(storageKey, JSON.stringify(items)) } catch { /* ignore */ }
  }, [storageKey, items])

  // 当日の来店数を学校別に取得 + 学校別締切日を取得
  const fetchSchoolStats = useCallback(async () => {
    if (!storeId || !eventDate) return
    setLoadingStats(true)
    try {
      const dayStart = `${eventDate}T00:00:00`
      const dayEnd   = `${eventDate}T23:59:59`

      const { data: queueData } = await (supabase as any)
        .from('queues')
        .select('school_name')
        .eq('store_id', storeId)
        .gte('created_at', dayStart)
        .lte('created_at', dayEnd)

      const counts: Record<string, number> = {}
      ;(queueData ?? []).forEach((q: { school_name: string }) => {
        if (q.school_name) counts[q.school_name] = (counts[q.school_name] ?? 0) + 1
      })

      // 学校別締切日を取得（migration未適用でも graceful fallback）
      let deadlineMap: Record<string, { orderDeadline: string | null; pickupDeadline: string | null }> = {}
      const upcoming: UpcomingDeadline[] = []
      try {
        const { data: schoolsData } = await (supabase as any)
          .from('schools')
          .select('name, order_deadline, pickup_deadline')
          .eq('store_id', storeId)
        if (Array.isArray(schoolsData)) {
          const today = new Date(); today.setHours(0, 0, 0, 0)
          const in30  = new Date(today.getTime() + 30 * 86400000)
          for (const s of schoolsData) {
            deadlineMap[s.name] = { orderDeadline: s.order_deadline ?? null, pickupDeadline: s.pickup_deadline ?? null }
            if (s.order_deadline) {
              const d = new Date(s.order_deadline)
              if (d >= today && d <= in30)
                upcoming.push({ school_name: s.name, deadline_type: 'order', deadline_date: s.order_deadline,
                  days_left: Math.ceil((d.getTime() - today.getTime()) / 86400000) })
            }
            if (s.pickup_deadline) {
              const d = new Date(s.pickup_deadline)
              if (d >= today && d <= in30)
                upcoming.push({ school_name: s.name, deadline_type: 'pickup', deadline_date: s.pickup_deadline,
                  days_left: Math.ceil((d.getTime() - today.getTime()) / 86400000) })
            }
          }
        }
      } catch { /* migration not yet applied — show stats without deadlines */ }

      setUpcomingDeadlines(upcoming.sort((a, b) => a.days_left - b.days_left))
      setSchoolStats(
        Object.entries(counts)
          .map(([school_name, todayCount]) => ({
            school_name,
            todayCount,
            orderDeadline:  deadlineMap[school_name]?.orderDeadline,
            pickupDeadline: deadlineMap[school_name]?.pickupDeadline,
          }))
          .sort((a, b) => b.todayCount - a.todayCount)
      )
    } catch { /* ignore */ }
    setLoadingStats(false)
  }, [storeId, eventDate])

  useEffect(() => { fetchSchoolStats() }, [fetchSchoolStats])

  const toggle = (id: string) =>
    setItems(prev => prev.map(item => item.id === id ? { ...item, checked: !item.checked } : item))

  const addItem = (category: 'prep' | 'event' | 'post') => {
    if (!newItemText.trim()) return
    const newItem: CheckItem = {
      id: `custom_${Date.now()}`,
      label: newItemText.trim(),
      checked: false,
      category,
    }
    setItems(prev => [...prev, newItem])
    setNewItemText('')
    setAddingTo(null)
  }

  const removeItem = (id: string) => setItems(prev => prev.filter(item => item.id !== id))

  const resetAll = () => setItems(DEFAULT_CHECKLIST.map(d => ({ ...d, checked: false })))

  const totalCount = items.length
  const doneCount  = items.filter(i => i.checked).length
  const progress   = totalCount === 0 ? 0 : Math.round((doneCount / totalCount) * 100)

  const toggleCat = (cat: string) => {
    setOpenCats(prev => {
      const next = new Set(prev)
      next.has(cat) ? next.delete(cat) : next.add(cat)
      return next
    })
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-28">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-gray-900">採寸会チェックリスト</h1>
            <p className="text-[11px] text-gray-500">準備〜当日〜終了後まで</p>
          </div>
          <button onClick={resetAll} className="p-2 rounded-xl hover:bg-gray-100" title="リセット">
            <RefreshCw size={15} className="text-gray-400" />
          </button>
        </div>

        {/* 進捗バー */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span className="font-bold">{doneCount} / {totalCount} 完了</span>
            <span className="font-bold">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <div className="p-4 space-y-3 max-w-lg mx-auto">

        {/* 開催日付 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 flex items-center gap-3">
          <CalendarDays size={16} className="text-indigo-500 shrink-0" />
          <span className="text-sm font-bold text-gray-700">開催日</span>
          <input type="date" value={eventDate}
            onChange={e => setEventDate(e.target.value)}
            className="ml-auto text-sm border border-gray-200 rounded-xl px-3 py-1.5 bg-gray-50" />
        </div>

        {/* 学校別来店数 */}
        {schoolStats.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Users size={14} className="text-gray-400" />
              <span className="text-sm font-bold text-gray-700">当日の来店状況</span>
              <button onClick={fetchSchoolStats} className="ml-auto">
                <RefreshCw size={12} className={`text-gray-400 ${loadingStats ? 'animate-spin' : ''}`} />
              </button>
            </div>
            <div className="space-y-1.5">
              {schoolStats.map(s => {
                const orderDays   = daysUntil(s.orderDeadline)
                const pickupDays  = daysUntil(s.pickupDeadline)
                const hasDeadline = (orderDays !== null && orderDays >= 0) || (pickupDays !== null && pickupDays >= 0)
                return (
                  <div key={s.school_name} className="px-3 py-2 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-700 truncate flex-1">{s.school_name}</span>
                      <span className="text-xs font-black text-indigo-600 ml-2 shrink-0">{s.todayCount}名</span>
                    </div>
                    {hasDeadline && (
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {orderDays !== null && orderDays >= 0 && (
                          <DeadlineBadge label="発注締切" days={orderDays} />
                        )}
                        {pickupDays !== null && pickupDays >= 0 && (
                          <DeadlineBadge label="引渡目標" days={pickupDays} />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 今後30日の締切カレンダー */}
        {upcomingDeadlines.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Clock size={14} className="text-amber-500" />
              <span className="text-sm font-bold text-gray-700">今後30日の締切</span>
              {upcomingDeadlines.some(d => d.days_left <= 3) && (
                <AlertCircle size={13} className="text-red-500 ml-1" />
              )}
            </div>
            <div className="space-y-1.5">
              {upcomingDeadlines.map((d, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-2 rounded-xl ${
                  d.days_left <= 3 ? 'bg-red-50' : d.days_left <= 7 ? 'bg-amber-50' : 'bg-gray-50'
                }`}>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-bold text-gray-700 truncate">{d.school_name}</span>
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md shrink-0 ${
                      d.deadline_type === 'order'
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      {d.deadline_type === 'order' ? '発注' : '引渡'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="text-[10px] text-gray-400">{d.deadline_date}</span>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                      d.days_left === 0 ? 'bg-red-100 text-red-700' :
                      d.days_left <= 3 ? 'bg-red-50 text-red-600' :
                      d.days_left <= 7 ? 'bg-amber-100 text-amber-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {d.days_left === 0 ? '今日！' : `あと${d.days_left}日`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* カテゴリ別チェックリスト */}
        {(['prep', 'event', 'post'] as const).map(cat => {
          const catItems = items.filter(i => i.category === cat)
          const catDone  = catItems.filter(i => i.checked).length
          const cfg      = CATEGORY_CONFIG[cat]
          const isOpen   = openCats.has(cat)

          return (
            <div key={cat} className={`rounded-2xl border ${cfg.bg}`}>
              <button
                onClick={() => toggleCat(cat)}
                className="w-full flex items-center gap-2 px-4 py-3">
                <span className="text-base">{cfg.emoji}</span>
                <span className={`text-sm font-black flex-1 text-left ${cfg.color}`}>{cfg.label}</span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${catDone === catItems.length ? 'bg-emerald-100 text-emerald-600' : 'bg-white/60 text-gray-500'}`}>
                  {catDone}/{catItems.length}
                </span>
                {isOpen ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </button>

              {isOpen && (
                <div className="px-3 pb-3 space-y-1.5">
                  {catItems.map(item => (
                    <div key={item.id}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors group ${item.checked ? 'bg-white/60' : 'bg-white/80 hover:bg-white'}`}
                      onClick={() => toggle(item.id)}>
                      {item.checked
                        ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                        : <Circle size={18} className="text-gray-300 shrink-0" />
                      }
                      <span className={`text-sm flex-1 ${item.checked ? 'line-through text-gray-400' : 'text-gray-700 font-medium'}`}>
                        {item.label}
                      </span>
                      {item.id.startsWith('custom_') && (
                        <button
                          onClick={e => { e.stopPropagation(); removeItem(item.id) }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-100 text-red-400">
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}

                  {/* カスタム追加 */}
                  {addingTo === cat ? (
                    <div className="flex gap-2 mt-1">
                      <input
                        autoFocus
                        value={newItemText}
                        onChange={e => setNewItemText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') addItem(cat); if (e.key === 'Escape') setAddingTo(null) }}
                        placeholder="項目を入力..."
                        className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-indigo-400"
                      />
                      <button onClick={() => addItem(cat)}
                        className="px-3 py-2 bg-indigo-600 text-white text-xs font-bold rounded-xl">追加</button>
                      <button onClick={() => setAddingTo(null)}
                        className="px-3 py-2 bg-gray-100 text-gray-500 text-xs font-bold rounded-xl">取消</button>
                    </div>
                  ) : (
                    <button onClick={() => { setAddingTo(cat); setNewItemText('') }}
                      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 px-3 py-1.5">
                      <Plus size={12} />
                      <span>項目を追加</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* 完了メッセージ */}
        {progress === 100 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-center">
            <p className="text-2xl mb-1">🎉</p>
            <p className="text-sm font-black text-emerald-700">全項目完了！</p>
            <p className="text-xs text-emerald-600">お疲れさまでした。採寸会の準備は万全です。</p>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
