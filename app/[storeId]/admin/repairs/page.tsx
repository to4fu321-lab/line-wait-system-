'use client'

/**
 * himonoya ブランチ — お直し管理（シンプル版）
 * 3タブ: 作業中 | 受け取り待ち | 渡し済み
 * 完了ボタンを押すだけでLINE通知が自動送信される
 */

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  Plus, Loader2, Phone, ChevronDown, ChevronUp,
  X, Search, Scissors, RotateCcw, Trash2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'

// ── 型定義 ──────────────────────────────────────────────────────
interface Customer {
  id: string
  name: string
  tel: string | null
  line_user_id: string | null
}

interface Repair {
  id: string
  store_id: string
  customer_id: string
  item_name: string
  content: string
  status: 'received' | 'completed' | 'delivered'
  received_date: string
  completed_date: string | null
  delivered_date: string | null
  price: number | null
  desired_completion_date: string | null
  notified: boolean
  request_no: number | null
  customer: Customer | null
}

type Tab = 'working' | 'ready' | 'done'

const TAB_LABELS: Record<Tab, string> = {
  working: '作業中',
  ready: '受け取り待ち',
  done: '渡し済み',
}

const STATUS_MAP: Record<Tab, string[]> = {
  working: ['received'],
  ready:   ['completed'],
  done:    ['delivered'],
}

function today() { return new Date().toISOString().slice(0, 10) }
function fmtDate(d: string | null) {
  if (!d) return ''
  return d.slice(5).replace('-', '/')
}

