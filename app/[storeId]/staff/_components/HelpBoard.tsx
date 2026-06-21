'use client'

import { useEffect, useState } from 'react'
import { Loader2, HandHelping, Check } from 'lucide-react'
import type { ShiftHelpRequest } from '@/types/shifts'
import { fmtDateJp, fmtHM } from '../../admin/shifts/_lib/time'

async function api(body: Record<string, unknown>) {
  const res = await fetch('/api/shift-help', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '通信に失敗しました')
  return json
}

// スタッフが自店グループの他店募集に自分で応募する掲示板
export function HelpBoard({ storeId, staffId, onToast }: {
  storeId: string; staffId: string; onToast: (m: string, t?: 'ok' | 'err') => void
}) {
  const [reqs, setReqs] = useState<ShiftHelpRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const fetch = async () => {
    setLoading(true)
    try {
      const { requests } = await api({ action: 'list_group_requests', storeId })
      // 他店の open 募集のみ
      setReqs((requests as ShiftHelpRequest[]).filter(r => r.requesting_store_id !== storeId && r.status === 'open'))
    } catch (e) { onToast(e instanceof Error ? e.message : 'エラー', 'err') }
    setLoading(false)
  }
  useEffect(() => { fetch() }, [storeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const hasOffered = (r: ShiftHelpRequest) => (r.offers ?? []).some(o => o.staff_id === staffId && o.status !== 'declined')

  const offer = async (reqId: string) => {
    setBusy(reqId)
    try { await api({ action: 'offer', storeId, help_request_id: reqId, staff_id: staffId }); onToast('応募しました！店長の確定をお待ちください'); fetch() }
    catch (e) { onToast(e instanceof Error ? e.message : 'エラー', 'err') }
    setBusy(null)
  }

  if (loading) return <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
  if (reqs.length === 0) return (
    <div className="py-16 text-center text-gray-400">
      <HandHelping size={30} className="mx-auto mb-2 opacity-40" />
      <p className="text-sm">いまヘルプ募集はありません</p>
    </div>
  )

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">同じグループの他店からの応援募集です。入れる日があれば応募できます。</p>
      {reqs.map(r => {
        const offered = hasOffered(r)
        return (
          <div key={r.id} className="rounded-2xl border border-teal-200 bg-teal-50/50 p-3">
            <p className="text-sm font-black text-gray-900">{fmtDateJp(r.work_date)} {fmtHM(r.start_time)}-{fmtHM(r.end_time)}</p>
            <p className="text-xs text-gray-500 mb-2">{r.requesting_store_name ?? '他店'}{r.position ? `・${r.position}` : ''}{r.note ? `・${r.note}` : ''}</p>
            {offered ? (
              <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-600"><Check size={14} />応募済み</span>
            ) : (
              <button onClick={() => offer(r.id)} disabled={busy === r.id}
                className="px-4 py-2 rounded-xl bg-teal-600 text-white text-sm font-black active:scale-95 disabled:opacity-50">
                {busy === r.id ? <Loader2 size={14} className="animate-spin" /> : '応募する'}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
