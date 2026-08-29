'use client'

// ============================================================================
//  クイック受付 — 「完了連絡の自動化」だけを狙った最小の受付
//
//  紙の受付表をラケットに貼る運用はそのまま続ける前提。紙が正で、アプリは
//  “張り上がりを自動で連絡するため”だけに使う。だから聞くのは3つだけ:
//     お客様 / 種類 / 伝票No.・本数
//  （通常の受付モーダルは 種目>作業>仕様>オプション>価格>写真>納期>確認 と
//    最大9段あり、1日20本さばく張替え受付には重すぎる）
//
//  設計: docs/repair-flexible-catalog-design.md / 段階移行の「段1」
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import { X, Search, Loader2, Phone, Check, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isSessionExpiredError } from '@/lib/staffSessionClient'
import { REPAIR_LABELS as labels } from '@/lib/repairProfile'
import type { RepairGarmentType } from '@/types/repair'
import type { CustResult } from './types'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-3 text-gray-900 text-base focus:outline-none focus:border-indigo-500 bg-white'

export function QuickReceiveModal({ storeId, onClose, onSaved, onToast }: {
  storeId:  string
  onClose:  () => void
  onSaved:  () => void
  onToast:  (t: 'ok' | 'err', m: string) => void
}) {

  // ── お客様 ────────────────────────────────────────────────
  const [custSearch, setCustSearch]   = useState('')
  const [custResults, setCustResults] = useState<CustResult[]>([])
  const [searching, setSearching]     = useState(false)
  const [selectedCust, setSelected]   = useState<CustResult | null>(null)

  // 新規登録（電話番号は連絡の生命線なので桁数を検証する）
  const [newMode, setNewMode]   = useState(false)
  const [newName, setNewName]   = useState('')
  const [newTel,  setNewTel]    = useState('')
  const [registering, setReg]   = useState(false)

  // ── 受付内容 ──────────────────────────────────────────────
  const [garments, setGarments] = useState<RepairGarmentType[]>([])
  const [garment,  setGarment]  = useState<RepairGarmentType | null>(null)
  const [slipNo,   setSlipNo]   = useState('')
  const [qty,      setQty]      = useState(1)
  const [saving,   setSaving]   = useState(false)

  useEffect(() => {
    ;(supabase as any).from('repair_garment_types')
      .select('*').eq('store_id', storeId).eq('active', true).order('sort_order')
      .then(({ data }: any) => setGarments((data ?? []) as RepairGarmentType[]))
  }, [storeId])

  // 顧客検索（既存モーダルと同じ条件）
  useEffect(() => {
    if (custSearch.trim().length < 1) { setCustResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const q = custSearch.trim(); const qTel = q.replace(/[-\s]/g, '')
      const { data } = await (supabase as any).from('customers')
        .select('id, name, tel, school_name, children:children(id, name, school_name)')
        .eq('store_id', storeId)
        .or(`name.ilike.%${q}%,kana.ilike.%${q}%,tel.ilike.%${q}%,tel.ilike.%${qTel}%,school_name.ilike.%${q}%`)
        .is('deleted_at', null).limit(8)
      setCustResults(data ?? []); setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [custSearch, storeId])

  const registerNew = useCallback(async () => {
    const tel = newTel.trim()
    const digits = tel.replace(/[-\s]/g, '')
    if (!newName.trim()) { onToast('err', 'お名前を入力してください'); return }
    if (!/^\d{10,11}$/.test(digits)) { onToast('err', '電話番号は10〜11桁で入力してください'); return }
    setReg(true)
    const sel = 'id, name, tel, school_name, children:children(id, name, school_name)'
    // 既存を電話番号で検索 → 無ければ作成（重複顧客を増やさない）
    const { data: rows } = await (supabase as any).from('customers')
      .select(sel).eq('store_id', storeId).eq('tel', tel).is('deleted_at', null).limit(1)
    let cust: CustResult | undefined = rows?.[0]
    if (!cust) {
      const { data: c, error } = await (supabase as any).from('customers')
        .insert({ store_id: storeId, name: newName.trim(), tel }).select(sel).single()
      if (error) {
        setReg(false)
        if (isSessionExpiredError(error)) {
          onToast('err', 'ログインの有効期限が切れました。3秒後に管理画面トップへ移動します。')
          setTimeout(() => { window.location.href = `/${storeId}/admin` }, 3000)
          return
        }
        onToast('err', error.message ?? '登録に失敗しました'); return
      }
      cust = c as CustResult
    }
    setSelected(cust!); setNewMode(false); setNewName(''); setNewTel(''); setReg(false)
  }, [newName, newTel, storeId, onToast])

  // ── 保存（紙1枚 = 1レコード。本数は content に残す）──────────
  const save = async () => {
    if (!selectedCust || saving) return
    setSaving(true)
    const itemName = garment?.name ?? 'お預かり品'
    const content  = qty > 1 ? `${itemName} ${qty}${labels.unit_count}` : itemName
    const { error } = await (supabase as any).from('repair_histories').insert({
      store_id:     storeId,
      customer_id:  selectedCust.id,
      item_name:    itemName,
      content,
      status:       'received',
      request_type: 'repair',
      received_date: new Date().toISOString().slice(0, 10),
      slip_number:  slipNo.trim() || null,
      garment_type_id: garment?.id ?? null,
      garment_name: garment?.name ?? null,
    })
    setSaving(false)
    if (error) {
      if (isSessionExpiredError(error)) {
        onToast('err', 'ログインの有効期限が切れました。3秒後に管理画面トップへ移動します。')
        setTimeout(() => { window.location.href = `/${storeId}/admin` }, 3000)
        return
      }
      onToast('err', error.message ?? '受付の保存に失敗しました')
      return
    }
    onToast('ok', `${selectedCust.name} 様の受付を登録しました`)
    onSaved()
    onClose()
  }

  const telMissing = !selectedCust?.tel

  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92dvh] flex flex-col"
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-black text-gray-800">クイック受付</h2>
            <p className="text-[11px] text-gray-400">お渡しの連絡を自動で送るための最小登録です</p>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl">
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* ① お客様 */}
          {!selectedCust ? (
            newMode ? (
              <div className="space-y-3">
                <button onClick={() => setNewMode(false)} className="flex items-center gap-1 text-sm text-gray-500 font-bold">
                  <ChevronLeft size={16} />検索に戻る
                </button>
                <p className="text-base font-black text-gray-800">新しいお客様</p>
                <input className={INPUT} placeholder="お名前" value={newName} onChange={e => setNewName(e.target.value)} />
                <input className={INPUT} placeholder="電話番号（ハイフンなし可）" inputMode="tel"
                  value={newTel} onChange={e => setNewTel(e.target.value)} />
                <p className="text-[11px] text-gray-400">
                  電話番号は仕上がりの連絡に使います。間違うと連絡が届かないので、その場で復唱してください。
                </p>
                <button onClick={registerNew} disabled={registering}
                  className="w-full py-3 rounded-xl bg-indigo-600 text-white font-black disabled:opacity-60">
                  {registering ? <Loader2 size={18} className="animate-spin mx-auto" /> : '登録する'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-base font-black text-gray-800">① お客様</p>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input className={INPUT + ' pl-9'} placeholder="名前・電話番号で検索"
                    value={custSearch} onChange={e => setCustSearch(e.target.value)} autoFocus />
                </div>
                {searching && <p className="text-xs text-gray-400 text-center py-2">検索中…</p>}
                <div className="space-y-1.5">
                  {custResults.map(c => (
                    <button key={c.id} onClick={() => setSelected(c)}
                      className="w-full text-left rounded-xl border border-gray-200 px-3 py-2.5 hover:bg-gray-50">
                      <span className="block font-bold text-gray-800">{c.name}</span>
                      <span className="block text-xs text-gray-400">{c.tel ?? '電話番号なし'}</span>
                    </button>
                  ))}
                </div>
                <button onClick={() => { setNewMode(true); setNewName(custSearch.trim()) }}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-300 text-gray-600 font-bold">
                  <Phone size={16} />新しいお客様を登録
                </button>
              </div>
            )
          ) : (
            <div className="rounded-xl bg-indigo-50 border border-indigo-200 px-3 py-2.5 flex items-center justify-between">
              <div>
                <span className="block font-black text-indigo-800">{selectedCust.name} 様</span>
                <span className="block text-xs text-indigo-500">{selectedCust.tel ?? '電話番号なし'}</span>
              </div>
              <button onClick={() => setSelected(null)} className="text-xs font-bold text-indigo-600 underline">変更</button>
            </div>
          )}

          {/* 連絡先が無いと自動連絡ができないので受付前に警告する */}
          {selectedCust && telMissing && (
            <p className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs font-bold text-amber-700">
              ⚠️ 電話番号が未登録です。このままでは仕上がりの自動連絡が送れません（従来どおりお電話が必要です）。
            </p>
          )}

          {selectedCust && (
            <>
              {/* ② 種類 */}
              {garments.length > 0 && (
                <div className="space-y-2">
                  <p className="text-base font-black text-gray-800">② {labels.garment}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {garments.map(g => (
                      <button key={g.id} onClick={() => setGarment(g)}
                        className={`rounded-xl border-2 px-3 py-3 text-sm font-bold transition ${
                          garment?.id === g.id ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-700'
                        }`}>
                        {g.icon && <span className="mr-1">{g.icon}</span>}{g.name}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-gray-400">連絡メッセージに載る名前です。</p>
                </div>
              )}

              {/* ③ 伝票No.・本数 */}
              <div className="space-y-2">
                <p className="text-base font-black text-gray-800">③ 伝票番号・{labels.unit_count}数</p>
                <input className={INPUT} placeholder={`伝票番号（紙の No. をそのまま／任意）`}
                  inputMode="numeric" value={slipNo} onChange={e => setSlipNo(e.target.value)} />
                <div className="flex items-center gap-2 bg-gray-50 rounded-xl p-2">
                  <button type="button" onClick={() => setQty(Math.max(1, qty - 1))}
                    className="w-11 h-11 rounded-lg bg-white border font-black text-lg">−</button>
                  <div className="flex-1 text-center font-black text-2xl text-gray-800">
                    {qty}<span className="text-sm ml-0.5">{labels.unit_count}</span>
                  </div>
                  <button type="button" onClick={() => setQty(qty + 1)}
                    className="w-11 h-11 rounded-lg bg-white border font-black text-lg">＋</button>
                </div>
                <p className="text-[11px] text-gray-400">
                  紙の受付表はこれまでどおりお使いください。ここは連絡用の控えです。
                </p>
              </div>
            </>
          )}
        </div>

        {selectedCust && (
          <div className="px-5 py-4 border-t border-gray-100 shrink-0">
            <button onClick={save} disabled={saving}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-indigo-600 text-white font-black text-base active:scale-[0.99] disabled:opacity-60">
              {saving ? <Loader2 size={20} className="animate-spin" /> : <><Check size={20} />受付を登録</>}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
