'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Search, Plus, User, Phone, Scissors,
  CheckCheck, Package, Loader2, X, MessageCircle,
  CalendarDays, Pencil, AlertCircle, ChevronDown, ChevronUp,
  RotateCcw, QrCode, History,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Customer, RepairHistory, RepairStatus } from '@/types/crm'
import { REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS } from '@/types/crm'

const LIFF_ID   = process.env.NEXT_PUBLIC_LIFF_ID || '2010126882-aUahQStD'
const LIFF_BASE = `https://liff.line.me/${LIFF_ID}`

// ============================================================
// ユーティリティ
// ============================================================
function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

function Toast({ msg, type }: { msg: string; type: 'ok' | 'err' }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl animate-fade-in max-w-xs text-center ${
      type === 'ok' ? 'bg-emerald-600' : 'bg-red-600'
    }`}>{msg}</div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-zinc-400 mb-1.5">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

// ============================================================
// 顧客バッジ
// ============================================================
function CustomerBadge({ customer, selected, onClick }: {
  customer: Customer; selected: boolean; onClick: () => void
}) {
  return (
    <button onClick={onClick}
      className={`w-full text-left px-4 py-3 rounded-xl border transition-all active:scale-[0.98] ${
        selected
          ? 'bg-indigo-600/30 border-indigo-500/50 text-white'
          : 'bg-zinc-900/60 border-zinc-800/60 text-zinc-300 hover:border-zinc-600'
      }`}>
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${selected ? 'bg-indigo-500/40' : 'bg-zinc-800'}`}>
          <User size={16} className={selected ? 'text-indigo-300' : 'text-zinc-500'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{customer.name}</p>
          <p className="text-xs text-zinc-500 truncate">{customer.kana ?? customer.tel ?? '情報未登録'}</p>
        </div>
        {customer.line_user_id
          ? <MessageCircle size={13} className="text-emerald-400 shrink-0" />
          : <span className="text-[10px] text-zinc-600 shrink-0">LINE未</span>
        }
      </div>
    </button>
  )
}

// ============================================================
// お直しアイテム
// ============================================================
type RepairWithCustomer = RepairHistory & { customer: Pick<Customer, 'name' | 'tel'> | null }

