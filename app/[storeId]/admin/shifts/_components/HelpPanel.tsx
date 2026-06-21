'use client'

import { useEffect, useState } from 'react'
import { Loader2, Plus, X, Check, HandHelping } from 'lucide-react'
import type { Staff } from '@/types/master'
import type { ShiftHelpRequest } from '@/types/shifts'
import { HELP_REQUEST_STATUS_LABELS, HELP_OFFER_STATUS_LABELS } from '@/types/shifts'
import { fmtDateJp, fmtHM } from '../_lib/time'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

async function api(body: Record<string, unknown>) {
  const res = await fetch('/api/shift-help', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error || '通信に失敗しました')
  return json
}

export function HelpPanel({ storeId, staff, onToast, onShiftsChanged }: {
  storeId: string
  staff: Staff[]
  onToast: (msg: string, type?: 'ok' | 'err') => void
  onShiftsChanged: () => void
}) {
  const [tab, setTab] = useState<'outgoing' | 'incoming'>('outgoing')
  const [requests, setRequests] = useState<ShiftHelpRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const fetch = async () => {
    setLoading(true)
    try {
      const { requests } = await api({ action: 'list_group_requests', storeId })
      setRequests(requests as ShiftHelpRequest[])
    } catch (e) { onToast(e instanceof Error ? e.message : 'エラー', 'err') }
    setLoading(false)
  }
  useEffect(() => { fetch() }, [storeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const outgoing = requests.filter(r => r.requesting_store_id === storeId)
  const incoming = requests.filter(r => r.requesting_store_id !== storeId && r.status === 'open')

  const assign = async (offerId: string) => {
    setBusy(offerId)
    try { await api({ action: 'assign', storeId, offer_id: offerId }); onToast('応募を確定しました（下書きシフト作成）'); onShiftsChanged(); fetch() }
    catch (e) { onToast(e instanceof Error ? e.message : 'エラー', 'err') }
    setBusy(null)
  }
  const cancel = async (reqId: string) => {
    setBusy(reqId)
    try { await api({ action: 'cancel', storeId, help_request_id: reqId }); onToast('募集を取消しました'); fetch() }
    catch (e) { onToast(e instanceof Error ? e.message : 'エラー', 'err') }
    setBusy(null)
  }
  const offer = async (reqId: string, staffId: string) => {
    setBusy(reqId)
    try { await api({ action: 'offer', storeId, help_request_id: reqId, staff_id: staffId }); onToast('応募しました'); fetch() }
    catch (e) { onToast(e instanceof Error ? e.message : 'エラー', 'err') }
    setBusy(null)
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex bg-gray-100 rounded-xl p-1 flex-1">
          <button onClick={() => setTab('outgoing')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${tab === 'outgoing' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'}`}>募集中（自店）</button>
          <button onClick={() => setTab('incoming')} className={`flex-1 py-1.5 rounded-lg text-xs font-bold ${tab === 'incoming' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-500'}`}>他店からの要請</button>
        </div>
        {tab === 'outgoing' && (
          <button onClick={() => setShowNew(true)} className="p-2 rounded-xl bg-indigo-600 text-white active:scale-95"><Plus size={18} /></button>
        )}
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="animate-spin text-indigo-300" /></div>
      ) : tab === 'outgoing' ? (
        <div className="space-y-3">
          {outgoing.length === 0 && <Empty text="募集はありません。＋から応援を募集できます。" />}
          {outgoing.map(r => (
            <div key={r.id} className="rounded-2xl border border-gray-200 bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-gray-900">{fmtDateJp(r.work_date)} {fmtHM(r.start_time)}-{fmtHM(r.end_time)}</p>
                  <p className="text-xs text-gray-500">{r.headcount}名募集{r.position ? `・${r.position}` : ''}{r.note ? `・${r.note}` : ''}</p>
                </div>
                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{HELP_REQUEST_STATUS_LABELS[r.status]}</span>
              </div>
              <div className="mt-2 space-y-1.5">
                {(r.offers ?? []).length === 0 && <p className="text-xs text-gray-400">応募はまだありません</p>}
                {(r.offers ?? []).map(o => (
                  <div key={o.id} className="flex items-center gap-2 p-2 rounded-lg bg-gray-50">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: o.staff?.color || '#94a3b8' }} />
                    <span className="text-xs font-bold text-gray-800 flex-1 truncate">{o.staff?.name ?? 'スタッフ'}<span className="text-gray-400 font-normal">（{o.offering_store_name ?? '他店'}）</span></span>
                    {o.status === 'assigned' ? (
                      <span className="text-[10px] font-black text-emerald-600">{HELP_OFFER_STATUS_LABELS.assigned}</span>
                    ) : (
                      <button onClick={() => assign(o.id)} disabled={busy === o.id}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-black active:scale-95 disabled:opacity-50 flex items-center gap-1">
                        {busy === o.id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}確定
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {r.status !== 'cancelled' && (
                <button onClick={() => cancel(r.id)} disabled={busy === r.id}
                  className="mt-2 text-[11px] text-gray-400 hover:text-red-500">募集を取消</button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {incoming.length === 0 && <Empty text="他店からの応援要請はありません" />}
          {incoming.map(r => (
            <IncomingCard key={r.id} req={r} staff={staff} busy={busy === r.id} onOffer={(sid) => offer(r.id, sid)} />
          ))}
        </div>
      )}

      {showNew && <NewRequestSheet storeId={storeId} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); fetch() }} onToast={onToast} />}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return (
    <div className="py-14 text-center text-gray-400">
      <HandHelping size={30} className="mx-auto mb-2 opacity-40" />
      <p className="text-sm">{text}</p>
    </div>
  )
}

function IncomingCard({ req, staff, busy, onOffer }: {
  req: ShiftHelpRequest; staff: Staff[]; busy: boolean; onOffer: (staffId: string) => void
}) {
  const [staffId, setStaffId] = useState(staff[0]?.id ?? '')
  return (
    <div className="rounded-2xl border border-teal-200 bg-teal-50/50 p-3">
      <p className="text-sm font-black text-gray-900">{fmtDateJp(req.work_date)} {fmtHM(req.start_time)}-{fmtHM(req.end_time)}</p>
      <p className="text-xs text-gray-500 mb-2">{req.requesting_store_name ?? '他店'} が {req.headcount}名募集{req.position ? `・${req.position}` : ''}</p>
      <div className="flex items-center gap-2">
        <select className={INPUT + ' flex-1'} value={staffId} onChange={e => setStaffId(e.target.value)}>
          {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          {staff.length === 0 && <option value="">スタッフ未登録</option>}
        </select>
        <button onClick={() => onOffer(staffId)} disabled={busy || !staffId}
          className="px-3 py-2.5 rounded-xl bg-teal-600 text-white text-xs font-black active:scale-95 disabled:opacity-50 whitespace-nowrap">
          {busy ? <Loader2 size={14} className="animate-spin" /> : '応募する'}
        </button>
      </div>
    </div>
  )
}

function NewRequestSheet({ storeId, onClose, onCreated, onToast }: {
  storeId: string; onClose: () => void; onCreated: () => void; onToast: (m: string, t?: 'ok' | 'err') => void
}) {
  const [date, setDate] = useState(new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10))
  const [start, setStart] = useState('10:00')
  const [end, setEnd] = useState('18:00')
  const [headcount, setHeadcount] = useState(1)
  const [position, setPosition] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      await api({ action: 'create_request', storeId, work_date: date, start_time: start, end_time: end, headcount, position: position.trim() || null, note: note.trim() || null })
      onToast('応援を募集しました'); onCreated()
    } catch (e) { onToast(e instanceof Error ? e.message : 'エラー', 'err'); setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center sm:justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl max-h-[90dvh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between">
          <h2 className="font-black text-gray-900">応援を募集</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={20} /></button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">日付</label>
            <input type="date" className={INPUT} value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold text-gray-500 mb-1">開始</label><input type="time" className={INPUT} value={start} onChange={e => setStart(e.target.value)} /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">終了</label><input type="time" className={INPUT} value={end} onChange={e => setEnd(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-bold text-gray-500 mb-1">必要人数</label><input type="number" min={1} className={INPUT} value={headcount} onChange={e => setHeadcount(Number(e.target.value) || 1)} /></div>
            <div><label className="block text-xs font-bold text-gray-500 mb-1">ポジション</label><input className={INPUT} value={position} onChange={e => setPosition(e.target.value)} placeholder="任意" /></div>
          </div>
          <div><label className="block text-xs font-bold text-gray-500 mb-1">メモ</label><input className={INPUT} value={note} onChange={e => setNote(e.target.value)} placeholder="任意" /></div>
        </div>
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-4">
          <button onClick={submit} disabled={saving}
            className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 size={18} className="animate-spin" /> : '同じグループの店舗に募集する'}
          </button>
        </div>
      </div>
    </div>
  )
}
