'use client'

// ============================================================
// 全予約ビュー（日付横断）：今後/過去の分離・統計・検索
// ============================================================
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Loader2, Search, CalendarDays } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { RESERVATION_STATUS_LABELS, type ReservationStatus } from '@/types/reservations'
import { ReservationCard, type ReservationFull } from './ReservationCard'

function todayStartTs(): string {
  const d = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
  return `${d}T00:00:00+09:00`
}
function telDigits(s: string | null | undefined): string { return (s ?? '').replace(/[^0-9]/g, '') }

// 今後＝今日以降かつ未完了（confirmed/arrived/called）。それ以外は過去・完了。
function isUpcoming(r: ReservationFull, nowTs: string): boolean {
  return r.reserved_at >= nowTs && (r.status === 'confirmed' || r.status === 'arrived' || r.status === 'called')
}

export function AllReservationsView({ storeId, showToast }: {
  storeId: string
  showToast: (t: 'ok' | 'err', m: string, onUndo?: () => Promise<void>) => void
}) {
  const [all, setAll] = useState<ReservationFull[]>([])
  const [loading, setLoading] = useState(true)
  const [sub, setSub] = useState<'upcoming' | 'past'>('upcoming')
  const [q, setQ] = useState('')

  const fetchAll = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const { data } = await (supabase.from('reservations') as any)
      .select('*, customer:customers(name, kana, tel), child:children(name, school_name, grade)')
      .eq('store_id', storeId)
      .order('reserved_at', { ascending: false })
      .limit(800)
    setAll((data ?? []) as ReservationFull[])
    setLoading(false)
  }, [storeId])
  useEffect(() => { fetchAll() }, [fetchAll])

  const handleUpdate = useCallback(async (id: string, status: ReservationStatus, prev: ReservationStatus) => {
    const { error } = await (supabase.from('reservations') as any)
      .update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) { showToast('err', `更新失敗: ${error.message}`); return }
    fetchAll()
    showToast('ok', `${RESERVATION_STATUS_LABELS[status]}にしました`, async () => {
      await (supabase.from('reservations') as any)
        .update({ status: prev, updated_at: new Date().toISOString() }).eq('id', id)
      fetchAll()
    })
  }, [fetchAll, showToast])

  const handleDelete = useCallback(async (id: string) => {
    const { error } = await (supabase.from('reservations') as any).delete().eq('id', id)
    if (error) { showToast('err', `削除失敗: ${error.message}`); return }
    showToast('ok', '予約を削除しました')
    fetchAll()
  }, [fetchAll, showToast])

  const nowTs = todayStartTs()
  const upcoming = useMemo(() => all.filter(r => isUpcoming(r, nowTs)), [all, nowTs])
  const past = useMemo(() => all.filter(r => !isUpcoming(r, nowTs)), [all, nowTs])

  // 検索（氏名／学校名／電話番号）
  const qq = q.trim().toLowerCase()
  const qDigits = telDigits(q)
  const filter = useCallback((rows: ReservationFull[]) => {
    if (!qq && !qDigits) return rows
    return rows.filter(r => {
      const names = [r.child?.name, r.customer?.name, r.customer_name].filter(Boolean).join(' ').toLowerCase()
      const school = (r.child?.school_name ?? '').toLowerCase()
      const tel = telDigits(r.customer?.tel)
      return (qq && (names.includes(qq) || school.includes(qq))) || (qDigits.length >= 2 && tel.includes(qDigits))
    })
  }, [qq, qDigits])

  const base = sub === 'upcoming' ? upcoming : past
  const list = useMemo(() => filter(base), [filter, base])

  // 統計（フィルタ結果に追従）
  const byPurpose = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of list) { const k = r.purpose ?? '（未設定）'; m[k] = (m[k] ?? 0) + 1 }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [list])
  const bySchool = useMemo(() => {
    const m: Record<string, number> = {}
    for (const r of list) { const k = r.child?.school_name ?? '（未設定）'; m[k] = (m[k] ?? 0) + 1 }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [list])

  return (
    <div className="space-y-3">
      {/* 検索 */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)}
          placeholder="氏名・学校名・電話番号で検索"
          className="w-full bg-white border border-gray-300 rounded-2xl pl-9 pr-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none" />
      </div>

      {/* 今後/過去 切替＋合計 */}
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setSub('upcoming')}
          className={`py-2.5 rounded-xl font-black text-sm border ${sub === 'upcoming' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200'}`}>
          今後 <span className="tabular-nums">{upcoming.length}</span>
        </button>
        <button onClick={() => setSub('past')}
          className={`py-2.5 rounded-xl font-black text-sm border ${sub === 'past' ? 'bg-gray-700 text-white border-gray-700' : 'bg-white text-gray-600 border-gray-200'}`}>
          過去・完了 <span className="tabular-nums">{past.length}</span>
        </button>
      </div>
      <p className="text-[11px] text-gray-400 text-center -mt-1">合計 {all.length} 件{all.length >= 800 && '（最新800件）'}</p>

      {/* 統計：来店内容(要件)別 */}
      {byPurpose.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-3 space-y-2">
          <p className="text-[11px] font-bold text-gray-500">来店内容（要件）別</p>
          <div className="flex flex-wrap gap-1.5">
            {byPurpose.map(([k, v]) => (
              <span key={k} className="text-xs font-bold px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-100">
                {k} <span className="tabular-nums">{v}</span>
              </span>
            ))}
          </div>
          <p className="text-[11px] font-bold text-gray-500 pt-1">学校名別</p>
          <div className="flex flex-wrap gap-1.5">
            {bySchool.map(([k, v]) => (
              <span key={k} className="text-xs font-bold px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-100">
                {k} <span className="tabular-nums">{v}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 一覧 */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 size={28} className="animate-spin text-indigo-400" /></div>
      ) : list.length === 0 ? (
        <div className="text-center py-14 text-gray-500">
          <CalendarDays size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm">{q ? '該当する予約はありません' : sub === 'upcoming' ? '今後の予約はありません' : '過去の予約はありません'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(r => (
            <ReservationCard key={r.id} res={r} storeId={storeId}
              onUpdate={handleUpdate} onDelete={handleDelete} showDate />
          ))}
        </div>
      )}
    </div>
  )
}