function RepairItem({ repair, showCustomer = false, onComplete, onDeliver, onRevert }: {
  repair: RepairHistory | RepairWithCustomer
  showCustomer?: boolean
  onComplete: (id: string) => Promise<void>
  onDeliver:  (id: string) => Promise<void>
  onRevert:   (id: string) => Promise<void>
}) {
  const [loading,         setLoading]         = useState<string | null>(null)
  const [confirmComplete, setConfirmComplete] = useState(false)
  const [confirmRevert,   setConfirmRevert]   = useState(false)
  const customerName = showCustomer ? (repair as RepairWithCustomer).customer?.name : null

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      repair.status === 'delivered'
        ? 'bg-zinc-900/30 border-zinc-800/40'
        : repair.status === 'completed'
        ? 'bg-emerald-950/40 border-emerald-500/20'
        : 'bg-gradient-to-br from-amber-950/40 to-orange-950/30 border-amber-500/20'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center ${
          repair.status === 'delivered' ? 'bg-zinc-800'
          : repair.status === 'completed' ? 'bg-emerald-500/20'
          : 'bg-amber-500/20'
        }`}>
          {repair.status === 'delivered' ? <Package size={14} className="text-zinc-500" />
          : repair.status === 'completed' ? <CheckCheck size={14} className="text-emerald-400" />
          : <Scissors size={14} className="text-amber-400" />}
        </div>

        <div className="flex-1 min-w-0">
          {customerName && (
            <p className="text-xs font-bold text-indigo-300 mb-1 flex items-center gap-1">
              <User size={10} />{customerName}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${REPAIR_STATUS_COLORS[repair.status]}`}>
              {REPAIR_STATUS_LABELS[repair.status]}
            </span>
            {repair.slip_number && (
              <span className="text-xs text-zinc-500 font-mono">#{repair.slip_number}</span>
            )}
            {repair.notified && (
              <span className="text-xs bg-emerald-900/50 text-emerald-400 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                LINE通知済み
              </span>
            )}
          </div>
          <p className="font-bold text-white text-sm">{repair.item_name}</p>
          <p className="text-zinc-400 text-xs mt-0.5">{repair.content}</p>
          {repair.price != null && <p className="text-zinc-500 text-xs mt-0.5">¥{repair.price.toLocaleString()}</p>}
          {repair.notes && <p className="text-zinc-600 text-xs mt-1 italic">📝 {repair.notes}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-zinc-600 text-xs">
            <span className="flex items-center gap-1"><CalendarDays size={10} />受付 {fmtDate(repair.received_date)}</span>
            {repair.completed_date && <span className="flex items-center gap-1"><CheckCheck size={10} />完了 {fmtDate(repair.completed_date)}</span>}
            {repair.delivered_date && <span className="flex items-center gap-1"><Package size={10} />お渡し {fmtDate(repair.delivered_date)}</span>}
          </div>
        </div>
      </div>

      {/* 預かり中 → 完了（2ステップ確認） */}
      {repair.status === 'received' && (
        confirmComplete ? (
          <div className="mt-3 bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-3 space-y-2">
            <p className="text-xs text-center text-emerald-300 font-bold">✂️ お直し完了 · LINEで通知を送りますか？</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmComplete(false)}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-zinc-700 text-zinc-300 active:scale-95 transition-all">
                キャンセル
              </button>
              <button
                onClick={async () => { setLoading('complete'); await onComplete(repair.id); setLoading(null); setConfirmComplete(false) }}
                disabled={!!loading}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-1.5">
                {loading === 'complete' ? <><Loader2 size={13} className="animate-spin" />送信中...</> : <><CheckCheck size={13} />送信する</>}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmComplete(true)}
            className="w-full mt-3 py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-500/80 to-teal-500/80 hover:from-emerald-500 hover:to-teal-500 text-white active:scale-95 transition-all flex items-center justify-center gap-2">
            <CheckCheck size={14} />お直し完了 · LINE通知を送る
          </button>
        )
      )}

      {/* 完了済み → お渡し or 預かり中に戻す */}
      {repair.status === 'completed' && (
        <div className="mt-3 space-y-2">
          <button
            onClick={async () => { setLoading('deliver'); await onDeliver(repair.id); setLoading(null) }}
            disabled={!!loading}
            className="w-full py-2.5 rounded-xl font-bold text-sm bg-zinc-700/80 hover:bg-zinc-600 text-zinc-200 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading === 'deliver' ? <><Loader2 size={14} className="animate-spin" />処理中...</> : <><Package size={14} />お渡し済みにする</>}
          </button>
          {confirmRevert ? (
            <div className="bg-amber-950/50 border border-amber-500/30 rounded-xl p-3 space-y-2">
              <p className="text-xs text-center text-amber-300 font-bold">預かり中に戻しますか？</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmRevert(false)}
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-zinc-700 text-zinc-300 active:scale-95">キャンセル</button>
                <button
                  onClick={async () => { setLoading('revert'); await onRevert(repair.id); setLoading(null); setConfirmRevert(false) }}
                  disabled={!!loading}
                  className="flex-1 py-2 rounded-xl font-bold text-xs bg-amber-600 text-white active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1">
                  {loading === 'revert' ? <Loader2 size={12} className="animate-spin" /> : <><RotateCcw size={12} />戻す</>}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmRevert(true)}
              className="w-full py-2 rounded-xl font-bold text-xs border border-amber-500/20 text-amber-500/70 hover:text-amber-400 hover:border-amber-500/40 transition-all flex items-center justify-center gap-1.5">
              <RotateCcw size={12} />預かり中に戻す
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================
// 新規お直しフォーム
// ============================================================
function NewRepairForm({ customerId, storeId, onSaved, onCancel }: {
  customerId: string; storeId: string; onSaved: () => void; onCancel: () => void
}) {
  const [itemName,   setItemName]   = useState('')
  const [content,    setContent]    = useState('')
  const [slipNumber, setSlipNumber] = useState('')
  const [price,      setPrice]      = useState('')
  const [notes,      setNotes]      = useState('')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const handleSave = async () => {
    if (!itemName.trim()) { setError('商品名を入力してください'); return }
    if (!content.trim())  { setError('お直し内容を入力してください'); return }
    setLoading(true); setError(null)
    const { error: err } = await supabase.from('repair_histories').insert({
      store_id: storeId, customer_id: customerId,
      item_name: itemName.trim(), content: content.trim(),
      slip_number: slipNumber.trim() || null,
      price: price ? parseInt(price) : null,
      notes: notes.trim() || null,
      status: 'received', received_date: new Date().toISOString().slice(0, 10),
    })
    setLoading(false)
    if (err) { setError(`保存失敗: ${err.message}`); return }
    onSaved()
  }

  return (
    <div className="bg-zinc-900/80 border border-zinc-700/60 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-white text-sm flex items-center gap-2">
          <Scissors size={14} className="text-amber-400" />新規お直し受付
        </p>
        <button onClick={onCancel} className="p-1 text-zinc-500 hover:text-white"><X size={16} /></button>
      </div>
      <Field label="商品名" required>
        <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="例：○○高校スラックス" value={itemName} onChange={e => { setItemName(e.target.value); setError(null) }} />
      </Field>
      <Field label="お直し内容" required>
        <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="例：裾上げ5cm / ウエスト出し" value={content} onChange={e => { setContent(e.target.value); setError(null) }} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="伝票番号">
          <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm font-mono focus:border-indigo-500 focus:outline-none"
            placeholder="例：001" value={slipNumber} onChange={e => setSlipNumber(e.target.value)} />
        </Field>
        <Field label="金額（円）">
          <input type="number" inputMode="numeric" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="例：500" value={price} onChange={e => setPrice(e.target.value)} />
        </Field>
      </div>
      <Field label="メモ">
        <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
          placeholder="スタッフへの申し送り等" value={notes} onChange={e => setNotes(e.target.value)} />
      </Field>
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <button onClick={handleSave} disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '預かりとして登録する'}
      </button>
    </div>
  )
}

// ============================================================
// 新規顧客 QRコードカード
// ============================================================
function NewCustomerQrCard({ storeId, onCancel }: { storeId: string; onCancel: () => void }) {
  const [showManual,  setShowManual]  = useState(false)
  const [name,        setName]        = useState('')
  const [kana,        setKana]        = useState('')
  const [tel,         setTel]         = useState('')
  const [notes,       setNotes]       = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [saved,       setSaved]       = useState(false)

  const registerUrl = `${LIFF_BASE}/${storeId}/crm-register`
  const qrImageUrl  = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(registerUrl)}&margin=15`

  const handleManualSave = async () => {
    if (!name.trim()) { setError('氏名を入力してください'); return }
    setLoading(true); setError(null)
    const { error: err } = await supabase.from('customers').insert({
      store_id: storeId, name: name.trim(),
      kana: kana.trim() || null, tel: tel.trim() || null, notes: notes.trim() || null,
    })
    setLoading(false)
    if (err) { setError(err.message.includes('unique') ? '同じ電話番号の顧客が既に登録されています' : `保存失敗: ${err.message}`); return }
    setSaved(true)
  }

  if (saved) return (
    <div className="bg-zinc-900/80 border border-emerald-500/30 rounded-2xl p-5 text-center space-y-2">
      <CheckCheck size={32} className="mx-auto text-emerald-400" />
      <p className="font-black text-white">登録しました</p>
      <p className="text-zinc-400 text-xs">上の検索ボックスでお客様名を検索してください</p>
      <button onClick={onCancel} className="mt-2 text-xs text-zinc-500 hover:text-white transition-colors">閉じる</button>
    </div>
  )

  return (
    <div className="bg-zinc-900/80 border border-indigo-500/30 rounded-2xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-black text-white text-sm flex items-center gap-2">
          <QrCode size={14} className="text-indigo-400" />新規顧客登録
        </p>
        <button onClick={onCancel} className="p-1 text-zinc-500 hover:text-white"><X size={16} /></button>
      </div>

      {!showManual ? (
        /* QRコードモード */
        <div className="space-y-3">
          <div className="bg-zinc-800/60 border border-zinc-700/40 rounded-2xl p-4 text-center space-y-3">
            <p className="text-white text-sm font-bold">お客様のスマートフォンで<br />QRコードを読み取ってください</p>
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrImageUrl}
                alt="LINE登録用QRコード"
                width={180}
                height={180}
                className="rounded-2xl bg-white p-2"
              />
            </div>
            <p className="text-zinc-500 text-xs">LINEカメラで読み取ると登録画面が開きます</p>
            <p className="text-zinc-600 text-[10px] break-all select-all">{registerUrl}</p>
          </div>

          <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-xl p-3">
            <p className="text-indigo-300 text-xs font-bold mb-1">📱 登録の流れ</p>
            <ol className="text-zinc-400 text-xs space-y-0.5 list-decimal list-inside">
              <li>お客様がQRコードをLINEで読み取る</li>
              <li>お名前を確認して「LINEで登録する」をタップ</li>
              <li>完了後、上の検索でお名前を検索</li>
            </ol>
          </div>

          <button onClick={() => setShowManual(true)}
            className="w-full py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors text-xs flex items-center justify-center gap-1.5">
            <Pencil size={12} />LINEなし・手動入力
          </button>
        </div>
      ) : (
        /* 手動入力モード */
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-400 font-bold">手動入力（LINE未対応のお客様）</p>
            <button onClick={() => setShowManual(false)} className="text-xs text-indigo-400 hover:text-indigo-300">
              QRコードに戻る
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="氏名" required>
              <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="山田 太郎" value={name} onChange={e => { setName(e.target.value); setError(null) }} />
            </Field>
            <Field label="フリガナ">
              <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
                placeholder="ヤマダ タロウ" value={kana} onChange={e => setKana(e.target.value)} />
            </Field>
          </div>
          <Field label="電話番号">
            <input type="tel" inputMode="tel" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="090-1234-5678" value={tel} onChange={e => setTel(e.target.value)} />
          </Field>
          <Field label="メモ">
            <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="アレルギー・注意事項など" value={notes} onChange={e => setNotes(e.target.value)} />
          </Field>
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-500/20 rounded-xl px-3 py-2">
              <AlertCircle size={13} />{error}
            </div>
          )}
          <button onClick={handleManualSave} disabled={loading}
            className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
            {loading ? <><Loader2 size={14} className="animate-spin" />登録中...</> : '顧客を登録する'}
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 顧客編集フォーム
// ============================================================
function EditCustomerForm({ storeId, customer, onSaved, onCancel }: {
  storeId: string; customer: Customer; onSaved: (c: Customer) => void; onCancel: () => void
}) {
  const [name,       setName]       = useState(customer.name)
  const [kana,       setKana]       = useState(customer.kana ?? '')
  const [tel,        setTel]        = useState(customer.tel ?? '')
  const [notes,      setNotes]      = useState(customer.notes ?? '')
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) { setError('氏名を入力してください'); return }
    setLoading(true); setError(null)
    const { data, error: err } = await supabase.from('customers')
      .update({ name: name.trim(), kana: kana.trim() || null, tel: tel.trim() || null, notes: notes.trim() || null })
      .eq('id', customer.id).select().single()
    setLoading(false)
    if (err) { setError(err.message.includes('unique') ? '同じ電話番号の顧客が既に登録されています' : `保存失敗: ${err.message}`); return }
    if (data) onSaved(data)
  }

  return (
    <div className="bg-zinc-900/80 border border-amber-500/30 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-white text-sm flex items-center gap-2">
          <Pencil size={14} className="text-amber-400" />顧客情報を編集
        </p>
        <button onClick={onCancel} className="p-1 text-zinc-500 hover:text-white"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="氏名" required>
          <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
            value={name} onChange={e => { setName(e.target.value); setError(null) }} />
        </Field>
        <Field label="フリガナ">
          <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
            placeholder="ヤマダ タロウ" value={kana} onChange={e => setKana(e.target.value)} />
        </Field>
      </div>
      <Field label="電話番号">
        <input type="tel" inputMode="tel" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
          placeholder="090-1234-5678" value={tel} onChange={e => setTel(e.target.value)} />
      </Field>
      <Field label="メモ">
        <input type="text" className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-white text-sm focus:border-amber-500 focus:outline-none"
          placeholder="アレルギー・注意事項など" value={notes} onChange={e => setNotes(e.target.value)} />
      </Field>
      {error && (
        <div className="flex items-center gap-2 text-red-400 text-xs bg-red-900/20 border border-red-500/20 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <button onClick={handleSave} disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '変更を保存する'}
      </button>
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================
export default function RepairManagementPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router      = useRouter()

  const [storeName,        setStoreName]        = useState('')
  const [customers,        setCustomers]        = useState<Customer[]>([])
  const [searchQuery,      setSearchQuery]      = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [editingCustomer,  setEditingCustomer]  = useState(false)
  const [repairs,          setRepairs]          = useState<RepairHistory[]>([])
  const [stats,            setStats]            = useState({ received: 0, completed: 0 })

  // 預かり中一覧
  const [showReceivedList,  setShowReceivedList]  = useState(false)
  const [receivedRepairs,   setReceivedRepairs]   = useState<RepairWithCustomer[]>([])
  const [receivedLoading,   setReceivedLoading]   = useState(false)

  // 完了連絡済み一覧
  const [showCompletedList, setShowCompletedList] = useState(false)
  const [completedRepairs,  setCompletedRepairs]  = useState<RepairWithCustomer[]>([])
  const [completedLoading,  setCompletedLoading]  = useState(false)

  // お渡し済み一覧
  const [showDeliveredList, setShowDeliveredList] = useState(false)
  const [deliveredRepairs,  setDeliveredRepairs]  = useState<RepairWithCustomer[]>([])
  const [deliveredLoading,  setDeliveredLoading]  = useState(false)
  const [searchDelivered,   setSearchDelivered]   = useState('')

  const [showNewRepair,   setShowNewRepair]   = useState(false)
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [loading,         setLoading]         = useState(false)

  const [toast,   setToast]   = useState<{ type: 'ok' | 'err'; msg: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setToast({ type, msg })
    timerRef.current = setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    if (!storeId) return
    supabase.from('stores').select('name').eq('id', storeId).single()
      .then(({ data }) => { if (data) setStoreName(data.name ?? '') })
  }, [storeId])

  const fetchStats = useCallback(async () => {
    if (!storeId) return
    const { data } = await supabase.from('repair_histories').select('status')
      .eq('store_id', storeId).in('status', ['received', 'completed'])
    if (!data) return
    setStats({ received: data.filter(r => r.status === 'received').length, completed: data.filter(r => r.status === 'completed').length })
  }, [storeId])

  const searchCustomers = useCallback(async (q: string) => {
    if (!storeId || !q.trim()) { setCustomers([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').eq('store_id', storeId)
      .or(`name.ilike.%${q}%,kana.ilike.%${q}%,tel.ilike.%${q.replace(/-/g, '')}%`)
      .order('updated_at', { ascending: false }).limit(20)
    setCustomers(data ?? []); setLoading(false)
  }, [storeId])

  const fetchReceivedRepairs = useCallback(async () => {
    if (!storeId) return; setReceivedLoading(true)
    const { data } = await supabase.from('repair_histories')
      .select('*, customer:customers(name, tel)').eq('store_id', storeId).eq('status', 'received')
      .order('received_date', { ascending: false })
    setReceivedRepairs((data ?? []) as RepairWithCustomer[]); setReceivedLoading(false)
  }, [storeId])

  const fetchCompletedRepairs = useCallback(async () => {
    if (!storeId) return; setCompletedLoading(true)
    const { data } = await supabase.from('repair_histories')
      .select('*, customer:customers(name, tel)').eq('store_id', storeId).eq('status', 'completed')
      .order('completed_date', { ascending: false })
    setCompletedRepairs((data ?? []) as RepairWithCustomer[]); setCompletedLoading(false)
  }, [storeId])

  const fetchDeliveredRepairs = useCallback(async () => {
    if (!storeId) return; setDeliveredLoading(true)
    const { data } = await supabase.from('repair_histories')
      .select('*, customer:customers(name, tel)').eq('store_id', storeId).eq('status', 'delivered')
      .order('delivered_date', { ascending: false }).limit(100)
    setDeliveredRepairs((data ?? []) as RepairWithCustomer[]); setDeliveredLoading(false)
  }, [storeId])

  const fetchRepairs = useCallback(async (customerId: string) => {
    const { data } = await supabase.from('repair_histories').select('*')
      .eq('customer_id', customerId).order('received_date', { ascending: false })
    if (data) setRepairs(data)
  }, [])

  useEffect(() => { fetchStats() }, [fetchStats])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(searchQuery), 300)
    return () => clearTimeout(t)
  }, [searchQuery, searchCustomers])

  useEffect(() => {
    if (selectedCustomer) fetchRepairs(selectedCustomer.id)
    else setRepairs([])
  }, [selectedCustomer, fetchRepairs])

  const handleToggleReceived = () => {
    if (!showReceivedList) fetchReceivedRepairs()
    setShowReceivedList(v => !v); setShowCompletedList(false); setShowDeliveredList(false)
    setSelectedCustomer(null); setSearchQuery('')
  }
  const handleToggleCompleted = () => {
    if (!showCompletedList) fetchCompletedRepairs()
    setShowCompletedList(v => !v); setShowReceivedList(false); setShowDeliveredList(false)
    setSelectedCustomer(null); setSearchQuery('')
  }
  const handleToggleDelivered = () => {
    if (!showDeliveredList) fetchDeliveredRepairs()
    setShowDeliveredList(v => !v); setShowReceivedList(false); setShowCompletedList(false)
    setSelectedCustomer(null); setSearchQuery('')
  }

  const handleComplete = async (repairId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('repair_histories')
      .update({ status: 'completed', completed_date: today }).eq('id', repairId)
    if (error) { showToast('err', `完了処理失敗: ${error.message}`); return }
    setRepairs(prev => prev.map(r => r.id === repairId ? { ...r, status: 'completed' as RepairStatus, completed_date: today } : r))
    setReceivedRepairs(prev => prev.filter(r => r.id !== repairId))
    try {
      const res = await fetch('/api/notify-repair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repairId }),
      })
      const j = await res.json()
      if (j.ok && j.notified) {
        showToast('ok', '✅ 完了処理 + LINE通知を送信しました')
        setRepairs(prev => prev.map(r => r.id === repairId ? { ...r, notified: true } : r))
      } else if (j.skipped) {
        showToast('ok', '✅ 完了処理済み（LINE未連携のため通知なし）')
      } else {
        showToast('err', `完了済み・通知失敗: ${j.error ?? '不明'}`)
      }
    } catch { showToast('err', '完了済み・通知APIエラー') }
    fetchStats()
    if (showCompletedList) fetchCompletedRepairs()
  }

  const handleDeliver = async (repairId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('repair_histories')
      .update({ status: 'delivered', delivered_date: today }).eq('id', repairId)
    if (error) { showToast('err', `受渡処理失敗: ${error.message}`); return }
    setRepairs(prev => prev.map(r => r.id === repairId ? { ...r, status: 'delivered' as RepairStatus, delivered_date: today } : r))
    setCompletedRepairs(prev => prev.filter(r => r.id !== repairId))
    showToast('ok', '📦 お渡し済みにしました')
    fetchStats()
    if (showDeliveredList) fetchDeliveredRepairs()
  }

  const handleRevert = async (repairId: string) => {
    const { error } = await supabase.from('repair_histories')
      .update({ status: 'received', completed_date: null, notified: false }).eq('id', repairId)
    if (error) { showToast('err', `戻し処理失敗: ${error.message}`); return }
    setRepairs(prev => prev.map(r => r.id === repairId ? { ...r, status: 'received' as RepairStatus, completed_date: null, notified: false } : r))
    setCompletedRepairs(prev => prev.filter(r => r.id !== repairId))
    showToast('ok', '🔄 預かり中に戻しました')
    fetchStats()
    if (showReceivedList) fetchReceivedRepairs()
  }

  // お渡し済みの検索フィルター
  const filteredDelivered = searchDelivered.trim()
    ? deliveredRepairs.filter(r =>
        (r.customer?.name ?? '').includes(searchDelivered) ||
        r.item_name.includes(searchDelivered) ||
        (r.slip_number ?? '').includes(searchDelivered)
      )
    : deliveredRepairs

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {toast && <Toast msg={toast.msg} type={toast.type} />}

      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-zinc-950/90 backdrop-blur-xl border-b border-white/5 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => router.push(`/${storeId}/admin`)}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 active:scale-90 transition-all">
            <ArrowLeft size={18} className="text-zinc-400" />
          </button>
          <div className="flex-1">
            <h1 className="font-black text-white text-base flex items-center gap-2">
              <Scissors size={16} className="text-indigo-400" />お直し管理
            </h1>
            {storeName && <p className="text-zinc-500 text-xs">{storeName}</p>}
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">

        {/* 統計バー */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={handleToggleReceived}
            className={`rounded-2xl p-3.5 text-center transition-all active:scale-[0.97] border ${
              showReceivedList ? 'bg-amber-500/20 border-amber-400/40 ring-1 ring-amber-400/30' : 'bg-amber-950/40 border-amber-500/20'
            }`}>
            <p className="text-xs text-amber-400/70 font-bold flex items-center justify-center gap-1">
              預かり中 {showReceivedList ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </p>
            <p className="text-3xl font-black text-amber-300 leading-none mt-0.5">{stats.received}</p>
            <p className="text-xs text-amber-500/50 mt-0.5">件 — タップで一覧</p>
          </button>
          <button onClick={handleToggleCompleted}
            className={`rounded-2xl p-3.5 text-center transition-all active:scale-[0.97] border ${
              showCompletedList ? 'bg-emerald-500/20 border-emerald-400/40 ring-1 ring-emerald-400/30' : 'bg-emerald-950/40 border-emerald-500/20'
            }`}>
            <p className="text-xs text-emerald-400/70 font-bold flex items-center justify-center gap-1">
              完了連絡済み {showCompletedList ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
            </p>
            <p className="text-3xl font-black text-emerald-300 leading-none mt-0.5">{stats.completed}</p>
            <p className="text-xs text-emerald-500/50 mt-0.5">件 — タップで一覧</p>
          </button>
        </div>

        {/* お渡し済み履歴ボタン */}
        <button onClick={handleToggleDelivered}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all active:scale-[0.98] ${
            showDeliveredList ? 'bg-zinc-700/60 border-zinc-500/50' : 'bg-zinc-900/60 border-zinc-800/60 hover:border-zinc-600'
          }`}>
          <History size={16} className="text-zinc-400 shrink-0" />
          <span className="text-zinc-300 text-sm font-bold flex-1 text-left">お渡し済み履歴</span>
          {showDeliveredList ? <ChevronUp size={14} className="text-zinc-500" /> : <ChevronDown size={14} className="text-zinc-500" />}
        </button>

        {/* 預かり中一覧 */}
        {showReceivedList && (
          <div className="space-y-2 animate-fade-in">
            <p className="text-xs font-bold text-amber-400/70 uppercase tracking-wider px-1">預かり中 — {receivedRepairs.length}件</p>
            {receivedLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-amber-400" /></div>
            ) : receivedRepairs.length === 0 ? (
              <div className="text-center py-8 text-zinc-600"><Scissors size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">預かり中のお直しはありません</p></div>
            ) : receivedRepairs.map(r => (
              <RepairItem key={r.id} repair={r} showCustomer onComplete={handleComplete} onDeliver={handleDeliver} onRevert={handleRevert} />
            ))}
            <div className="border-t border-white/5 pt-2" />
          </div>
        )}

        {/* 完了連絡済み一覧 */}
        {showCompletedList && (
          <div className="space-y-2 animate-fade-in">
            <p className="text-xs font-bold text-emerald-400/70 uppercase tracking-wider px-1">完了連絡済み — {completedRepairs.length}件</p>
            {completedLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-emerald-400" /></div>
            ) : completedRepairs.length === 0 ? (
              <div className="text-center py-8 text-zinc-600"><CheckCheck size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">完了連絡済みのお直しはありません</p></div>
            ) : completedRepairs.map(r => (
              <RepairItem key={r.id} repair={r} showCustomer onComplete={handleComplete} onDeliver={handleDeliver} onRevert={handleRevert} />
            ))}
            <div className="border-t border-white/5 pt-2" />
          </div>
        )}

        {/* お渡し済み一覧 + 検索 */}
        {showDeliveredList && (
          <div className="space-y-3 animate-fade-in">
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input type="text" value={searchDelivered}
                onChange={e => setSearchDelivered(e.target.value)}
                placeholder="お客様名 / 商品名 / 伝票番号で絞り込み"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-9 py-2.5 text-sm text-white placeholder-zinc-600 focus:border-zinc-600 focus:outline-none" />
              {searchDelivered && (
                <button onClick={() => setSearchDelivered('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                  <X size={13} />
                </button>
              )}
            </div>
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider px-1">
              お渡し済み — {filteredDelivered.length}件
              {searchDelivered && deliveredRepairs.length !== filteredDelivered.length && ` / 全${deliveredRepairs.length}件`}
            </p>
            {deliveredLoading ? (
              <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-zinc-400" /></div>
            ) : filteredDelivered.length === 0 ? (
              <div className="text-center py-8 text-zinc-600"><Package size={28} className="mx-auto mb-2 opacity-40" /><p className="text-sm">{searchDelivered ? '該当するお直しが見つかりません' : 'お渡し済みのお直しはありません'}</p></div>
            ) : filteredDelivered.map(r => (
              <RepairItem key={r.id} repair={r} showCustomer onComplete={handleComplete} onDeliver={handleDeliver} onRevert={handleRevert} />
            ))}
            <div className="border-t border-white/5 pt-2" />
          </div>
        )}

        {/* 顧客検索 */}
        <div className="space-y-2">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input type="text" value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowReceivedList(false); setShowCompletedList(false); setShowDeliveredList(false) }}
              placeholder="顧客を名前・フリガナ・電話番号で検索"
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-indigo-500 focus:outline-none transition-colors" />
            {searchQuery && (
              <button onClick={() => { setSearchQuery(''); setCustomers([]); setSelectedCustomer(null) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                <X size={14} />
              </button>
            )}
          </div>

          {showNewCustomer ? (
            <NewCustomerQrCard storeId={storeId} onCancel={() => setShowNewCustomer(false)} />
          ) : (
            <button onClick={() => setShowNewCustomer(true)}
              className="w-full py-2.5 rounded-xl border border-dashed border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors text-sm flex items-center justify-center gap-2">
              <Plus size={14} />新規顧客を登録
            </button>
          )}
        </div>

        {/* 顧客リスト（検索時のみ） */}
        {searchQuery.trim() && (
          loading ? (
            <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-indigo-400" /></div>
          ) : customers.length === 0 ? (
            <div className="text-center py-6 text-zinc-600">
              <User size={28} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">該当する顧客が見つかりません</p>
              <p className="text-xs mt-1 text-zinc-700">新規顧客として登録できます</p>
            </div>
          ) : (
            <div className="space-y-2 animate-fade-in">
              {customers.map(c => (
                <CustomerBadge key={c.id} customer={c}
                  selected={selectedCustomer?.id === c.id}
                  onClick={() => { setSelectedCustomer(prev => prev?.id === c.id ? null : c); setEditingCustomer(false); setShowNewRepair(false) }}
                />
              ))}
            </div>
          )
        )}

        {/* 選択中顧客の詳細 + お直し履歴 */}
        {selectedCustomer && (
          <div className="space-y-3 pt-2 border-t border-white/5">
            {editingCustomer ? (
              <EditCustomerForm
                storeId={storeId}
                customer={selectedCustomer}
                onSaved={updated => {
                  setSelectedCustomer(updated)
                  setCustomers(prev => prev.map(c => c.id === updated.id ? updated : c))
                  setEditingCustomer(false)
                  showToast('ok', '顧客情報を更新しました')
                }}
                onCancel={() => setEditingCustomer(false)}
              />
            ) : (
              <div className="bg-zinc-900/60 border border-white/8 rounded-2xl p-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
                    <User size={20} className="text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black text-white text-base">{selectedCustomer.name}</p>
                    {selectedCustomer.kana && <p className="text-zinc-500 text-xs">{selectedCustomer.kana}</p>}
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      {selectedCustomer.tel && (
                        <span className="flex items-center gap-1 text-zinc-400 text-xs"><Phone size={11} />{selectedCustomer.tel}</span>
                      )}
                      {selectedCustomer.line_user_id
                        ? <span className="flex items-center gap-1 text-emerald-400 text-xs"><MessageCircle size={11} />LINE連携済み</span>
                        : <span className="text-zinc-600 text-xs">LINE未連携</span>
                      }
                    </div>
                    {selectedCustomer.notes && (
                      <p className="text-zinc-500 text-xs mt-1 bg-zinc-800/50 rounded-lg px-2 py-1">📝 {selectedCustomer.notes}</p>
                    )}
                  </div>
                  <button onClick={() => setEditingCustomer(true)}
                    className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/50 text-zinc-400 hover:text-white hover:bg-zinc-700 active:scale-90 transition-all shrink-0">
                    <Pencil size={14} />
                  </button>
                </div>
              </div>
            )}

            {!editingCustomer && (
              <>
                <div>
                  <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">お直し履歴 ({repairs.length}件)</p>
                  {repairs.length === 0 ? (
                    <div className="text-center py-6 text-zinc-700">
                      <Scissors size={24} className="mx-auto mb-2 opacity-40" />
                      <p className="text-sm">お直し履歴がありません</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {repairs.map(r => (
                        <RepairItem key={r.id} repair={r} onComplete={handleComplete} onDeliver={handleDeliver} onRevert={handleRevert} />
                      ))}
                    </div>
                  )}
                </div>

                {showNewRepair ? (
                  <NewRepairForm storeId={storeId} customerId={selectedCustomer.id}
                    onSaved={() => { setShowNewRepair(false); fetchRepairs(selectedCustomer.id); fetchStats(); showToast('ok', 'お直しを受け付けました') }}
                    onCancel={() => setShowNewRepair(false)}
                  />
                ) : (
                  <button onClick={() => setShowNewRepair(true)}
                    className="w-full py-3.5 rounded-2xl border border-dashed border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 transition-colors text-sm font-bold flex items-center justify-center gap-2">
                    <Plus size={15} />このお客様のお直しを受け付ける
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
