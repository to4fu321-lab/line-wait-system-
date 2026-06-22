'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import {
  X, Loader2, Check, Sparkles, ChevronDown, ChevronUp, Camera, ChevronLeft, User,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { RecentCustomers, type RecentCust } from './RecentCustomers'
import { compressImage } from '@/lib/adminUtils'
import {
  INQ_TYPE_LABELS as TYPE_LABELS,
  INQ_STATUS_LABELS as STATUS_LABELS,
  INQ_METHOD_LABELS as METHOD_LABELS,
} from '../repairs/_components/constants'

export type InquiryType    = 'inquiry' | 'complaint' | 'request' | 'other'
export type InquiryStatus  = 'pending' | 'in_progress' | 'completed'
export type ResponseMethod = 'line' | 'phone' | 'in_store' | 'email'

export interface InquiryRow {
  id: string
  request_no: number | null
  customer_name: string | null
  customer_id?: string | null
  content: string
  type: InquiryType
  is_urgent: boolean
  due_date: string | null
  status: InquiryStatus
  response_method: ResponseMethod | null
  response_notes: string | null
  responded_at: string | null
  received_by: string | null
  handled_by: string | null
  created_at: string
}

interface StaffMember { id: string; name: string }

interface Advice {
  priority?: string; priority_reason?: string; recommended_action?: string; sample_reply?: string
  line_message?: string; email_subject?: string; email_body?: string
  phone_script?: string; store_script?: string; notes?: string | null
}

