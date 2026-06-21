'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { CalendarDays, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import type { Shift, ShiftTemplate } from '@/types/shifts'
import type { Staff } from '@/types/master'
import { Toast } from '../repairs/_components/Toast'
import { loadShifts, loadStaff, staffMapOf } from './_lib/data'
import { weekDates, todayJst, addDays } from './_lib/time'
import { ShiftWeekGrid } from './_components/ShiftWeekGrid'
import { ShiftMonthCalendar } from './_components/ShiftMonthCalendar'
import { DayShiftSheet } from './_components/DayShiftSheet'
import { ShiftEditSheet } from './_components/ShiftEditSheet'
import { RequestReviewList } from './_components/RequestReviewList'
import { LaborReport } from './_components/LaborReport'
import { MessagePanel } from './_components/MessagePanel'
import { HelpPanel } from './_components/HelpPanel'

const sb = supabase as any
type Tab = 'week' | 'month' | 'requests' | 'report' | 'messages' | 'help'

function monthRangeStr(y: number, m: number) {
  const days = new Date(y, m, 0).getDate()
  const p = (n: number) => String(n).padStart(2, '0')
  return { start: `${y}-${p(m)}-01`, end: `${y}-${p(m)}-${p(days)}` }
}

export default function ShiftsPage() {
  const params = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const router = useRouter()
  const { hasFeature, loaded } = useStoreFeatures(storeId)
  const interStore = hasFeature('shift_inter_store')

  const [tab, setTab] = useState<Tab>('week')
  const [staff, setStaff] = useState<Staff[]>([])
  const [templates, setTemplates] = useState<ShiftTemplate[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loadingShifts, setLoadingShifts] = useState(true)
  const [publishing, setPublishing] = useState(false)

  const [weekAnchor, setWeekAnchor] = useState(todayJst())
  const [ym, setYm] = useState(() => { const t = todayJst(); return { y: Number(t.slice(0, 4)), m: Number(t.slice(5, 7)) } })

  const [editSheet, setEditSheet] = useState<{ date: string; editing: Shift | null; defaultStaffId?: string } | null>(null)
  const [daySheet, setDaySheet] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  const showToast = useCallback((msg: string, type: 'ok' | 'err' = 'ok') => setToast({ msg, type }), [])
  const staffMap = useMemo(() => staffMapOf(staff), [staff])

  // フラグガード
  useEffect(() => {
    if (loaded && !hasFeature('shift_management')) router.replace(`/${storeId}/admin`)
  }, [loaded, hasFeature, router, storeId])

  const weekDays = useMemo(() => weekDates(weekAnchor), [weekAnchor])

  // 表示中タブの範囲に合わせてシフトを取得
  const range = useMemo(() => {
    if (tab === 'week') return { start: weekDays[0], end: weekDays[6] }
    if (tab === 'month' || tab === 'report') return monthRangeStr(ym.y, ym.m)
    return null
  }, [tab, weekDays, ym])

  const fetchShifts = useCallback(async () => {
    if (!range) return
    setLoadingShifts(true)
    setShifts(await loadShifts(storeId, range.start, range.end))
    setLoadingShifts(false)
  }, [storeId, range])

  useEffect(() => {
    if (!storeId) return
    loadStaff(storeId).then(setStaff)
    sb.from('shift_templates').select('*').eq('store_id', storeId).eq('active', true).order('sort_order')
      .then(({ data }: any) => setTemplates((data ?? []) as ShiftTemplate[]))
  }, [storeId])

  useEffect(() => { if (range) fetchShifts() }, [fetchShifts]) // eslint-disable-line react-hooks/exhaustive-deps

  // リアルタイム: shifts / shift_requests
  useEffect(() => {
    if (!storeId) return
    const ch = sb.channel(`shifts-${storeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shifts', filter: `store_id=eq.${storeId}` }, () => fetchShifts())
      .subscribe()
    return () => { sb.removeChannel(ch) }
  }, [storeId, fetchShifts])

  const publishWeek = async () => {
    setPublishing(true)
    const { error } = await sb.from('shifts').update({ status: 'published' })
      .eq('store_id', storeId).gte('work_date', weekDays[0]).lte('work_date', weekDays[6]).eq('status', 'draft')
    setPublishing(false)
    if (error) { showToast('公開に失敗しました', 'err'); return }
    showToast('この週のシフトを公開しました'); fetchShifts()
  }

  if (!loaded) return <div className="min-h-[60vh] grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>

  const TABS: { id: Tab; label: string }[] = [
    { id: 'week', label: '週' },
    { id: 'month', label: '月' },
    { id: 'requests', label: '希望' },
    { id: 'report', label: '集計' },
    { id: 'messages', label: '連絡' },
    ...(interStore ? [{ id: 'help' as Tab, label: 'ヘルプ' }] : []),
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 pb-24">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 grid place-items-center"><CalendarDays size={20} className="text-indigo-600" /></div>
        <h1 className="text-lg font-black text-gray-900 flex-1">シフト管理</h1>
        <a href={`/${storeId}/staff`} target="_blank" rel="noopener noreferrer"
          className="text-xs font-bold text-indigo-600 border border-indigo-200 rounded-lg px-2.5 py-1.5 hover:bg-indigo-50">
          スタッフ用画面 ↗
        </a>
      </div>

      {/* タブ */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 min-w-[56px] py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
              tab === t.id ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500 hover:text-gray-700'
            }`}>{t.label}</button>
        ))}
      </div>

      {tab === 'week' && (
        <ShiftWeekGrid
          staff={staff} shifts={shifts} days={weekDays} loading={loadingShifts}
          onPrev={() => setWeekAnchor(d => addDays(d, -7))}
          onNext={() => setWeekAnchor(d => addDays(d, 7))}
          onToday={() => setWeekAnchor(todayJst())}
          onAdd={(staffId, date) => setEditSheet({ date, editing: null, defaultStaffId: staffId })}
          onEdit={(shift) => setEditSheet({ date: shift.work_date, editing: shift })}
          onPublish={publishWeek} publishing={publishing}
        />
      )}

      {tab === 'month' && (
        <ShiftMonthCalendar
          ym={ym} shifts={shifts} loading={loadingShifts}
          onPrev={() => setYm(({ y, m }) => m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 })}
          onNext={() => setYm(({ y, m }) => m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 })}
          onSelectDay={(d) => setDaySheet(d)}
        />
      )}

      {tab === 'requests' && <RequestReviewList storeId={storeId} onChanged={fetchShifts} onToast={showToast} />}

      {tab === 'report' && (
        <LaborReport
          ym={ym} shifts={shifts} staffMap={staffMap} loading={loadingShifts} storeId={storeId} onToast={showToast}
          onPrev={() => setYm(({ y, m }) => m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 })}
          onNext={() => setYm(({ y, m }) => m === 12 ? { y: y + 1, m: 1 } : { y, m: m + 1 })}
        />
      )}

      {tab === 'messages' && <MessagePanel storeId={storeId} staff={staff} />}

      {tab === 'help' && interStore && (
        <HelpPanel storeId={storeId} staff={staff} onToast={showToast} onShiftsChanged={fetchShifts} />
      )}

      {/* 日別シート（月ビュー） */}
      {daySheet && (
        <DayShiftSheet
          date={daySheet} shifts={shifts} staffMap={staffMap}
          onClose={() => setDaySheet(null)}
          onAdd={() => { const d = daySheet; setDaySheet(null); setEditSheet({ date: d, editing: null }) }}
          onEdit={(s) => { setDaySheet(null); setEditSheet({ date: s.work_date, editing: s }) }}
        />
      )}

      {/* 追加/編集シート */}
      {editSheet && (
        <ShiftEditSheet
          storeId={storeId} staff={staff} templates={templates}
          date={editSheet.date} editing={editSheet.editing} defaultStaffId={editSheet.defaultStaffId}
          onClose={() => setEditSheet(null)} onSaved={fetchShifts} onToast={showToast}
        />
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