// ── Toast ──────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: 'ok' | 'err'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3.5 rounded-2xl text-white font-bold shadow-2xl text-sm max-w-xs text-center ${
      type === 'err' ? 'bg-red-600' : 'bg-gray-900'
    }`}>{msg}</div>
  )
}

// ── 受付モーダル（2ステップ）──────────────────────────────────
function IntakeModal({ storeId, onSaved, onClose }: {
  storeId: string
  onSaved: () => void
  onClose: () => void
}) {
  const [step,        setStep]        = useState<'item' | 'customer'>('item')
  const [itemName,    setItemName]    = useState('')
  const [content,     setContent]     = useState('')
  const [price,       setPrice]       = useState('')
  const [dueDate,     setDueDate]     = useState('')
  const [custSearch,  setCustSearch]  = useState('')
  const [results,     setResults]     = useState<Customer[]>([])
  const [selected,    setSelected]    = useState<Customer | null>(null)
  const [newName,     setNewName]     = useState('')
  const [newTel,      setNewTel]      = useState('')
  const [saving,      setSaving]      = useState(false)
  const [searching,   setSearching]   = useState(false)

  // 顧客検索（デバウンス）
  useEffect(() => {
    if (!custSearch.trim()) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const { data } = await (supabase as any).from('customers')
        .select('id,name,tel,line_user_id')
        .eq('store_id', storeId)
        .or(`name.ilike.%${custSearch.trim()}%,tel.ilike.%${custSearch.trim()}%`)
        .limit(8)
      setResults(data ?? [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [custSearch, storeId])

  async function save() {
    setSaving(true)
    let customerId = selected?.id ?? null

    if (!customerId && newName.trim()) {
      const { data: nc } = await (supabase as any).from('customers').insert({
        store_id: storeId,
        name: newName.trim(),
        tel: newTel.trim() || null,
      }).select('id').single()
      customerId = nc?.id ?? null
    }

    if (!customerId) { setSaving(false); return }

    const { error } = await (supabase as any).from('repair_histories').insert({
      store_id:                storeId,
      customer_id:             customerId,
      item_name:               itemName.trim(),
      content:                 content.trim(),
      price:                   price ? Number(price) : null,
      desired_completion_date: dueDate || null,
      status:                  'received',
      received_date:           today(),
      request_type:            'repair',
      notified:                false,
    })
    setSaving(false)
    if (error) return
    onSaved()
  }

  const INPUT = 'w-full border-2 border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:border-indigo-500 focus:outline-none bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '90dvh' }}>

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Scissors size={18} className="text-indigo-600" />
            <h2 className="text-base font-black text-gray-900">
              {step === 'item' ? 'お直しの内容' : 'お客様情報'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        {/* ステップインジケーター */}
        <div className="flex px-5 pt-3 gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-indigo-600" />
          <div className={`flex-1 h-1.5 rounded-full transition-colors ${step === 'customer' ? 'bg-indigo-600' : 'bg-gray-200'}`} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {step === 'item' ? (
            <>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">品物名 <span className="text-red-500">*</span></label>
                <input type="text" value={itemName} onChange={e => setItemName(e.target.value)}
                  placeholder="例：学生ズボン、スカートなど" className={INPUT} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">お直し内容 <span className="text-red-500">*</span></label>
                <textarea value={content} onChange={e => setContent(e.target.value)}
                  placeholder="例：裾上げ 3cm、ウエスト詰め など" rows={3}
                  className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:border-indigo-500 focus:outline-none resize-none bg-white" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">金額</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold pointer-events-none">¥</span>
                    <input type="number" inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)}
                      placeholder="1000" className="w-full border-2 border-gray-200 rounded-2xl pl-9 pr-3 py-3.5 text-base focus:border-indigo-500 focus:outline-none bg-white" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">希望日</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={INPUT} />
                </div>
              </div>
            </>
          ) : (
            <>
              {selected ? (
                /* 選択済みお客様 */
                <div className="bg-indigo-50 border-2 border-indigo-400 rounded-2xl px-4 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="font-black text-gray-900 text-xl">{selected.name}</p>
                    {selected.tel && <p className="text-sm text-gray-500 mt-0.5">{selected.tel}</p>}
                    {selected.line_user_id
                      ? <p className="text-xs text-green-600 font-bold mt-1">✓ LINE連携済み — 自動通知されます</p>
                      : <p className="text-xs text-gray-400 mt-1">LINE未連携 — 電話でご連絡ください</p>}
                  </div>
                  <button onClick={() => setSelected(null)} className="p-2 text-gray-400 hover:text-red-500 ml-2">
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <>
                  {/* 顧客検索 */}
                  <div className="relative">
                    <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={custSearch} onChange={e => setCustSearch(e.target.value)}
                      placeholder="名前・電話番号で検索" autoFocus
                      className="w-full border-2 border-gray-200 rounded-2xl pl-11 pr-4 py-3.5 text-base focus:border-indigo-500 focus:outline-none bg-white" />
                  </div>

                  {searching && <div className="flex justify-center py-3"><Loader2 size={20} className="animate-spin text-indigo-400" /></div>}

                  {results.length > 0 && (
                    <div className="space-y-2">
                      {results.map(c => (
                        <button key={c.id} onClick={() => { setSelected(c); setCustSearch(''); setResults([]) }}
                          className="w-full flex items-center justify-between bg-white border-2 border-gray-200 rounded-2xl px-4 py-3 hover:border-indigo-400 active:scale-[0.98] transition-all text-left">
                          <div>
                            <p className="font-black text-gray-900 text-base">{c.name}</p>
                            {c.tel && <p className="text-sm text-gray-500">{c.tel}</p>}
                          </div>
                          {c.line_user_id && (
                            <span className="text-xs text-green-600 font-bold bg-green-50 px-2 py-1 rounded-full border border-green-200 shrink-0">LINE</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 新規お客様入力 */}
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-sm font-bold text-gray-500 mb-3">見つからない場合 — 新規のお客様</p>
                    <div className="space-y-3">
                      <input type="text" value={newName} onChange={e => setNewName(e.target.value)}
                        placeholder="お名前 *" className={INPUT} />
                      <input type="tel" value={newTel} onChange={e => setNewTel(e.target.value)}
                        placeholder="電話番号（任意）" className={INPUT} />
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* フッターボタン */}
        <div className="px-5 pb-6 pt-3 border-t border-gray-100 space-y-2.5">
          {step === 'item' ? (
            <button onClick={() => setStep('customer')}
              disabled={!itemName.trim() || !content.trim()}
              className="w-full py-4 rounded-2xl font-black text-base bg-indigo-600 text-white disabled:opacity-40 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200">
              次へ — お客様情報
            </button>
          ) : (
            <>
              <button onClick={save}
                disabled={saving || (!selected && !newName.trim())}
                className="w-full py-4 rounded-2xl font-black text-base bg-indigo-600 text-white disabled:opacity-40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200">
                {saving ? <><Loader2 size={18} className="animate-spin" />登録中...</> : '✂️ 受付する'}
              </button>
              <button onClick={() => setStep('item')}
                className="w-full py-3 rounded-2xl font-bold text-sm border-2 border-gray-200 text-gray-600 active:scale-[0.98] transition-all">
                ← 内容を修正する
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── お直しカード ───────────────────────────────────────────────
function RepairCard({ repair, tab, onRefresh, showToast }: {
  repair: Repair
  tab: Tab
  onRefresh: () => void
  showToast: (t: 'ok' | 'err', m: string) => void
}) {
  const [open,          setOpen]          = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const hasLine  = !!repair.customer?.line_user_id
  const custName = repair.customer?.name ?? '（顧客不明）'
  const reqNo    = repair.request_no != null
    ? `R-${String(repair.request_no).padStart(4, '0')}`
    : null

  // 完了 + LINE通知
  async function handleComplete() {
    setLoading(true)
    const { error } = await (supabase as any).from('repair_histories').update({
      status:         'completed',
      completed_date: today(),
      notified:       true,
      updated_at:     new Date().toISOString(),
    }).eq('id', repair.id)

    if (error) { showToast('err', '更新に失敗しました'); setLoading(false); return }

    if (hasLine) {
      await fetch('/api/notify-repair', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ repairId: repair.id }),
      })
      showToast('ok', '✅ 完了・LINE通知を送りました')
    } else {
      showToast('ok', '✅ 完了にしました（LINE未連携）')
    }
    setLoading(false)
    onRefresh()
  }

  // お渡し完了
  async function handleDeliver() {
    setLoading(true)
    const { error } = await (supabase as any).from('repair_histories').update({
      status:         'delivered',
      delivered_date: today(),
      updated_at:     new Date().toISOString(),
    }).eq('id', repair.id)
    setLoading(false)
    if (error) { showToast('err', '更新に失敗しました'); return }
    showToast('ok', '📦 お渡し完了しました')
    onRefresh()
  }

  // 作業中に戻す
  async function handleRevert() {
    setLoading(true)
    const { error } = await (supabase as any).from('repair_histories').update({
      status:         'received',
      completed_date: null,
      notified:       false,
      updated_at:     new Date().toISOString(),
    }).eq('id', repair.id)
    setLoading(false)
    if (error) { showToast('err', '更新に失敗しました'); return }
    showToast('ok', '作業中に戻しました')
    onRefresh()
  }

  // 削除
  async function handleDelete() {
    setLoading(true)
    const { error } = await (supabase as any).from('repair_histories').delete().eq('id', repair.id)
    setLoading(false)
    if (error) { showToast('err', '削除に失敗しました'); return }
    showToast('ok', '削除しました')
    onRefresh()
  }

  return (
    <div className="bg-white border-2 border-gray-100 rounded-3xl overflow-hidden shadow-sm">
      {/* カラーストリップ */}
      <div className={`h-1.5 ${
        tab === 'working' ? 'bg-indigo-500' :
        tab === 'ready'   ? 'bg-emerald-500' : 'bg-gray-300'
      }`} />

      {/* カードヘッダー（タップで展開） */}
      <button className="w-full text-left px-5 pt-4 pb-3" onClick={() => setOpen(v => !v)}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* バッジ行 */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
              {reqNo && (
                <span className="text-[11px] font-mono font-bold text-gray-400">{reqNo}</span>
              )}
              {hasLine && (
                <span className="text-[10px] font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded-full">
                  LINE通知可
                </span>
              )}
              {repair.desired_completion_date && (
                <span className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full">
                  希望 {fmtDate(repair.desired_completion_date)}
                </span>
              )}
            </div>

            {/* お客様名（大きく） */}
            <p className="text-2xl font-black text-gray-900 leading-tight tracking-tight">{custName}</p>

            {/* 品物・内容 */}
            <p className="text-sm font-bold text-indigo-700 mt-1">{repair.item_name}</p>
            <p className="text-sm text-gray-500 mt-0.5 leading-snug">{repair.content}</p>

            {/* 金額・受付日 */}
            <div className="flex items-center gap-3 mt-2">
              {repair.price != null && (
                <span className="text-base font-black text-gray-800">¥{repair.price.toLocaleString()}</span>
              )}
              <span className="text-xs text-gray-400 font-medium">受付 {fmtDate(repair.received_date)}</span>
              {repair.completed_date && (
                <span className="text-xs text-gray-400 font-medium">完了 {fmtDate(repair.completed_date)}</span>
              )}
            </div>
          </div>
          <div className="shrink-0 mt-2">
            {open
              ? <ChevronUp size={18} className="text-gray-300" />
              : <ChevronDown size={18} className="text-gray-300" />}
          </div>
        </div>
      </button>

      {/* メインアクションボタン */}
      <div className="px-5 pb-4">
        {tab === 'working' && (
          <button onClick={handleComplete} disabled={loading}
            className="w-full py-5 rounded-2xl font-black text-lg text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all shadow-xl shadow-emerald-200 flex items-center justify-center gap-2 disabled:opacity-50">
            {loading
              ? <><Loader2 size={20} className="animate-spin" />処理中...</>
              : hasLine
                ? '✅ 完了・LINE通知する'
                : '✅ 完了にする'}
          </button>
        )}
        {tab === 'ready' && (
          <button onClick={handleDeliver} disabled={loading}
            className="w-full py-5 rounded-2xl font-black text-lg text-white bg-gray-700 hover:bg-gray-600 active:scale-[0.98] transition-all shadow-xl shadow-gray-300 flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <><Loader2 size={20} className="animate-spin" />処理中...</> : '📦 お渡し完了'}
          </button>
        )}
      </div>

      {/* 展開エリア */}
      {open && (
        <div className="px-5 pb-4 border-t border-gray-100 pt-3 space-y-2.5">
          {repair.customer?.tel && (
            <a href={`tel:${repair.customer.tel}`}
              className="flex items-center gap-2 text-indigo-700 font-bold text-base py-3 px-4 bg-indigo-50 rounded-2xl active:bg-indigo-100 transition-colors">
              <Phone size={18} />電話する — {repair.customer.tel}
            </a>
          )}
          {!hasLine && tab === 'ready' && (
            <p className="text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 font-medium">
              ⚠️ LINE未連携のお客様です。電話でご連絡ください。
            </p>
          )}
          {tab === 'ready' && (
            <button onClick={handleRevert} disabled={loading}
              className="w-full py-3 rounded-2xl font-bold text-sm border-2 border-gray-200 text-gray-500 flex items-center justify-center gap-1.5 hover:border-gray-300 active:scale-[0.98] transition-all">
              <RotateCcw size={13} />作業中に戻す
            </button>
          )}

          {confirmDelete ? (
            <div className="bg-red-50 border-2 border-red-200 rounded-2xl px-4 py-3.5 space-y-3">
              <p className="text-base font-black text-red-700 text-center">本当に削除しますか？</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)}
                  className="flex-1 py-3.5 bg-white border-2 border-gray-200 rounded-2xl font-bold text-sm text-gray-600">戻る</button>
                <button onClick={handleDelete} disabled={loading}
                  className="flex-1 py-3.5 bg-red-600 text-white rounded-2xl font-black text-sm flex items-center justify-center gap-1.5 disabled:opacity-50">
                  {loading ? <Loader2 size={14} className="animate-spin" /> : <><Trash2 size={14} />削除する</>}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)}
              className="w-full py-3 rounded-2xl font-bold text-xs border-2 border-red-100 text-red-400 flex items-center justify-center gap-1.5 hover:bg-red-50 active:scale-[0.98] transition-all">
              <Trash2 size={12} />削除する
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── メインページ ───────────────────────────────────────────────
export default function RepairsPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [tab,     setTab]     = useState<Tab>('working')
  const [repairs, setRepairs] = useState<Repair[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [toast,   setToast]   = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const [counts,  setCounts]  = useState({ working: 0, ready: 0 })

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => setToast({ type, msg }), [])

  const fetchRepairs = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const { data } = await (supabase as any)
      .from('repair_histories')
      .select('id,store_id,customer_id,item_name,content,status,received_date,completed_date,delivered_date,price,desired_completion_date,notified,request_no,customer:customers(id,name,tel,line_user_id)')
      .eq('store_id', storeId)
      .in('status', STATUS_MAP[tab])
      .order(tab === 'done' ? 'delivered_date' : 'received_date', { ascending: tab !== 'done' })
      .limit(tab === 'done' ? 50 : 500)
    setRepairs(data ?? [])
    setLoading(false)
  }, [storeId, tab])

  const fetchCounts = useCallback(async () => {
    if (!storeId) return
    const [{ count: w }, { count: r }] = await Promise.all([
      (supabase as any).from('repair_histories').select('*', { count: 'exact', head: true })
        .eq('store_id', storeId).eq('status', 'received'),
      (supabase as any).from('repair_histories').select('*', { count: 'exact', head: true })
        .eq('store_id', storeId).eq('status', 'completed'),
    ])
    setCounts({ working: w ?? 0, ready: r ?? 0 })
  }, [storeId])

  useEffect(() => { fetchRepairs() }, [fetchRepairs])
  useEffect(() => { fetchCounts() }, [fetchCounts, repairs])

  return (
    <div className="min-h-[100dvh] bg-gray-50">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {showAdd && (
        <IntakeModal
          storeId={storeId}
          onSaved={() => { setShowAdd(false); setTab('working'); fetchRepairs(); fetchCounts() }}
          onClose={() => setShowAdd(false)}
        />
      )}

      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm"
        style={{ paddingTop: 'max(14px, env(safe-area-inset-top))' }}>
        <div className="px-5 pb-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center">
                <Scissors size={16} className="text-white" />
              </div>
              <h1 className="font-black text-xl text-gray-900">お直し管理</h1>
            </div>
          </div>

          {/* タブ */}
          <div className="flex">
            {(['working', 'ready', 'done'] as Tab[]).map(t => {
              const badge = t === 'working' ? counts.working : t === 'ready' ? counts.ready : 0
              return (
                <button key={t} onClick={() => setTab(t)}
                  className={`flex-1 pb-3.5 pt-1 text-sm font-bold relative transition-colors flex items-center justify-center gap-1.5 ${
                    tab === t ? 'text-indigo-600' : 'text-gray-400'
                  }`}>
                  {tab === t && <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-indigo-600 rounded-full" />}
                  {TAB_LABELS[t]}
                  {badge > 0 && (
                    <span className={`text-[10px] font-black text-white px-1.5 py-0.5 rounded-full leading-none ${
                      t === 'ready' ? 'bg-emerald-500' : 'bg-red-500'
                    }`}>{badge}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* 一覧 */}
      <div className="px-4 pt-4 pb-36 space-y-3 max-w-lg mx-auto">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 size={30} className="animate-spin text-indigo-400" />
            <p className="text-sm text-gray-400 font-bold">読み込み中...</p>
          </div>
        ) : repairs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Scissors size={40} className="opacity-20 mb-3" />
            <p className="font-bold text-sm">
              {tab === 'working' ? '作業中のお直しはありません' :
               tab === 'ready'   ? '受け取り待ちはありません' :
                                   '渡し済みはありません'}
            </p>
            {tab === 'working' && (
              <button onClick={() => setShowAdd(true)}
                className="mt-4 px-5 py-2.5 rounded-2xl bg-indigo-600 text-white font-bold text-sm flex items-center gap-2">
                <Plus size={15} />受け付ける
              </button>
            )}
          </div>
        ) : (
          repairs.map(r => (
            <RepairCard
              key={r.id}
              repair={r}
              tab={tab}
              onRefresh={() => { fetchRepairs(); fetchCounts() }}
              showToast={showToast}
            />
          ))
        )}
      </div>

      {/* 受付ボタン（フローティング） */}
      <button onClick={() => setShowAdd(true)}
        style={{ bottom: 'calc(1.75rem + env(safe-area-inset-bottom))' }}
        className="fixed right-5 z-40 w-16 h-16 rounded-full bg-indigo-600 text-white shadow-2xl shadow-indigo-400/50 flex items-center justify-center active:scale-95 transition-all hover:bg-indigo-500">
        <Plus size={30} strokeWidth={3} />
      </button>
    </div>
  )
}
