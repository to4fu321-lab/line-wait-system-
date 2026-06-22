'use client'

// ============================================================
// 顧客インライン紐付けシート（画面遷移なしで顧客を検索・紐付け・新規登録）
//   お直し・追加購入の「顧客チップ」から開く共通オーバーレイ。
// ============================================================
import { useEffect, useState } from 'react'
import { Loader2, X, Check, Search, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CustResult } from './types'
import { RecentCustomers, type RecentCust } from '../../_components/RecentCustomers'

type Child = { id: string; name: string; school_name: string | null }

export function CustomerLinkSheet({
  storeId, selectedCust, selectedChild, onSelect, onClear, onClose,
}: {
  storeId: string
  selectedCust: CustResult | null
  selectedChild: Child | null
  onSelect: (c: CustResult, child: Child | null) => void
  onClear: () => void
  onClose: () => void
}) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<CustResult[]>([])
  const [searching, setSearching] = useState(false)
  const [showReg, setShowReg] = useState(false)
  const [phoneMode, setPhoneMode] = useState(false)
  const [name, setName] = useState('')
  const [tel, setTel] = useState('')
  const [registering, setRegistering] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    if (q.trim().length < 1) { setResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const s = q.trim(); const sTel = s.replace(/[-\s]/g, '')
      const { data } = await (supabase as any).from('customers')
        .select('id, name, tel, school_name, children:children(id, name, school_name)')
        .eq('store_id', storeId)
        .or(`name.ilike.%${s}%,kana.ilike.%${s}%,tel.ilike.%${s}%,tel.ilike.%${sTel}%,school_name.ilike.%${s}%`)
        .is('deleted_at', null).limit(8)
      setResults(data ?? []); setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [q, storeId])

  const pick = (c: CustResult, child: Child | null) => { onSelect(c, child); onClose() }

  const handleRegister = async () => {
    const nm = name.trim(); const t = tel.trim(); const digits = t.replace(/[-\s]/g, '')
    if (!nm) { setErr('お名前を入力してください'); return }
    if (!/^\d{10,11}$/.test(digits)) { setErr('電話番号は10〜11桁で入力してください'); return }
    setRegistering(true); setErr(null)
    const sel = 'id, name, tel, school_name, children:children(id, name, school_name)'
    const { data: rows } = await (supabase as any).from('customers')
      .select(sel).eq('store_id', storeId).eq('tel', t).is('deleted_at', null).limit(1)
    let c: CustResult | undefined = rows?.[0]
    if (!c) {
      const { data: created, error } = await (supabase as any).from('customers')
        .insert({ store_id: storeId, name: nm, tel: t }).select(sel).single()
      if (error) { setRegistering(false); setErr(error.message ?? '登録に失敗しました'); return }
      c = created as CustResult
    }
    setRegistering(false)
    pick(c!, null)
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[88vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white px-4 py-3 border-b flex items-center justify-between rounded-t-3xl">
          <h3 className="font-black text-gray-900 flex items-center gap-1.5"><User size={18} className="text-indigo-600" /> 顧客を紐付け</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {err && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{err}</div>}

          {selectedCust && (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-2.5">
              <User size={15} className="text-indigo-600" />
              <span className="flex-1 text-sm font-bold text-gray-900 truncate">{selectedChild?.name ?? selectedCust.name}{selectedChild ? `（保護者: ${selectedCust.name}）` : ''}</span>
              <button onClick={() => { onClear() }} className="text-xs font-bold text-gray-500 border border-gray-200 rounded-lg px-2 py-1">解除</button>
            </div>
          )}

          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="お名前・電話・学校で検索"
              className="w-full border border-gray-300 rounded-xl pl-9 pr-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-500" />
            {searching && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-300" />}
          </div>

          <RecentCustomers
            storeId={storeId}
            visible={q.trim() === '' && !showReg}
            withChildren
            onPick={(c: RecentCust, ch) => pick({ id: c.id, name: c.name, tel: c.tel, school_name: c.school_name ?? null, children: c.children }, ch)}
          />

          <div className="space-y-1.5">
            {results.map(c => (
              (c.children && c.children.length > 0) ? (
                c.children.map(ch => (
                  <button key={ch.id} onClick={() => pick(c, ch)} className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300">
                    {ch.school_name && <p className="text-[11px] font-black text-amber-600 leading-none mb-0.5">{ch.school_name}</p>}
                    <p className="font-bold text-gray-900">{ch.name}</p>
                    <p className="text-xs text-gray-400">保護者: {c.name}{c.tel ? ` / ${c.tel}` : ''}</p>
                  </button>
                ))
              ) : (
                <button key={c.id} onClick={() => pick(c, null)} className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300">
                  <p className="font-bold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">{[c.tel, c.school_name].filter(Boolean).join(' / ')}</p>
                </button>
              )
            ))}
            {q && !searching && results.length === 0 && <p className="text-center text-sm text-gray-400 py-3">該当なし。新規登録できます。</p>}
          </div>

          {/* 新規登録（電話 / LINE） */}
          {!showReg ? (
            <button onClick={() => { setShowReg(true); if (!name && q && !/\d/.test(q)) setName(q.trim()) }}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-indigo-300 text-indigo-600 text-sm font-bold">
              ➕ 新規顧客を登録する
            </button>
          ) : (
            <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 p-3 space-y-3">
              {phoneMode ? (
                <div className="space-y-2">
                  <p className="text-xs font-black text-indigo-800">電話番号で登録・紐付け</p>
                  <input className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-500" placeholder="お名前" value={name} onChange={e => setName(e.target.value)} />
                  <input className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-500" type="tel" inputMode="numeric" placeholder="電話番号（携帯可）" value={tel} onChange={e => setTel(e.target.value)} />
                  <div className="flex gap-2">
                    <button onClick={() => { setPhoneMode(false); setTel('') }} className="flex-1 py-2.5 rounded-xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-bold">戻る</button>
                    <button onClick={handleRegister} disabled={registering} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black flex items-center justify-center gap-1.5 disabled:opacity-50">
                      {registering ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}登録して選択
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setPhoneMode(true)} className="w-full py-3 rounded-xl bg-indigo-600 text-white text-sm font-black">📞 電話番号で登録する</button>
              )}
              <div className="border-t border-indigo-200 pt-3 text-center space-y-2">
                <p className="text-xs font-black text-indigo-800">またはLINEで登録（QRを読み取ってもらう）</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(`https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID || ''}/${storeId}`)}`}
                  alt="受付QR" width={170} height={170} className="mx-auto rounded-xl bg-white p-1 shadow-sm" />
                <p className="text-[10px] text-indigo-500">LINE登録後、上の検索欄でお名前を検索してください</p>
              </div>
              <button onClick={() => { setShowReg(false); setPhoneMode(false); setTel('') }} className="w-full py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl">閉じる</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