// 対応方法に応じた「連絡先の条件付き登録」＋「AIアドバイス/送信ドラフト」パネル
function ResponseMethodActions({
  storeId, customerId, customerName, method, linkedTel, linkedLine, type, content, isUrgent, onSaveTel,
}: {
  storeId: string
  customerId: string | null
  customerName: string
  method: ResponseMethod | ''
  linkedTel: string | null
  linkedLine: string | null
  type: InquiryType
  content: string
  isUrgent: boolean
  onSaveTel: (tel: string) => Promise<boolean>
}) {
  const [advice, setAdvice]   = useState<Advice | null>(null)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [sent, setSent]       = useState(false)
  const [copied, setCopied]   = useState<string | null>(null)
  const [telInput, setTelInput] = useState('')
  const [savingTel, setSavingTel] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || ''
  const linkQrUrl = customerId
    ? `https://liff.line.me/${liffId}/${storeId}/link-line?cid=${customerId}`
    : ''

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1500) }
    catch { setErr('コピーに失敗しました') }
  }

  const fetchAdvice = async () => {
    if (!content.trim()) { setErr('先に内容を入力してください'); return }
    setLoading(true); setErr(null)
    try {
      const res = await fetch('/api/inquiry-advice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, isUrgent, customerName, method: method || 'undecided' }),
      })
      const data = await res.json()
      if (!data.ok) { setErr(data.error ?? 'アドバイス取得に失敗しました'); setLoading(false); return }
      setAdvice(data.advice as Advice)
    } catch (e) { setErr(String(e)) }
    setLoading(false)
  }

  const sendLine = async () => {
    if (!linkedLine || !advice?.line_message) return
    setSending(true); setErr(null)
    try {
      const res = await fetch('/api/inquiry-send-line', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineUserId: linkedLine, text: advice.line_message }),
      })
      const data = await res.json()
      if (!data.ok) { setErr(data.error ?? 'LINE送信に失敗しました') } else { setSent(true) }
    } catch (e) { setErr(String(e)) }
    setSending(false)
  }

  if (!method) return null

  return (
    <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
      {err && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2 py-1">{err}</p>}

      {/* 連絡先の条件付き登録 */}
      {customerId && method === 'phone' && !linkedTel && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-bold text-amber-700">この顧客の電話番号が未登録です</p>
          <div className="flex gap-2">
            <input value={telInput} onChange={e => setTelInput(e.target.value)} type="tel" inputMode="numeric" placeholder="電話番号"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            <button onClick={async () => { setSavingTel(true); const ok = await onSaveTel(telInput); setSavingTel(false); if (ok) setTelInput('') }}
              disabled={savingTel} className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-black disabled:opacity-50">登録</button>
          </div>
        </div>
      )}
      {customerId && method === 'phone' && linkedTel && (
        <a href={`tel:${linkedTel}`} className="flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-black">📞 {linkedTel} に発信</a>
      )}
      {customerId && method === 'line' && !linkedLine && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 text-center space-y-2">
          <p className="text-xs font-bold text-indigo-700">この顧客はLINE未連携です。QRを読み取ってもらうと連携できます。</p>
          {linkQrUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&margin=10&data=${encodeURIComponent(linkQrUrl)}`} alt="LINE連携QR" width={160} height={160} className="mx-auto rounded-xl bg-white p-1" />
          )}
        </div>
      )}

      {/* AIアドバイス */}
      <button onClick={fetchAdvice} disabled={loading}
        className="w-full py-2.5 rounded-xl bg-violet-600 text-white text-sm font-black flex items-center justify-center gap-1.5 disabled:opacity-50">
        {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        AIアドバイス{method === 'line' ? '・LINE文面' : method === 'email' ? '・メール文面' : method === 'phone' ? '・電話トーク' : method === 'in_store' ? '・接客トーク' : ''}
      </button>

      {advice && (
        <div className="space-y-2">
          {advice.recommended_action && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] font-black text-gray-400 mb-0.5">推奨対応{advice.priority ? `（優先度: ${advice.priority}）` : ''}</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{advice.recommended_action}</p>
              {advice.notes && <p className="text-[11px] text-amber-600 mt-1">※ {advice.notes}</p>}
            </div>
          )}

          {/* LINE 文面 + 送信 */}
          {method === 'line' && advice.line_message && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3 space-y-2">
              <p className="text-[11px] font-black text-indigo-500">LINE送信文面</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{advice.line_message}</p>
              <div className="flex gap-2">
                <button onClick={() => copy('line', advice.line_message!)} className="flex-1 py-2 rounded-lg bg-white border border-indigo-200 text-indigo-700 text-xs font-bold">{copied === 'line' ? 'コピー済' : '本文をコピー'}</button>
                <button onClick={sendLine} disabled={!linkedLine || sending || sent}
                  className="flex-1 py-2 rounded-lg bg-indigo-600 text-white text-xs font-black disabled:opacity-50 flex items-center justify-center gap-1">
                  {sending ? <Loader2 size={14} className="animate-spin" /> : sent ? '送信済' : 'LINEで送信'}
                </button>
              </div>
              {!linkedLine && <p className="text-[10px] text-amber-600">※LINE未連携のため送信不可。上のQRで連携できます。</p>}
            </div>
          )}

          {/* メール 件名・本文（コピー） */}
          {method === 'email' && (advice.email_subject || advice.email_body) && (
            <div className="bg-teal-50 border border-teal-200 rounded-xl p-3 space-y-2">
              <p className="text-[11px] font-black text-teal-600">メール下書き（ワンタップでコピー）</p>
              {advice.email_subject && (
                <button onClick={() => copy('subj', advice.email_subject!)} className="w-full text-left bg-white border border-teal-200 rounded-lg px-3 py-2">
                  <span className="text-[10px] text-gray-400 block">件名 {copied === 'subj' ? '✓コピー済' : '（タップでコピー）'}</span>
                  <span className="text-sm text-gray-800">{advice.email_subject}</span>
                </button>
              )}
              {advice.email_body && (
                <button onClick={() => copy('body', advice.email_body!)} className="w-full text-left bg-white border border-teal-200 rounded-lg px-3 py-2">
                  <span className="text-[10px] text-gray-400 block">本文 {copied === 'body' ? '✓コピー済' : '（タップでコピー）'}</span>
                  <span className="text-sm text-gray-800 whitespace-pre-wrap">{advice.email_body}</span>
                </button>
              )}
            </div>
          )}

          {/* 電話 / 店頭 トーク */}
          {(method === 'phone' || method === 'in_store') && (advice.phone_script || advice.store_script || advice.sample_reply) && (
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-[11px] font-black text-gray-400 mb-0.5">{method === 'phone' ? '電話トーク例' : '接客トーク例'}</p>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{(method === 'phone' ? advice.phone_script : advice.store_script) || advice.sample_reply}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function InquiryModal({
  storeId, item, onClose, onSave, isSimpleMode = false,
}: {
  storeId: string
  item: InquiryRow | null
  onClose: () => void
  onSave: () => void
  isSimpleMode?: boolean
}) {
  const [type,         setType]         = useState<InquiryType>(item?.type ?? 'inquiry')
  const [customerName, setCustomerName] = useState(item?.customer_name ?? '')
  const [content,      setContent]      = useState(item?.content ?? '')
  const [isUrgent,     setIsUrgent]     = useState(item?.is_urgent ?? false)
  const [dueDate,      setDueDate]      = useState(item?.due_date ?? '')
  const [status,       setStatus]       = useState<InquiryStatus>(item?.status ?? 'pending')
  const [method,       setMethod]       = useState<ResponseMethod | ''>(item?.response_method ?? '')
  const [notes,        setNotes]        = useState(item?.response_notes ?? '')
  const [receivedBy,   setReceivedBy]   = useState(item?.received_by ?? '')
  const [handledBy,    setHandledBy]    = useState(item?.handled_by ?? '')
  const [saving,       setSaving]       = useState(false)
  const [formError,    setFormError]    = useState<string | null>(null)
  const [ocrLoading,   setOcrLoading]   = useState(false)
  const [aiLoading,    setAiLoading]    = useState(false)
  const [aiAdvice,     setAiAdvice]     = useState<{
    priority: string; priority_reason: string
    recommended_action: string; sample_reply: string; notes: string | null
  } | null>(null)
  const [showAdvice,   setShowAdvice]   = useState(false)
  const [staffList,    setStaffList]    = useState<StaffMember[]>([])
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [step,         setStep]         = useState(0)
  const ocrRef = useRef<HTMLInputElement>(null)
  const isEdit = !!item

  // ── 顧客の紐付け・新規登録（どのタイミングでも） ──
  type CustRow = { id: string; name: string; tel: string | null; line_user_id?: string | null }
  const [custId,         setCustId]         = useState<string | null>((item as any)?.customer_id ?? null)
  const [custResults,    setCustResults]    = useState<CustRow[]>([])
  const [custSearching,  setCustSearching]  = useState(false)
  const [custPhoneMode,  setCustPhoneMode]  = useState(false)
  const [custTel,        setCustTel]        = useState('')
  const [custRegistering, setCustRegistering] = useState(false)
  // 紐付け済み顧客の連絡先（条件付き登録・送信用）
  const [linkedTel,  setLinkedTel]  = useState<string | null>(null)
  const [linkedLine, setLinkedLine] = useState<string | null>(null)

  // 名前入力に応じて既存顧客を検索（未紐付け時のみ）
  useEffect(() => {
    if (custId || customerName.trim().length < 1) { setCustResults([]); return }
    const t = setTimeout(async () => {
      setCustSearching(true)
      const q = customerName.trim(); const qTel = q.replace(/[-\s]/g, '')
      const { data } = await (supabase as any).from('customers')
        .select('id, name, tel, line_user_id').eq('store_id', storeId)
        .or(`name.ilike.%${q}%,tel.ilike.%${q}%,tel.ilike.%${qTel}%`).is('deleted_at', null).limit(6)
      setCustResults(data ?? []); setCustSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [customerName, custId, storeId])

  // 紐付け済み顧客の連絡先を取得（編集時など、未取得なら）
  useEffect(() => {
    if (!custId) { setLinkedTel(null); setLinkedLine(null); return }
    let cancelled = false
    ;(async () => {
      const { data } = await (supabase as any).from('customers')
        .select('tel, line_user_id').eq('id', custId).single()
      if (!cancelled && data) { setLinkedTel(data.tel ?? null); setLinkedLine(data.line_user_id ?? null) }
    })()
    return () => { cancelled = true }
  }, [custId])

  const linkCustomer = (c: CustRow) => {
    setCustId(c.id); setCustomerName(c.name); setLinkedTel(c.tel ?? null); setLinkedLine(c.line_user_id ?? null)
    setCustResults([]); setCustPhoneMode(false)
  }
  const registerPhoneCustomer = async () => {
    const name = customerName.trim()
    const tel = custTel.trim()
    const digits = tel.replace(/[-\s]/g, '')
    if (!name) { setFormError('お名前を入力してください'); return }
    if (!/^\d{10,11}$/.test(digits)) { setFormError('電話番号は10〜11桁で入力してください'); return }
    setCustRegistering(true); setFormError(null)
    const { data: rows } = await (supabase as any).from('customers')
      .select('id, name, tel, line_user_id').eq('store_id', storeId).eq('tel', tel).is('deleted_at', null).limit(1)
    let c = rows?.[0]
    if (!c) {
      const { data: created, error } = await (supabase as any).from('customers')
        .insert({ store_id: storeId, name, tel }).select('id, name, tel, line_user_id').single()
      if (error) { setCustRegistering(false); setFormError(error.message ?? '登録に失敗しました'); return }
      c = created
    }
    setCustId(c.id); setCustomerName(c.name); setLinkedTel(c.tel ?? null); setLinkedLine(c.line_user_id ?? null)
    setCustTel(''); setCustPhoneMode(false); setCustRegistering(false)
  }

  // 電話のみ顧客に電話番号を後付け保存
  const saveTelToCustomer = async (tel: string): Promise<boolean> => {
    if (!custId) return false
    const digits = tel.replace(/[-\s]/g, '')
    if (!/^\d{10,11}$/.test(digits)) { setFormError('電話番号は10〜11桁で入力してください'); return false }
    const { error } = await (supabase as any).from('customers')
      .update({ tel: tel.trim(), updated_at: new Date().toISOString() }).eq('id', custId)
    if (error) { setFormError(error.message ?? '保存に失敗しました'); return false }
    setLinkedTel(tel.trim()); return true
  }

  // 初期値スナップショット（変更検知用）— useRef でマウント時の値を保持
  const initialRef = useRef({
    type: item?.type ?? 'inquiry',
    customerName: item?.customer_name ?? '',
    content: item?.content ?? '',
    isUrgent: item?.is_urgent ?? false,
    dueDate: item?.due_date ?? '',
    status: item?.status ?? 'pending',
    method: item?.response_method ?? '',
    notes: item?.response_notes ?? '',
    receivedBy: item?.received_by ?? '',
    handledBy: item?.handled_by ?? '',
  })
  const initial = initialRef.current

  const isDirty = useMemo(() =>
    type !== initial.type ||
    customerName !== initial.customerName ||
    content !== initial.content ||
    isUrgent !== initial.isUrgent ||
    dueDate !== initial.dueDate ||
    status !== initial.status ||
    method !== initial.method ||
    notes !== initial.notes ||
    receivedBy !== initial.receivedBy ||
    handledBy !== initial.handledBy
  , [type, customerName, content, isUrgent, dueDate, status, method, notes, receivedBy, handledBy, initial])

  // スタッフ一覧取得
  useEffect(() => {
    if (!storeId) return
    ;(supabase as any).from('staff')
      .select('id, name')
      .eq('store_id', storeId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }: { data: StaffMember[] | null }) => {
        if (data) setStaffList(data)
      })
      .catch(() => { /* スタッフ取得失敗時はドロップダウンを空のまま */ })
  }, [storeId])

  const handleOcr = async (file: File) => {
    setOcrLoading(true)
    try {
      const base64   = await compressImage(file)
      const storePin = sessionStorage.getItem(`admin_pin_${storeId}`) ?? ''
      const res = await fetch('/api/slip-ocr', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', slipType: 'inquiry', storeId, storePin }),
      })
      const { ok, data } = await res.json()
      if (ok && data) {
        if (data.content)       setContent(prev => prev ? prev + '\n' + data.content : data.content)
        if (data.customer_name) setCustomerName(data.customer_name)
      }
    } catch { /* ignore */ }
    setOcrLoading(false)
  }

  async function handleAiAdvice() {
    if (!content.trim()) return
    setAiLoading(true); setAiAdvice(null); setShowAdvice(false)
    try {
      const res = await fetch('/api/inquiry-advice', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, isUrgent, customerName }),
      })
      const json = await res.json()
      if (json.ok) { setAiAdvice(json.advice); setShowAdvice(true) }
    } finally { setAiLoading(false) }
  }

  async function doSave() {
    if (!content.trim()) { setFormError('内容を入力してください'); return }
    setSaving(true); setFormError(null)
    const now = new Date().toISOString()
    const payload: Record<string, unknown> = {
      store_id:        storeId,
      customer_name:   customerName.trim() || null,
      customer_id:     custId,
      content:         content.trim(),
      type,
      is_urgent:       isUrgent,
      due_date:        dueDate || null,
      status,
      response_method: method || null,
      response_notes:  notes.trim() || null,
      responded_at:    status === 'completed' && !item?.responded_at ? now : (item?.responded_at ?? null),
      received_by:     receivedBy || null,
      handled_by:      handledBy || null,
      updated_at:      now,
    }
    const q = isEdit
      ? (supabase as any).from('inquiries').update(payload).eq('id', item.id)
      : (supabase as any).from('inquiries').insert({ ...payload, created_at: now })
    const { error } = await q
    setSaving(false)
    if (error) { setFormError('保存に失敗しました'); return }
    onSave(); onClose()
  }

  function handleSave() {
    if (!content.trim()) { setFormError('内容を入力してください'); return }
    // 完了への変更時は確認ダイアログ
    if (status === 'completed' && initial.status !== 'completed') {
      setShowConfirm(true)
      return
    }
    doSave()
  }

  // ── ウィザード形式（シンプルモード、または通常モードの新規作成）──────
  // 新規はどのモードでも1画面1〜2項目のウィザード。編集(通常モード)は
  // ステータス・担当者などを扱える従来フォームを使う。
  if (isSimpleMode || !isEdit) {
    const STEP_LABELS = ['種別', '急ぎ', 'お名前', '内容', '対応方法', '確認']
    const TOTAL = STEP_LABELS.length
    return (
      <div className="fixed inset-0 z-[60] bg-black/50 flex items-end sm:items-center justify-center"
        onClick={onClose}>
        <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[95dvh] flex flex-col"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          onClick={e => e.stopPropagation()}>

          {/* ヘッダー */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-3">
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors active:scale-95">
                  <ChevronLeft size={22} className="text-gray-600" />
                </button>
              )}
              <div>
                <h2 className="text-lg font-black text-gray-800">{isEdit ? '問合せを修正' : '問合せを追加'}</h2>
                <p className="text-sm text-gray-400">{STEP_LABELS[step]}　{step + 1} / {TOTAL}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
              <X size={22} className="text-gray-600" />
            </button>
          </div>

          {/* プログレスバー */}
          <div className="h-2 bg-gray-100 shrink-0">
            <div className="h-full bg-indigo-500 transition-all duration-300 rounded-full"
              style={{ width: `${((step + 1) / TOTAL) * 100}%` }} />
          </div>

          {/* コンテンツ */}
          <div className="flex-1 overflow-y-auto px-5 py-6">

            {/* ステップ0：種別 */}
            {step === 0 && (
              <div>
                <p className="text-xl font-black text-gray-800 mb-1">どの種類ですか？</p>
                <p className="text-sm text-gray-500 mb-5">当てはまるものをタップしてください</p>
                <div className="grid grid-cols-2 gap-3">
                  {([
                    { value: 'inquiry'   as InquiryType, emoji: '💬', label: '問合せ',  desc: '商品・在庫のご質問', sel: 'border-blue-400 bg-blue-50'   },
                    { value: 'complaint' as InquiryType, emoji: '😠', label: 'クレーム', desc: 'ご不満・お申し立て',  sel: 'border-red-400 bg-red-50'    },
                    { value: 'request'   as InquiryType, emoji: '📋', label: 'ご要望',  desc: 'お願い・ご意見',     sel: 'border-amber-400 bg-amber-50' },
                    { value: 'other'     as InquiryType, emoji: '📌', label: 'その他',  desc: '上記以外',           sel: 'border-gray-400 bg-gray-100'  },
                  ]).map(opt => (
                    <button key={opt.value}
                      onClick={() => { setType(opt.value); setTimeout(() => setStep(1), 150) }}
                      style={{ touchAction: 'manipulation' }}
                      className={`flex flex-col items-center justify-center gap-2 py-7 rounded-2xl border-2 active:scale-95 transition-all ${
                        type === opt.value ? opt.sel : 'border-gray-200 bg-white'
                      }`}>
                      <span className="text-4xl leading-none">{opt.emoji}</span>
                      <span className="text-base font-black text-gray-800">{opt.label}</span>
                      <span className="text-[11px] text-gray-500 text-center leading-tight px-1">{opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ステップ1：急ぎ */}
            {step === 1 && (
              <div>
                <p className="text-xl font-black text-gray-800 mb-1">急ぎの対応が必要ですか？</p>
                <p className="text-sm text-gray-500 mb-5">どちらかをタップしてください</p>
                <div className="flex flex-col gap-4">
                  <button onClick={() => { setIsUrgent(true); setTimeout(() => setStep(2), 150) }}
                    style={{ touchAction: 'manipulation' }}
                    className={`flex items-center gap-4 px-5 py-6 rounded-2xl border-2 active:scale-95 transition-all ${
                      isUrgent ? 'border-red-400 bg-red-50' : 'border-gray-200 bg-white'
                    }`}>
                    <span className="text-4xl leading-none">🔴</span>
                    <div className="text-left">
                      <p className="text-xl font-black text-red-700">急ぎです</p>
                      <p className="text-sm text-red-400 mt-0.5">すぐに対応が必要</p>
                    </div>
                    {isUrgent && <Check size={22} className="ml-auto text-red-500 shrink-0" />}
                  </button>
                  <button onClick={() => { setIsUrgent(false); setTimeout(() => setStep(2), 150) }}
                    style={{ touchAction: 'manipulation' }}
                    className={`flex items-center gap-4 px-5 py-6 rounded-2xl border-2 active:scale-95 transition-all ${
                      !isUrgent ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 bg-white'
                    }`}>
                    <span className="text-4xl leading-none">🟢</span>
                    <div className="text-left">
                      <p className="text-xl font-black text-emerald-700">急がない</p>
                      <p className="text-sm text-emerald-500 mt-0.5">通常の対応でよい</p>
                    </div>
                    {!isUrgent && <Check size={22} className="ml-auto text-emerald-500 shrink-0" />}
                  </button>
                </div>
              </div>
            )}

            {/* ステップ2：お客様名 */}
            {step === 2 && (
              <div>
                <p className="text-xl font-black text-gray-800 mb-1">お客様のお名前は？</p>
                <p className="text-sm text-gray-500 mb-5">わからない場合は空欄のまま「次へ」。既存のお客様は検索して紐付け、新規はその場で登録できます。</p>

                {custId ? (
                  // 紐付け済み
                  <div className="flex items-center gap-3 bg-indigo-50 border-2 border-indigo-200 rounded-2xl px-4 py-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center"><User size={18} className="text-indigo-600" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900">{customerName || 'お客様'}</p>
                      <p className="text-[11px] text-indigo-500 font-bold">顧客と紐付け済み</p>
                    </div>
                    <button onClick={() => setCustId(null)} className="text-xs font-bold text-gray-500 px-2 py-1 rounded-lg border border-gray-200">解除</button>
                  </div>
                ) : (
                  <>
                    <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                      placeholder="例：山田 太郎"
                      className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-xl focus:border-indigo-400 focus:outline-none"
                      autoComplete="off" />

                    {/* 既存顧客の検索結果（紐付け候補） */}
                    {(custSearching || custResults.length > 0) && (
                      <div className="mt-2 space-y-1.5">
                        {custSearching && <p className="text-xs text-gray-400">検索中…</p>}
                        {custResults.map(c => (
                          <button key={c.id} onClick={() => linkCustomer(c)}
                            className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-2.5 hover:border-indigo-300">
                            <p className="font-bold text-gray-900 text-sm">{c.name}</p>
                            {c.tel && <p className="text-[11px] text-gray-400">{c.tel}</p>}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-2">
                      <RecentCustomers
                        storeId={storeId}
                        visible={customerName.trim() === '' && !custId}
                        onPick={(c: RecentCust) => linkCustomer({ id: c.id, name: c.name, tel: c.tel, line_user_id: c.line_user_id ?? null })}
                      />
                    </div>

                    {/* 電話番号で新規登録 */}
                    {custPhoneMode ? (
                      <div className="mt-3 rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 p-3 space-y-2">
                        <p className="text-xs font-black text-indigo-800">電話番号で新規登録（上のお名前で作成）</p>
                        <input value={custTel} onChange={e => setCustTel(e.target.value)} type="tel" inputMode="numeric"
                          placeholder="電話番号（携帯可）"
                          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:border-indigo-500" />
                        <div className="flex gap-2">
                          <button onClick={() => { setCustPhoneMode(false); setCustTel('') }} className="flex-1 py-2.5 rounded-xl bg-white border-2 border-gray-200 text-gray-600 text-sm font-bold">戻る</button>
                          <button onClick={registerPhoneCustomer} disabled={custRegistering} className="flex-1 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-black flex items-center justify-center gap-1.5 disabled:opacity-50">
                            {custRegistering ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}登録して紐付け
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setCustPhoneMode(true)}
                        className="mt-3 w-full py-2.5 rounded-2xl border-2 border-dashed border-indigo-300 text-indigo-600 text-sm font-bold flex items-center justify-center gap-1.5">
                        📞 電話番号で新規登録する
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ステップ3：内容 */}
            {step === 3 && (
              <div>
                <p className="text-xl font-black text-gray-800 mb-1">どのような内容ですか？</p>
                <p className="text-sm text-gray-500 mb-5">
                  できるだけ詳しく入力してください <span className="text-red-500">（必須）</span>
                </p>
                <textarea value={content} onChange={e => { setContent(e.target.value); setFormError(null) }}
                  placeholder="問合せ・クレームの内容を入力..."
                  rows={7}
                  className="w-full border-2 border-gray-200 rounded-2xl px-5 py-4 text-xl resize-none focus:border-indigo-400 focus:outline-none leading-relaxed"
                  autoComplete="off" />
                {formError && <p className="text-red-600 text-base font-bold mt-3">{formError}</p>}
              </div>
            )}

            {/* ステップ4：対応方法 */}
            {step === 4 && (
              <div>
                <p className="text-xl font-black text-gray-800 mb-1">どのように連絡しますか？</p>
                <p className="text-sm text-gray-500 mb-5">対応方法をタップして「次へ」を押してください</p>
                <div className="flex flex-col gap-3">
                  {([
                    { value: ''        , emoji: '⬜', label: 'まだ決まっていない' },
                    { value: 'line'    , emoji: '💬', label: 'LINE で連絡する'   },
                    { value: 'phone'   , emoji: '📞', label: 'お電話で連絡する'  },
                    { value: 'in_store', emoji: '🏪', label: '次回来店時に対応'  },
                    { value: 'email'   , emoji: '📧', label: 'メールで連絡する'  },
                  ] as const).map(m => (
                    <button key={m.value} onClick={() => setMethod(m.value as ResponseMethod | '')}
                      style={{ touchAction: 'manipulation' }}
                      className={`flex items-center gap-4 px-5 py-4 rounded-2xl border-2 active:scale-95 transition-all ${
                        method === m.value ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 bg-white'
                      }`}>
                      <span className="text-3xl leading-none">{m.emoji}</span>
                      <span className="text-lg font-bold text-gray-800">{m.label}</span>
                      {method === m.value && <Check size={20} className="ml-auto text-indigo-500 shrink-0" />}
                    </button>
                  ))}
                </div>
                <ResponseMethodActions
                  storeId={storeId} customerId={custId} customerName={customerName}
                  method={method} linkedTel={linkedTel} linkedLine={linkedLine}
                  type={type} content={content} isUrgent={isUrgent} onSaveTel={saveTelToCustomer}
                />
              </div>
            )}

            {/* ステップ5：確認 */}
            {step === 5 && (
              <div>
                <p className="text-xl font-black text-gray-800 mb-1">内容を確認してください</p>
                <p className="text-sm text-gray-500 mb-5">問題なければ「保存する」を押してください</p>
                <div className="bg-gray-50 rounded-2xl p-5 space-y-4">
                  {[
                    { label: '種別',     value: TYPE_LABELS[type] },
                    { label: '急ぎ',     value: isUrgent ? '🔴 急ぎです' : '🟢 急がない' },
                    { label: 'お名前',   value: customerName || '（未入力）' },
                    { label: '内容',     value: content },
                    { label: '対応方法', value: method ? METHOD_LABELS[method as ResponseMethod] : 'まだ決まっていない' },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex flex-col gap-1 border-b border-gray-200 last:border-0 pb-4 last:pb-0">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
                      <p className="text-lg font-bold text-gray-800 leading-relaxed whitespace-pre-wrap">{value}</p>
                    </div>
                  ))}
                </div>
                {formError && <p className="text-red-600 text-base font-bold mt-3">{formError}</p>}
              </div>
            )}

          </div>

          {/* フッター */}
          <div className="px-5 py-4 border-t border-gray-100 shrink-0">
            {step === 5 ? (
              <button onClick={handleSave} disabled={saving}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-black disabled:opacity-50 flex items-center justify-center gap-3 transition-colors active:scale-[0.98]">
                {saving ? <Loader2 size={22} className="animate-spin" /> : <Check size={22} />}
                {isEdit ? '更新する' : '保存する'}
              </button>
            ) : step >= 2 ? (
              <button
                onClick={() => {
                  if (step === 3 && !content.trim()) { setFormError('内容を入力してください'); return }
                  setStep(s => s + 1)
                }}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xl font-black transition-colors active:scale-[0.98]">
                次へ →
              </button>
            ) : null}
          </div>

        </div>

        {/* 完了確認ダイアログ（シンプルモード用） */}
        {showConfirm && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6"
            onClick={() => setShowConfirm(false)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden"
              onClick={e => e.stopPropagation()}>
              <div className="bg-emerald-500 px-5 py-4">
                <p className="text-white font-black text-base">対応完了にしますか？</p>
              </div>
              <div className="px-5 py-4 flex gap-3">
                <button onClick={() => setShowConfirm(false)}
                  className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-base font-bold active:opacity-70">
                  戻る
                </button>
                <button onClick={() => { setShowConfirm(false); doSave() }} disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-emerald-600 text-white text-base font-black active:opacity-70 disabled:opacity-50 flex items-center justify-center gap-1.5">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                  完了にする
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center"
      onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[92dvh] flex flex-col"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <h2 className="text-sm font-black text-gray-800">{isEdit ? '問合せ編集' : '問合せ追加'}</h2>
          <div className="flex items-center gap-2">
            <input ref={ocrRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleOcr(f); e.target.value = '' }} />
            <button onClick={() => ocrRef.current?.click()} disabled={ocrLoading}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-violet-100 hover:bg-violet-200 text-violet-700 text-xs font-bold rounded-lg transition-colors disabled:opacity-50">
              {ocrLoading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              {ocrLoading ? '読取中...' : '画像読取'}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-3">
          {/* Type + Urgent */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-600 mb-1 block">種別</label>
              <select value={type} onChange={e => setType(e.target.value as InquiryType)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
                {(Object.entries(TYPE_LABELS) as [InquiryType, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label className="text-xs font-bold text-gray-600 mb-1 block">急ぎ</label>
              <button onClick={() => setIsUrgent(u => !u)}
                className={`px-3 py-2 rounded-xl text-sm font-bold border transition-colors ${
                  isUrgent ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-400 border-gray-200 hover:border-red-300'
                }`}>
                🔴 急ぎ
              </button>
            </div>
          </div>

          {/* Customer link */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">お客様（検索して紐付け・新規登録）</label>
            {custId ? (
              <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2">
                <User size={15} className="text-indigo-600" />
                <span className="flex-1 text-sm font-bold text-gray-900">{customerName || 'お客様'}</span>
                <span className="text-[10px] text-indigo-500 font-bold">紐付け済み</span>
                <button onClick={() => setCustId(null)} className="text-xs text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">解除</button>
              </div>
            ) : (
              <>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)}
                  placeholder="お名前で検索 / 入力"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
                {(custSearching || custResults.length > 0) && (
                  <div className="mt-1.5 space-y-1">
                    {custResults.map(c => (
                      <button key={c.id} onClick={() => linkCustomer(c)} className="w-full text-left bg-white border border-gray-200 rounded-lg px-3 py-2 hover:border-indigo-300">
                        <span className="text-sm font-bold text-gray-900">{c.name}</span>{c.tel && <span className="text-[11px] text-gray-400 ml-2">{c.tel}</span>}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-1.5">
                  <RecentCustomers
                    storeId={storeId}
                    visible={customerName.trim() === '' && !custId}
                    onPick={(c: RecentCust) => linkCustomer({ id: c.id, name: c.name, tel: c.tel, line_user_id: c.line_user_id ?? null })}
                  />
                </div>
                {custPhoneMode ? (
                  <div className="mt-2 flex gap-2">
                    <input value={custTel} onChange={e => setCustTel(e.target.value)} type="tel" inputMode="numeric" placeholder="電話番号"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm" />
                    <button onClick={registerPhoneCustomer} disabled={custRegistering} className="px-3 py-2 rounded-lg bg-indigo-600 text-white text-xs font-black disabled:opacity-50">登録</button>
                    <button onClick={() => { setCustPhoneMode(false); setCustTel('') }} className="px-3 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-bold">×</button>
                  </div>
                ) : (
                  <button onClick={() => setCustPhoneMode(true)} className="mt-2 text-xs font-bold text-indigo-600">📞 電話番号で新規登録</button>
                )}
              </>
            )}
          </div>

          {/* Content + AI */}
          <div>
            <label className="text-xs font-bold text-gray-600 mb-1 block">
              内容 <span className="text-red-500">*</span>
            </label>
            <textarea value={content} onChange={e => { setContent(e.target.value); setAiAdvice(null) }}
              placeholder="問合せ・クレームの内容を入力..."
              rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none" />
            <button type="button" onClick={handleAiAdvice} disabled={!content.trim() || aiLoading}
              className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-black border transition-all disabled:opacity-40 bg-gradient-to-r from-violet-500 to-indigo-500 text-white border-transparent hover:from-violet-400 hover:to-indigo-400 shadow-sm disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:from-transparent disabled:to-transparent disabled:shadow-none">
              {aiLoading ? <><Loader2 size={12} className="animate-spin" />AIが分析中...</> : <><Sparkles size={12} />AIアドバイスを取得</>}
            </button>
          </div>

          {/* AI Advice Panel */}
          {aiAdvice && (
            <div className="rounded-xl border border-violet-200 bg-violet-50 overflow-hidden">
              <button type="button" onClick={() => setShowAdvice(v => !v)}
                className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-black text-violet-700">
                <span className="flex items-center gap-1.5">
                  <Sparkles size={12} />AIアドバイス
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                    aiAdvice.priority === '高' ? 'bg-red-100 text-red-700' :
                    aiAdvice.priority === '中' ? 'bg-amber-100 text-amber-700' :
                    'bg-green-100 text-green-700'
                  }`}>優先度：{aiAdvice.priority}</span>
                </span>
                {showAdvice ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              {showAdvice && (
                <div className="px-3 pb-3 space-y-2.5 border-t border-violet-100">
                  <p className="text-[11px] text-violet-600 pt-2">{aiAdvice.priority_reason}</p>
                  <div>
                    <p className="text-[10px] font-black text-violet-500 mb-0.5">推奨対応</p>
                    <p className="text-xs text-gray-700 leading-relaxed">{aiAdvice.recommended_action}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-violet-500 mb-0.5">返答例</p>
                    <p className="text-xs text-gray-600 leading-relaxed bg-white rounded-lg px-2.5 py-2 border border-violet-100">
                      「{aiAdvice.sample_reply}」
                    </p>
                  </div>
                  {aiAdvice.notes && (
                    <div>
                      <p className="text-[10px] font-black text-violet-500 mb-0.5">注意点</p>
                      <p className="text-xs text-gray-600 leading-relaxed">{aiAdvice.notes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Due date + Status */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-600 mb-1 block">期日</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-600 mb-1 block">ステータス</label>
              <select value={status} onChange={e => setStatus(e.target.value as InquiryStatus)}
                className={`w-full border rounded-xl px-3 py-2 text-sm bg-white font-bold ${
                  status === 'completed' ? 'border-emerald-400 text-emerald-700' :
                  status === 'in_progress' ? 'border-blue-400 text-blue-700' :
                  'border-gray-200 text-gray-700'
                }`}>
                {(Object.entries(STATUS_LABELS) as [InquiryStatus, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 受付者・対応者 */}
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-600 mb-1 block">受付者</label>
              <select value={receivedBy} onChange={e => setReceivedBy(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
                <option value="">未選択</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-600 mb-1 block">対応者</label>
              <select value={handledBy} onChange={e => setHandledBy(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
                <option value="">未選択</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Response info */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2.5">
            <p className="text-xs font-bold text-gray-500">対応情報</p>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1.5 block">対応方法</label>
              <div className="flex flex-wrap gap-1.5">
                {(['', 'line', 'phone', 'in_store', 'email'] as const).map(m => (
                  <button key={m} onClick={() => setMethod(m as ResponseMethod | '')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      method === m
                        ? 'bg-indigo-500 text-white border-indigo-500'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-indigo-300'
                    }`}>
                    {m === '' ? '未定' : METHOD_LABELS[m as ResponseMethod]}
                  </button>
                ))}
              </div>
              <ResponseMethodActions
                storeId={storeId} customerId={custId} customerName={customerName}
                method={method} linkedTel={linkedTel} linkedLine={linkedLine}
                type={type} content={content} isUrgent={isUrgent} onSaveTel={saveTelToCustomer}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 mb-1 block">対応メモ</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="対応内容・返答内容を記録..."
                rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm resize-none bg-white" />
            </div>
          </div>

          {formError && <p className="text-xs text-red-600 font-bold">{formError}</p>}
        </div>

        {/* Footer — 変更がある時のみ更新ボタンを表示 */}
        {(isDirty || !isEdit) && (
          <div className="px-4 py-3 border-t border-gray-100 shrink-0">
            <button onClick={handleSave} disabled={saving}
              className={`w-full py-3 rounded-xl text-white text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2 transition-colors ${
                status === 'completed' && initial.status !== 'completed'
                  ? 'bg-emerald-600 hover:bg-emerald-500'
                  : 'bg-indigo-600 hover:bg-indigo-500'
              }`}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {isEdit ? '更新する' : '保存する'}
            </button>
          </div>
        )}
      </div>

      {/* 完了確認ダイアログ */}
      {showConfirm && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6"
          onClick={() => setShowConfirm(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="bg-emerald-500 px-5 py-4">
              <p className="text-white font-black text-base">対応完了にしますか？</p>
              <p className="text-emerald-100 text-xs mt-0.5">完了にすると対応日時が記録されます</p>
            </div>
            <div className="px-5 py-4 flex gap-3">
              <button onClick={() => setShowConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-bold active:opacity-70"
                style={{ touchAction: 'manipulation' }}>
                キャンセル
              </button>
              <button onClick={() => { setShowConfirm(false); doSave() }}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-black active:opacity-70 disabled:opacity-50 flex items-center justify-center gap-1.5"
                style={{ touchAction: 'manipulation' }}>
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                完了にする
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
