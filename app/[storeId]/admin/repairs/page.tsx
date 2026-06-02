'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Scissors, ShoppingBag, Loader2, ChevronDown, ChevronUp, ChevronLeft,
  Phone, User, Check, RotateCcw, Package, ClipboardList,
  Banknote, Plus, AlertCircle, CreditCard, CheckCheck,
  History, CalendarDays, Copy, X, Pencil, Truck, Trash2,
  Search, Database, ShoppingCart, Tag, Camera, ScanLine,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS,
  PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS,
  REQUEST_TYPE_LABELS, REQUEST_TYPE_COLORS,
  REPAIR_TYPE_LABELS, REPAIR_TYPE_ICONS, REPAIR_TYPE_COLORS,
} from '@/types/crm'
import type { RepairStatus, PurchaseStatus, RequestType, RepairType } from '@/types/crm'
import { BottomNav } from '../_components/BottomNav'

function fmtDate(d: string | null) {
  if (!d) return ''
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

function todayJst() {
  return new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10)
}

// ── Types ─────────────────────────────────────────────────────
interface RepairRow {
  id: string; store_id: string; customer_id: string; child_id: string | null
  slip_number: string | null; item_name: string; content: string
  status: RepairStatus; received_date: string; completed_date: string | null
  delivered_date: string | null; price: number | null; notes: string | null
  notified: boolean; request_type: RequestType | null; prepaid: boolean | null
  desired_completion_date: string | null; work_started: boolean
  created_at: string; updated_at: string
  customer?: { id: string; name: string; tel: string | null }
  child?: { name: string; school_name: string | null } | null
  // お直し詳細フィールド
  repair_type: RepairType | null
  hem_length_mm: number | null
  sleeve_adjust_mm: number | null
  waist_adjust_mm: number | null
  embroidery_text: string | null
  embroidery_color: string | null
  embroidery_pos: string | null
  vendor_name: string | null
  sent_to_vendor_at: string | null
  expected_return_date: string | null
  is_rework: boolean
  rework_reason: string | null
  internal_memo: string | null
}

interface PurchaseRow {
  id: string; store_id: string; customer_id: string; child_id: string | null
  item_name: string; maker: string | null; notes: string | null; status: PurchaseStatus
  price: number | null; ordered_date: string; arrived_date: string | null
  delivered_date: string | null; notified: boolean; created_at: string; updated_at: string
  customer?: { id: string; name: string; tel: string | null }
  child?: { name: string; school_name: string | null } | null
}

interface DeliveryItem {
  id:             string
  kind:           'repair' | 'purchase'
  store_id:       string
  customer_id:    string
  child_id:       string | null
  item_name:      string
  sub_label:      string
  status:         string
  prev_status:    string
  received_date:  string
  ready_date:     string | null
  desired_completion_date: string | null
  delivered_date: string | null
  price:          number | null
  slip_number:    string | null
  notified:       boolean
  payment_status: string | null
  delivered_by:   string | null
  customer:       { name: string; tel: string | null } | null
  child:          { name: string; school_name: string | null } | null
}

function rawToItem(row: Record<string, unknown>, kind: 'repair' | 'purchase'): DeliveryItem {
  return {
    id:             row.id as string,
    kind,
    store_id:       row.store_id as string,
    customer_id:    row.customer_id as string,
    child_id:       row.child_id as string | null,
    item_name:      row.item_name as string,
    sub_label:      kind === 'repair' ? (row.content as string ?? '') : (row.notes as string ?? ''),
    status:         row.status as string,
    prev_status:    kind === 'repair' ? 'completed' : 'arrived',
    received_date:  kind === 'repair' ? (row.received_date as string) : (row.ordered_date as string),
    ready_date:     kind === 'repair' ? (row.completed_date as string | null) : (row.arrived_date as string | null),
    desired_completion_date: kind === 'repair' ? (row.desired_completion_date as string | null ?? null) : null,
    delivered_date: row.delivered_date as string | null,
    price:          row.price as number | null,
    slip_number:    kind === 'repair' ? (row.slip_number as string | null) : null,
    notified:       (row.notified as boolean) ?? false,
    payment_status: row.payment_status as string | null ?? null,
    delivered_by:   row.delivered_by as string | null ?? null,
    customer:       row.customer as { name: string; tel: string | null } | null,
    child:          row.child as { name: string; school_name: string | null } | null,
  }
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ msg, type, onUndo, onClose }: {
  msg: string; type: 'ok' | 'err'; onUndo?: () => Promise<void>; onClose: () => void
}) {
  const [undoing, setUndoing] = useState(false)
  useEffect(() => {
    const t = setTimeout(onClose, onUndo ? 5000 : 3000)
    return () => clearTimeout(t)
  }, [onClose, onUndo])
  const handleUndo = async () => {
    if (!onUndo || undoing) return
    setUndoing(true)
    await onUndo()
    onClose()
  }
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl max-w-xs ${
      type === 'err' ? 'bg-red-600' : 'bg-gray-900 border border-gray-700'
    }`}>
      <span className="flex-1">{msg}</span>
      {onUndo && (
        <button onClick={handleUndo} disabled={undoing}
          className="shrink-0 px-3 py-1 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-xs font-black active:scale-95 transition-all disabled:opacity-50">
          {undoing ? '…' : '取消し'}
        </button>
      )}
    </div>
  )
}

// ── New Repair Modal ──────────────────────────────────────────
const REPAIR_TYPES_DEF: Array<{ type: RepairType; label: string; icon: string; color: string }> = [
  { type: 'hem',          label: '裾上げ',    icon: '✂️', color: 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100' },
  { type: 'sleeve',       label: '袖丈直し',  icon: '👔', color: 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100' },
  { type: 'waist',        label: 'ウエスト',  icon: '📏', color: 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100' },
  { type: 'embroidery',   label: '刺繍',      icon: '🔤', color: 'border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100' },
  { type: 'button',       label: 'ボタン',    icon: '🔘', color: 'border-gray-300 bg-gray-50 text-gray-600 hover:bg-gray-100' },
  { type: 'tear',         label: '修理・補修', icon: '🩹', color: 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100' },
  { type: 'badge',        label: '校章付け',  icon: '🏅', color: 'border-indigo-300 bg-indigo-50 text-indigo-700 hover:bg-indigo-100' },
  { type: 'size_exchange',label: 'サイズ交換', icon: '↕️', color: 'border-teal-300 bg-teal-50 text-teal-700 hover:bg-teal-100' },
  { type: 'other',        label: 'その他',    icon: '📝', color: 'border-slate-300 bg-slate-50 text-slate-600 hover:bg-slate-100' },
]

// ── インライン新規顧客登録 ────────────────────────────────────────
interface NewCustResult {
  id: string; name: string; tel: string | null; school_name: string | null
  children: { id: string; name: string; school_name: string | null }[]
}

function InlineNewCustomer({ storeId, onCreated, onCancel }: {
  storeId: string
  onCreated: (cust: NewCustResult) => void
  onCancel: () => void
}) {
  const [name,    setName]   = useState('')
  const [kana,    setKana]   = useState('')
  const [tel,     setTel]    = useState('')
  const [school,  setSchool] = useState('')
  const [loading, setLoading] = useState(false)
  const [err,     setErr]    = useState<string | null>(null)

  const save = async () => {
    if (!name.trim()) { setErr('お名前を入力してください'); return }
    setLoading(true)
    const { data, error } = await (supabase as any).from('customers').insert({
      store_id: storeId, name: name.trim(),
      kana: kana.trim() || null, tel: tel.trim() || null,
      school_name: school.trim() || null,
    }).select('id, name, tel, school_name').single()
    setLoading(false)
    if (error) { setErr('登録に失敗しました'); return }
    onCreated({ ...data, children: [] })
  }

  return (
    <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 space-y-3">
      <p className="text-xs font-black text-amber-800 flex items-center gap-1.5"><Plus size={13} />新規顧客登録</p>
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <label className="text-[10px] font-bold text-gray-600 block mb-1">お名前 <span className="text-red-500">*</span></label>
          <input value={name} onChange={e => { setName(e.target.value); setErr(null) }} placeholder="例：山田 太郎" autoFocus
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-600 block mb-1">ふりがな</label>
          <input value={kana} onChange={e => setKana(e.target.value)} placeholder="やまだ たろう"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-gray-600 block mb-1">電話番号</label>
          <input value={tel} onChange={e => setTel(e.target.value)} placeholder="090-xxxx-xxxx" type="tel"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] font-bold text-gray-600 block mb-1">学校名</label>
          <input value={school} onChange={e => setSchool(e.target.value)} placeholder="例：○○中学校"
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 bg-white" />
        </div>
      </div>
      {err && <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle size={12} />{err}</p>}
      <div className="flex gap-2">
        <button onClick={onCancel} className="flex-1 py-2.5 text-xs font-bold text-gray-600 border border-gray-300 rounded-xl hover:bg-gray-50 active:scale-[0.98]">
          キャンセル
        </button>
        <button onClick={save} disabled={loading}
          className="flex-1 py-2.5 text-xs font-bold text-white bg-amber-500 hover:bg-amber-400 rounded-xl disabled:opacity-50 flex items-center justify-center gap-1 active:scale-[0.98]">
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          登録する
        </button>
      </div>
    </div>
  )
}

interface CustResult {
  id: string; name: string; tel: string | null; school_name: string | null
  children?: { id: string; name: string; school_name: string | null }[]
}

function NewRepairModal({ storeId, onClose, onSave, onToast }: {
  storeId: string; onClose: () => void; onSave: () => void
  onToast: (t: 'ok' | 'err', m: string) => void
}) {
  type Step = 'type' | 'cat_repair' | 'details' | 'customer'
  const [step,           setStep]     = useState<Step>('type')
  const [repairType,     setRepairType] = useState<RepairType | null>(null)
  const [itemName,       setItemName]  = useState('')
  const [hemMm,          setHemMm]    = useState(0)
  const [sleeveMm,       setSleeveMm] = useState(0)
  const [waistMm,        setWaistMm]  = useState(0)
  const [embText,        setEmbText]  = useState('')
  const [embColor,       setEmbColor] = useState('黒')
  const [embPos,         setEmbPos]   = useState('胸ポケット右')
  const [content,        setContent]  = useState('')
  const [vendorName,     setVendor]   = useState('')
  const [expectedReturn, setExpReturn]= useState('')
  const [deadline,       setDeadline] = useState('')
  const [price,          setPrice]    = useState('')
  const [internalMemo,   setMemo]     = useState('')
  const [custSearch,     setCustSearch] = useState('')
  const [custResults,    setCustResults] = useState<CustResult[]>([])
  const [searching,      setSearching]  = useState(false)
  const [selectedCust,   setSelectedCust] = useState<CustResult | null>(null)
  const [selectedChild,  setSelectedChild] = useState<{ id: string; name: string; school_name: string | null } | null>(null)
  const [showRegister,   setShowRegister] = useState(false)
  const [saving,         setSaving] = useState(false)
  const [presets,        setPresets] = useState<{ id: string; item_name: string; default_price: number | null; category_id: string | null; repair_type: string | null }[]>([])
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [categories,     setCategories] = useState<{ id: string; name: string }[]>([])
  const [ocrLoading,     setOcrLoading] = useState(false)
  const [ocrWarnings,    setOcrWarnings] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleOcrRepair = async (file: File) => {
    setOcrLoading(true); setOcrWarnings([])
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/slip-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type, slipType: 'repair' }),
      })
      const { ok, data, error } = await res.json()
      if (!ok || !data) { onToast('err', `OCR失敗: ${error ?? '不明なエラー'}`); return }

      if (data.repair_type) setRepairType(data.repair_type as RepairType)
      if (data.item_name)   setItemName(data.item_name)
      if (data.price != null) setPrice(String(data.price))
      if (data.content)     setContent(data.content)
      if (data.hem_length_mm != null)  setHemMm(data.hem_length_mm)
      if (data.sleeve_adjust_mm != null) setSleeveMm(data.sleeve_adjust_mm)
      if (data.waist_adjust_mm != null)  setWaistMm(data.waist_adjust_mm)
      if (data.embroidery_text)  setEmbText(data.embroidery_text)
      if (data.embroidery_color) setEmbColor(data.embroidery_color)
      if (data.embroidery_pos)   setEmbPos(data.embroidery_pos)
      if (data.vendor_name)      setVendor(data.vendor_name)
      if (data.desired_completion_date) setDeadline(data.desired_completion_date)
      if (data.internal_memo)    setMemo(data.internal_memo)
      if (data.customer_name)    setCustSearch(data.customer_name)
      if (data.warnings?.length) setOcrWarnings(data.warnings)

      setStep('details')
      onToast('ok', `📷 伝票を読み取りました（精度: ${data.confidence === 'high' ? '高' : data.confidence === 'medium' ? '中' : '低'}）`)
    } catch (e) {
      onToast('err', `OCRエラー: ${String(e)}`)
    } finally {
      setOcrLoading(false)
    }
  }

  useEffect(() => {
    ;(supabase as any).from('repair_item_categories')
      .select('id, name').eq('store_id', storeId).eq('is_active', true).order('sort_order')
      .then(({ data }: { data: { id: string; name: string }[] | null }) => setCategories(data ?? []))
  }, [storeId])

  useEffect(() => {
    if (custSearch.length < 1) { setCustResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const { data } = await (supabase as any)
        .from('customers')
        .select('id, name, tel, school_name, children:children(id, name, school_name)')
        .eq('store_id', storeId).ilike('name', `%${custSearch}%`).is('deleted_at', null).limit(6)
      setCustResults(data ?? [])
      setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [custSearch, storeId])

  useEffect(() => {
    if (selectedCategoryId) {
      ;(supabase as any).from('repair_price_presets')
        .select('id, item_name, default_price, category_id, repair_type')
        .eq('store_id', storeId).eq('category_id', selectedCategoryId).eq('is_active', true)
        .order('sort_order').limit(50)
        .then(({ data }: { data: typeof presets }) => setPresets(data ?? []))
    } else if (repairType) {
      ;(supabase as any).from('repair_price_presets')
        .select('id, item_name, default_price, category_id, repair_type')
        .eq('store_id', storeId).eq('repair_type', repairType).eq('is_active', true)
        .order('sort_order').limit(20)
        .then(({ data }: { data: typeof presets }) => setPresets(data ?? []))
    } else {
      setPresets([])
    }
  }, [repairType, selectedCategoryId, storeId])

  function buildContent(): string {
    if (!repairType) return content
    switch (repairType) {
      case 'hem':        return hemMm !== 0 ? `裾上げ ${hemMm > 0 ? '+' : ''}${hemMm}mm` : content
      case 'sleeve':     return sleeveMm !== 0 ? `袖丈調整 ${sleeveMm > 0 ? '+' : ''}${sleeveMm}mm` : content
      case 'waist':      return waistMm !== 0 ? `ウエスト調整 ${waistMm > 0 ? '+' : ''}${waistMm}mm` : content
      case 'embroidery': return embText ? `刺繍「${embText}」${embColor} ${embPos}` : content
      default:           return content
    }
  }

  async function handleSave() {
    if (!selectedCust || !repairType) return
    setSaving(true)
    const payload: Record<string, unknown> = {
      store_id: storeId, customer_id: selectedCust.id,
      child_id: selectedChild?.id ?? null,
      item_name: itemName.trim() || REPAIR_TYPE_LABELS[repairType],
      content: buildContent(),
      request_type: 'repair', repair_type: repairType,
      status: 'received', received_date: new Date().toISOString().slice(0, 10),
      desired_completion_date: deadline || null,
      price: price ? Number(price) : null,
      prepaid: false, notified: false,
      internal_memo: internalMemo || null,
      work_started: false,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    if (repairType === 'hem')        { payload.hem_length_mm = hemMm }
    if (repairType === 'sleeve')     { payload.sleeve_adjust_mm = sleeveMm }
    if (repairType === 'waist')      { payload.waist_adjust_mm = waistMm }
    if (repairType === 'embroidery') {
      payload.embroidery_text  = embText
      payload.embroidery_color = embColor
      payload.embroidery_pos   = embPos
    }
    if (vendorName) {
      payload.vendor_name = vendorName
      if (expectedReturn) payload.expected_return_date = expectedReturn
    }
    const { error } = await (supabase as any).from('repair_histories').insert(payload)
    setSaving(false)
    if (error) { onToast('err', `保存失敗: ${error.message}`); return }
    onToast('ok', '✂️ お直しを受付しました')
    onSave(); onClose()
  }

  const MmInput = ({ label, value, setValue, color }: {
    label: string; value: number; setValue: (v: number) => void; color: string
  }) => (
    <div>
      <label className="text-xs font-bold text-gray-600 block mb-2">{label}</label>
      <div className="flex items-center gap-3 bg-gray-50 rounded-2xl p-4">
        <button onClick={() => setValue(value - 5)} className="w-11 h-11 rounded-xl bg-white border border-gray-200 font-black text-gray-700 text-xl flex items-center justify-center active:scale-95 transition-all shadow-sm">−</button>
        <div className="flex-1 text-center">
          <p className={`text-4xl font-black ${value > 0 ? color : value < 0 ? 'text-red-500' : 'text-gray-300'}`}>
            {value > 0 ? '+' : ''}{value}<span className="text-lg font-bold ml-1">mm</span>
          </p>
          <p className="text-[10px] text-gray-400 mt-1">{value > 0 ? '長くする' : value < 0 ? '短くする' : '変更なし'}</p>
        </div>
        <button onClick={() => setValue(value + 5)} className="w-11 h-11 rounded-xl bg-white border border-gray-200 font-black text-gray-700 text-xl flex items-center justify-center active:scale-95 transition-all shadow-sm">＋</button>
      </div>
      <div className="flex gap-1.5 mt-2 flex-wrap">
        {[-30, -20, -10, -5, 5, 10, 20, 30].map(v => (
          <button key={v} onClick={() => setValue(v)}
            className={`flex-1 min-w-[calc(12.5%-6px)] py-1.5 rounded-xl text-xs font-bold border-2 transition-all ${value === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
            {v > 0 ? '+' : ''}{v}
          </button>
        ))}
      </div>
    </div>
  )

  const stepLabels: Record<Step, string> = { type: 'カテゴリ選択', cat_repair: 'お直し選択', details: '内容入力', customer: '顧客選択' }
  const steps: Step[] = categories.length > 0 ? ['type', 'cat_repair', 'details', 'customer'] : ['type', 'details', 'customer']

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleOcrRepair(f); e.target.value = '' }} />
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => {
                if (step === 'type') onClose()
                else if (step === 'cat_repair') { setStep('type'); setPresets([]); setSelectedCategoryId(null) }
                else if (step === 'details') setStep(selectedCategoryId ? 'cat_repair' : 'type')
                else if (step === 'customer') setStep('details')
              }}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-95 transition-all">
              {step === 'type' ? <X size={18} /> : <ChevronLeft size={18} />}
            </button>
            <h2 className="flex-1 text-base font-black text-gray-900">
              {step === 'type' ? '✂️ お直し受付'
               : step === 'cat_repair' ? `📦 ${categories.find(c => c.id === selectedCategoryId)?.name ?? 'お直し選択'}`
               : step === 'details' && repairType ? `${REPAIR_TYPE_ICONS[repairType]} ${REPAIR_TYPE_LABELS[repairType]}`
               : '👤 顧客選択'}
            </h2>
            {/* OCR ボタン */}
            <button onClick={() => fileInputRef.current?.click()} disabled={ocrLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-60 shrink-0">
              {ocrLoading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              {ocrLoading ? '解析中...' : '伝票読取'}
            </button>
            <div className="flex items-center gap-1">
              {steps.map((s, i) => (
                <div key={s} className={`h-1.5 rounded-full transition-all ${step === s ? 'w-6 bg-indigo-600' : i < steps.indexOf(step) ? 'w-3 bg-indigo-300' : 'w-3 bg-gray-200'}`} />
              ))}
            </div>
          </div>
          <p className="text-xs text-gray-400 font-medium">{stepLabels[step]}</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* OCR 警告バナー */}
          {ocrWarnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 space-y-1">
              <p className="text-xs font-black text-amber-700 flex items-center gap-1.5"><ScanLine size={13} />読み取り確認が必要な箇所</p>
              {ocrWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 pl-4">・{w}</p>
              ))}
            </div>
          )}

          {/* ── Step 1: カテゴリ / 種別選択 ── */}
          {step === 'type' && (
            categories.length > 0 ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {(() => {
                    const palettes = [
                      { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-800', hover: 'hover:bg-amber-200', icon: 'text-amber-600' },
                      { bg: 'bg-blue-100', border: 'border-blue-300', text: 'text-blue-800', hover: 'hover:bg-blue-200', icon: 'text-blue-600' },
                      { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-800', hover: 'hover:bg-purple-200', icon: 'text-purple-600' },
                      { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-800', hover: 'hover:bg-emerald-200', icon: 'text-emerald-600' },
                      { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-800', hover: 'hover:bg-rose-200', icon: 'text-rose-600' },
                      { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-800', hover: 'hover:bg-indigo-200', icon: 'text-indigo-600' },
                    ]
                    return categories.map((cat, i) => {
                      const c = palettes[i % palettes.length]
                      return (
                        <button key={cat.id}
                          onClick={() => { setSelectedCategoryId(cat.id); setStep('cat_repair') }}
                          className={`flex flex-col items-center justify-center gap-2.5 py-8 rounded-2xl border-2 font-bold transition-all active:scale-95 ${c.bg} ${c.border} ${c.text} ${c.hover}`}>
                          <Tag size={30} className={c.icon} />
                          <span className="text-sm leading-tight text-center">{cat.name}</span>
                        </button>
                      )
                    })
                  })()}
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">カテゴリなし / その他</p>
                  <div className="grid grid-cols-3 gap-2">
                    {REPAIR_TYPES_DEF.map(t => (
                      <button key={t.type} onClick={() => { setRepairType(t.type); setSelectedCategoryId(null); setStep('details') }}
                        className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 font-bold transition-all active:scale-95 ${t.color}`}>
                        <span className="text-2xl">{t.icon}</span>
                        <span className="text-[11px] leading-tight text-center">{t.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5">
                {REPAIR_TYPES_DEF.map(t => (
                  <button key={t.type} onClick={() => { setRepairType(t.type); setStep('details') }}
                    className={`flex flex-col items-center gap-2 py-5 rounded-2xl border-2 font-bold transition-all active:scale-95 ${t.color}`}>
                    <span className="text-3xl">{t.icon}</span>
                    <span className="text-xs leading-tight text-center">{t.label}</span>
                  </button>
                ))}
              </div>
            )
          )}

          {/* ── Step 1b: カテゴリ内お直し選択 ── */}
          {step === 'cat_repair' && selectedCategoryId && (() => {
            const typeGroups = new Map<string, typeof presets>()
            for (const p of presets) {
              const rt = p.repair_type ?? 'other'
              if (!typeGroups.has(rt)) typeGroups.set(rt, [])
              typeGroups.get(rt)!.push(p)
            }
            const usedTypes = new Set(typeGroups.keys())
            const otherTypes = REPAIR_TYPES_DEF.filter(t => !usedTypes.has(t.type))
            return (
              <div className="space-y-3">
                {presets.length === 0 && (
                  <div className="text-center py-6">
                    <p className="text-sm text-gray-400">このカテゴリのプリセットが未登録です</p>
                    <p className="text-xs text-gray-300 mt-1">マスタページで料金プリセットを登録してください</p>
                  </div>
                )}
                {REPAIR_TYPES_DEF.filter(t => usedTypes.has(t.type)).map(typeDef => (
                  <div key={typeDef.type} className="rounded-2xl border border-gray-200 overflow-hidden bg-white shadow-sm">
                    <button
                      onClick={() => { setRepairType(typeDef.type as RepairType); setStep('details') }}
                      className="w-full flex items-center gap-2.5 px-4 py-3.5 bg-gray-50 hover:bg-gray-100 transition-all text-left font-black text-sm text-gray-800 border-b border-gray-100">
                      <span className="text-lg">{typeDef.icon}</span>
                      <span className="flex-1">{typeDef.label}</span>
                      <span className="text-[10px] text-gray-400 font-normal">詳細入力</span>
                      <ChevronDown size={14} className="text-gray-400" />
                    </button>
                    <div className="px-4 pb-3 pt-2.5 flex flex-wrap gap-2">
                      {typeGroups.get(typeDef.type)!.map(p => (
                        <button key={p.id}
                          onClick={() => {
                            setRepairType(typeDef.type as RepairType)
                            setItemName(p.item_name)
                            if (p.default_price != null) setPrice(String(p.default_price))
                            setStep('details')
                          }}
                          className="flex items-center gap-1.5 px-3.5 py-2.5 bg-white hover:bg-indigo-50 border-2 border-gray-200 hover:border-indigo-300 rounded-xl text-sm font-bold text-gray-700 active:scale-95 transition-all shadow-sm">
                          <span>{p.item_name}</span>
                          {p.default_price != null && <span className="text-indigo-600 font-black">¥{p.default_price.toLocaleString()}</span>}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                {otherTypes.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">その他のお直し</p>
                    <div className="grid grid-cols-3 gap-2">
                      {otherTypes.map(t => (
                        <button key={t.type}
                          onClick={() => { setRepairType(t.type as RepairType); setStep('details') }}
                          className={`flex flex-col items-center gap-1.5 py-3 rounded-2xl border-2 font-bold text-xs transition-all active:scale-95 ${t.color}`}>
                          <span className="text-2xl">{t.icon}</span>
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {/* ── Step 2: 内容入力 ── */}
          {step === 'details' && repairType && (
            <>
              {/* プリセット選択 - カテゴリ経由でない場合のみ表示 */}
              {presets.length > 0 && !selectedCategoryId && (() => {
                const catGroups = new Map<string | null, typeof presets>()
                for (const p of presets) {
                  const key = p.category_id ?? null
                  if (!catGroups.has(key)) catGroups.set(key, [])
                  catGroups.get(key)!.push(p)
                }
                return (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-gray-500 block uppercase tracking-wider">よく使うお直し（タップで自動入力）</label>
                    {Array.from(catGroups.entries()).map(([catId, ps]) => {
                      const catName = catId ? (categories.find(c => c.id === catId)?.name ?? '') : null
                      return (
                        <div key={catId ?? '_none'}>
                          {catName && <p className="text-[10px] font-bold text-gray-400 mb-1">{catName}</p>}
                          <div className="flex flex-wrap gap-1.5">
                            {ps.map(p => (
                              <button key={p.id} type="button"
                                onClick={() => {
                                  setItemName(p.item_name)
                                  if (p.default_price) setPrice(String(p.default_price))
                                }}
                                className="px-3 py-1.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-full hover:bg-indigo-100 active:scale-95 transition-all">
                                {p.item_name}{p.default_price ? ` ¥${p.default_price.toLocaleString()}` : ''}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">品名・商品名</label>
                <input type="text" value={itemName} onChange={e => setItemName(e.target.value)}
                  placeholder="例: スラックス 165A / ブレザー"
                  className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:border-indigo-500 focus:outline-none" />
              </div>

              {repairType === 'hem'    && <MmInput label="裾上げ量" value={hemMm}    setValue={setHemMm}    color="text-amber-600" />}
              {repairType === 'sleeve' && <MmInput label="袖丈調整量" value={sleeveMm} setValue={setSleeveMm} color="text-blue-600" />}
              {repairType === 'waist'  && <MmInput label="ウエスト調整量" value={waistMm}  setValue={setWaistMm}  color="text-purple-600" />}

              {repairType === 'embroidery' && (
                <>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1.5">刺繍文字</label>
                    <input type="text" value={embText} onChange={e => setEmbText(e.target.value)}
                      placeholder="例: 田中　花子（スペース区切り推奨）"
                      className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:border-indigo-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-2">糸色</label>
                    <div className="flex gap-2">
                      {['黒', '白', '紺', '指定'].map(c => (
                        <button key={c} onClick={() => setEmbColor(c)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${embColor === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-2">刺繍位置</label>
                    <div className="flex flex-wrap gap-2">
                      {['胸ポケット右', '胸ポケット左', '袖右', '袖左', '背中', 'その他'].map(p => (
                        <button key={p} onClick={() => setEmbPos(p)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${embPos === p ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {!['hem', 'sleeve', 'waist', 'embroidery'].includes(repairType) && (
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1.5">お直し内容</label>
                  <input type="text" value={content} onChange={e => setContent(e.target.value)}
                    placeholder="例: 右ひざほつれ修理 / ボタン付け直し"
                    className="w-full border border-gray-300 rounded-xl px-3 py-3 text-sm focus:border-indigo-500 focus:outline-none" />
                </div>
              )}

              {/* 加工先 */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-2">加工先</label>
                <div className="flex gap-2 mb-2">
                  {(['内製', '外注'] as const).map(v => (
                    <button key={v} onClick={() => setVendor(v === '内製' ? '' : '外注先')}
                      className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                        (v === '内製' && !vendorName) || (v === '外注' && !!vendorName)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                      }`}>
                      {v === '内製' ? '🏪 内製' : '🏭 外注'}
                    </button>
                  ))}
                </div>
                {vendorName && (
                  <div className="space-y-2">
                    <input type="text" value={vendorName === '外注先' ? '' : vendorName} onChange={e => setVendor(e.target.value)}
                      placeholder="外注先名（例: カネコ刺繍）"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1">戻り予定日</label>
                      <input type="date" value={expectedReturn} onChange={e => setExpReturn(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                    </div>
                  </div>
                )}
              </div>

              {/* 希望完了日・金額 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1.5">希望完了日</label>
                  <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1.5">金額（税込）</label>
                  <input type="number" value={price} onChange={e => setPrice(e.target.value)}
                    placeholder="800"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                </div>
              </div>

              {/* スタッフメモ */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">スタッフメモ（お客様非公開）</label>
                <input type="text" value={internalMemo} onChange={e => setMemo(e.target.value)}
                  placeholder="内部用メモ・注意事項"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
              </div>

              <button onClick={() => setStep('customer')}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-indigo-500/25">
                次へ：お客様を選択する
              </button>
            </>
          )}

          {/* ── Step 3: 顧客選択 ── */}
          {step === 'customer' && (
            <>
              {!selectedCust ? (
                <>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={custSearch} onChange={e => setCustSearch(e.target.value)}
                      placeholder="顧客名で検索"
                      autoFocus
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:border-indigo-500 focus:outline-none" />
                  </div>
                  {searching && <div className="text-center py-4"><Loader2 size={20} className="animate-spin text-indigo-400 mx-auto" /></div>}
                  <div className="space-y-2">
                    {custResults.map(c => (
                      <button key={c.id} onClick={() => { setSelectedCust(c); setShowRegister(false) }}
                        className="w-full text-left px-4 py-3.5 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-2xl transition-all active:scale-[0.98]">
                        <p className="font-black text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{[c.school_name, c.tel].filter(Boolean).join(' · ')}</p>
                        {c.children && c.children.length > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">お子様: {c.children.map(ch => ch.name).join('、')}</p>
                        )}
                      </button>
                    ))}
                  </div>
                  {/* 新規顧客登録（常時表示） */}
                  {!showRegister && (
                    <button onClick={() => setShowRegister(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-amber-300 text-amber-600 text-xs font-bold rounded-xl hover:bg-amber-50 active:scale-[0.98] transition-all">
                      <Plus size={13} />新規顧客を登録する
                    </button>
                  )}
                  {showRegister && (
                    <InlineNewCustomer
                      storeId={storeId}
                      onCreated={cust => { setSelectedCust(cust as CustResult); setShowRegister(false) }}
                      onCancel={() => setShowRegister(false)}
                    />
                  )}
                  {custSearch.length === 0 && !showRegister && (
                    <p className="text-sm text-center text-gray-400 py-4">名前を入力して顧客を検索してください</p>
                  )}
                </>
              ) : (
                <>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                      <User size={18} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900">{selectedCust.name}</p>
                      {selectedCust.tel && <p className="text-xs text-gray-500">{selectedCust.tel}</p>}
                      {selectedCust.school_name && <p className="text-xs text-gray-400">{selectedCust.school_name}</p>}
                    </div>
                    <button onClick={() => { setSelectedCust(null); setSelectedChild(null); setCustSearch('') }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all">
                      <X size={15} />
                    </button>
                  </div>

                  {selectedCust.children && selectedCust.children.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-2">お子様（任意）</label>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSelectedChild(null)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${!selectedChild ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                          選択しない
                        </button>
                        {selectedCust.children.map(ch => (
                          <button key={ch.id} onClick={() => setSelectedChild(ch)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${selectedChild?.id === ch.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                            {ch.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 確認サマリー */}
                  {repairType && (
                    <div className="bg-gray-50 rounded-2xl p-4 space-y-1.5">
                      <p className="text-xs font-black text-gray-700 mb-2">受付内容の確認</p>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${REPAIR_TYPE_COLORS[repairType]}`}>
                          {REPAIR_TYPE_ICONS[repairType]} {REPAIR_TYPE_LABELS[repairType]}
                        </span>
                      </div>
                      {itemName && <p className="text-xs text-gray-600">品名: {itemName}</p>}
                      {repairType === 'hem' && hemMm !== 0 && <p className="text-xs font-bold text-amber-700">裾上げ {hemMm > 0 ? '+' : ''}{hemMm}mm</p>}
                      {repairType === 'sleeve' && sleeveMm !== 0 && <p className="text-xs font-bold text-blue-700">袖丈 {sleeveMm > 0 ? '+' : ''}{sleeveMm}mm</p>}
                      {repairType === 'waist' && waistMm !== 0 && <p className="text-xs font-bold text-purple-700">ウエスト {waistMm > 0 ? '+' : ''}{waistMm}mm</p>}
                      {repairType === 'embroidery' && embText && <p className="text-xs font-bold text-pink-700">「{embText}」{embColor} {embPos}</p>}
                      {content && <p className="text-xs text-gray-600">{content}</p>}
                      {vendorName && <p className="text-xs text-gray-600">加工先: {vendorName}</p>}
                      {deadline && <p className="text-xs text-gray-600">希望完了: {deadline}</p>}
                      {price && <p className="text-xs font-bold text-gray-700">¥{Number(price).toLocaleString()}</p>}
                    </div>
                  )}

                  <button onClick={handleSave} disabled={saving}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/25">
                    {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                    お直しを受付する
                  </button>
                </>
              )}
            </>
          )}
        </div>
        <div className="h-6 shrink-0" />
      </div>
    </div>
  )
}

// ── 制服注文モーダル ─────────────────────────────────────────────
interface CartItem {
  variantId: string | null
  productId: string | null
  productName: string
  category: string | null
  sizeLabel: string
  unitPrice: number
  qty: number
}

function NewOrderModal({ storeId, onClose, onSave, onToast }: {
  storeId: string; onClose: () => void; onSave: () => void
  onToast: (t: 'ok' | 'err', m: string) => void
}) {
  type OStep = 'products' | 'customer' | 'confirm'
  const [step,       setStep]       = useState<OStep>('products')
  const [schools,    setSchools]    = useState<{ id: string; name: string }[]>([])
  const [schoolId,   setSchoolId]   = useState<string | null>(null)
  const [products,   setProducts]   = useState<{ id: string; item_name: string; category: string | null; gender: string | null; maker_code: string | null }[]>([])
  const [variants,   setVariants]   = useState<Record<string, { id: string; size_label: string; price: number }[]>>({})
  const [expanded,   setExpanded]   = useState<string | null>(null)
  const [cart,       setCart]       = useState<CartItem[]>([])
  const [loadingVar, setLoadingVar] = useState<string | null>(null)

  const [custSearch,    setCustSearch]    = useState('')
  const [custResults,   setCustResults]   = useState<CustResult[]>([])
  const [searching,     setSearching]     = useState(false)
  const [selectedCust,  setSelectedCust]  = useState<CustResult | null>(null)
  const [selectedChild, setSelectedChild] = useState<{ id: string; name: string; school_name: string | null } | null>(null)
  const [showReg,       setShowReg]       = useState(false)

  const [notes,        setNotes]        = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [prepaid,      setPrepaid]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [ocrLoading,   setOcrLoading]   = useState(false)
  const [ocrWarnings,  setOcrWarnings]  = useState<string[]>([])
  const orderFileRef = useRef<HTMLInputElement>(null)

  const handleOcrOrder = async (file: File) => {
    setOcrLoading(true); setOcrWarnings([])
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const res = await fetch('/api/slip-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type, slipType: 'order' }),
      })
      const { ok, data, error } = await res.json()
      if (!ok || !data) { onToast('err', `OCR失敗: ${error ?? '不明なエラー'}`); return }

      if (data.customer_name) setCustSearch(data.customer_name)
      if (data.notes) setNotes(data.notes)
      if (data.warnings?.length) setOcrWarnings(data.warnings)
      if (data.items?.length) {
        const itemText = (data.items as { item_name: string; size_label?: string; quantity?: number }[])
          .map(i => `${i.item_name}${i.size_label ? ` ${i.size_label}` : ''}${(i.quantity ?? 1) > 1 ? ` ×${i.quantity}` : ''}`)
          .join('、')
        setNotes(prev => [prev, itemText].filter(Boolean).join(' / '))
      }
      setStep('customer')
      onToast('ok', `📷 注文伝票を読み取りました（精度: ${data.confidence === 'high' ? '高' : data.confidence === 'medium' ? '中' : '低'}）`)
    } catch (e) {
      onToast('err', `OCRエラー: ${String(e)}`)
    } finally {
      setOcrLoading(false)
    }
  }

  useEffect(() => {
    ;(supabase as any).from('schools').select('id, name').eq('store_id', storeId).eq('active', true).order('sort_order')
      .then(({ data }: { data: typeof schools }) => {
        const rows = data ?? []
        setSchools(rows)
        if (rows.length > 0) setSchoolId(rows[0].id)
      })
  }, [storeId])

  useEffect(() => {
    if (!schoolId) return
    setProducts([]); setExpanded(null)
    ;(supabase as any).from('school_products').select('id, item_name, category, gender, maker_code')
      .eq('store_id', storeId).eq('school_id', schoolId).eq('active', true).order('sort_order')
      .then(({ data }: { data: typeof products }) => setProducts(data ?? []))
  }, [storeId, schoolId])

  const loadVariants = async (productId: string) => {
    if (variants[productId]) { setExpanded(expanded === productId ? null : productId); return }
    setLoadingVar(productId)
    const { data } = await (supabase as any).from('school_product_variants')
      .select('id, size_label, price').eq('product_id', productId).eq('active', true).order('sort_order')
    setVariants(prev => ({ ...prev, [productId]: data ?? [] }))
    setExpanded(productId)
    setLoadingVar(null)
  }

  const addToCart = (p: typeof products[0], v: { id: string; size_label: string; price: number }) => {
    setCart(prev => {
      const existing = prev.findIndex(i => i.variantId === v.id)
      if (existing >= 0) return prev.map((i, idx) => idx === existing ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { variantId: v.id, productId: p.id, productName: p.item_name, category: p.category, sizeLabel: v.size_label, unitPrice: v.price, qty: 1 }]
    })
  }

  const removeFromCart = (variantId: string | null, idx: number) =>
    setCart(prev => prev.filter((_, i) => i !== idx))

  const cartTotal = cart.reduce((s, i) => s + i.unitPrice * i.qty, 0)

  useEffect(() => {
    if (custSearch.length < 1) { setCustResults([]); return }
    const t = setTimeout(async () => {
      setSearching(true)
      const { data } = await (supabase as any).from('customers')
        .select('id, name, tel, school_name, children:children(id, name, school_name)')
        .eq('store_id', storeId).ilike('name', `%${custSearch}%`).is('deleted_at', null).limit(6)
      setCustResults(data ?? []); setSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [custSearch, storeId])

  const handleSave = async () => {
    if (!selectedCust) return
    setSaving(true)
    const today = new Date().toISOString().slice(0, 10)
    const orderId = crypto.randomUUID()
    const { error: oErr } = await (supabase as any).from('uniform_orders').insert({
      id: orderId, store_id: storeId,
      customer_id: selectedCust.id, child_id: selectedChild?.id ?? null,
      status: 'confirmed', payment_status: prepaid ? 'paid' : 'unpaid',
      total_amount: cartTotal, notes: notes.trim() || null,
      expected_delivery_date: expectedDate || null,
    })
    if (oErr) { setSaving(false); onToast('err', '注文登録に失敗しました'); return }
    const items = cart.map(item => ({
      order_id: orderId, store_id: storeId,
      school_product_id: item.productId ?? null,
      item_name: `${item.productName}${item.sizeLabel ? ` ${item.sizeLabel}` : ''}`,
      size_label: item.sizeLabel, quantity: item.qty,
      unit_price: item.unitPrice, status: 'ordered',
    }))
    const { error: iErr } = await (supabase as any).from('uniform_order_items').insert(items)
    setSaving(false)
    if (iErr) { onToast('err', '明細登録に失敗しました'); return }
    onToast('ok', `${cart.length}点の注文を登録しました`)
    onSave()
  }

  const stepLabels: Record<OStep, string> = { products: '商品選択', customer: '顧客選択', confirm: '確認・登録' }
  const steps: OStep[] = ['products', 'customer', 'confirm']

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex flex-col justify-end sm:justify-center sm:items-center sm:p-4">
      <div className="bg-white sm:rounded-3xl sm:max-w-lg w-full sm:max-h-[90vh] max-h-[92vh] flex flex-col rounded-t-3xl overflow-hidden">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
          <input ref={orderFileRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleOcrOrder(f); e.target.value = '' }} />
          <div className="flex items-center gap-3 mb-3">
            <button onClick={step === 'products' ? onClose : () => setStep(step === 'confirm' ? 'customer' : 'products')}
              className="p-2 -ml-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all">
              {step === 'products' ? <X size={18} /> : <ChevronLeft size={18} />}
            </button>
            <div className="flex-1">
              <p className="font-black text-gray-900 text-sm">📋 制服・用品注文</p>
              <p className="text-xs text-gray-400 font-medium">{stepLabels[step]}</p>
            </div>
            <button onClick={() => orderFileRef.current?.click()} disabled={ocrLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-60 shrink-0">
              {ocrLoading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
              {ocrLoading ? '解析中...' : '伝票読取'}
            </button>
            {cart.length > 0 && step === 'products' && (
              <button onClick={() => setStep('customer')}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-bold rounded-xl">
                <ShoppingCart size={13} />{cart.length}点 次へ
              </button>
            )}
          </div>
          <div className="flex gap-1">
            {steps.map((s, i) => (
              <div key={s} className={`h-1.5 rounded-full transition-all ${step === s ? 'flex-1 bg-indigo-600' : i < steps.indexOf(step) ? 'w-6 bg-indigo-300' : 'w-4 bg-gray-200'}`} />
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* OCR 警告バナー（注文モーダル） */}
          {ocrWarnings.length > 0 && (
            <div className="mx-4 mt-3 bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 space-y-1">
              <p className="text-xs font-black text-amber-700 flex items-center gap-1.5"><ScanLine size={13} />確認が必要な箇所</p>
              {ocrWarnings.map((w, i) => <p key={i} className="text-xs text-amber-600 pl-4">・{w}</p>)}
            </div>
          )}

          {/* ── Step 1: 商品選択 ── */}
          {step === 'products' && (
            <div className="flex flex-col h-full">
              {/* 学校タブ */}
              <div className="flex gap-1 px-3 py-2 overflow-x-auto shrink-0 border-b border-gray-100">
                {schools.map(s => (
                  <button key={s.id} onClick={() => setSchoolId(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                      schoolId === s.id ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}>
                    {s.name}
                  </button>
                ))}
              </div>
              {/* 商品リスト */}
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                {products.length === 0 && (
                  <p className="text-sm text-center text-gray-400 py-8">この学校の商品がありません<br /><span className="text-xs">マスタページで商品を登録してください</span></p>
                )}
                {products.map(p => (
                  <div key={p.id} className="border border-gray-200 rounded-2xl overflow-hidden">
                    <button onClick={() => loadVariants(p.id)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-all text-left">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{p.item_name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          {p.category && <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-medium">{p.category}</span>}
                          {p.gender   && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium">{p.gender}</span>}
                          {p.maker_code && <span className="text-[10px] text-gray-400 font-mono">{p.maker_code}</span>}
                        </div>
                      </div>
                      {loadingVar === p.id
                        ? <Loader2 size={16} className="animate-spin text-gray-400 shrink-0" />
                        : <ChevronDown size={16} className={`text-gray-400 shrink-0 transition-transform ${expanded === p.id ? 'rotate-180' : ''}`} />
                      }
                    </button>
                    {expanded === p.id && variants[p.id] && (
                      <div className="border-t border-gray-100 px-4 py-2 grid grid-cols-2 gap-1.5 bg-gray-50">
                        {variants[p.id].length === 0 && (
                          <p className="col-span-2 text-xs text-gray-400 py-2 text-center">サイズ未登録</p>
                        )}
                        {variants[p.id].map(v => {
                          const inCart = cart.find(c => c.variantId === v.id)
                          return (
                            <button key={v.id} onClick={() => addToCart(p, v)}
                              className={`flex items-center justify-between px-3 py-2 rounded-xl border-2 text-sm font-bold transition-all active:scale-95 ${
                                inCart ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-800 hover:border-indigo-300'
                              }`}>
                              <span>{v.size_label}</span>
                              <span className={`text-xs ${inCart ? 'text-indigo-200' : 'text-gray-500'}`}>
                                {inCart ? `×${inCart.qty}` : `¥${v.price.toLocaleString()}`}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* カートフッター */}
              {cart.length > 0 && (
                <div className="shrink-0 border-t border-gray-200 px-4 py-3 bg-white">
                  <div className="flex items-center gap-2 mb-2 overflow-x-auto pb-1">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-1 bg-indigo-50 border border-indigo-200 rounded-full px-2.5 py-1 text-xs font-bold text-indigo-700 whitespace-nowrap shrink-0">
                        {item.productName} {item.sizeLabel} ×{item.qty}
                        <button onClick={() => removeFromCart(item.variantId, idx)} className="ml-0.5 text-indigo-400 hover:text-indigo-700"><X size={11} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-xs text-gray-500">{cart.length}点 合計</p>
                      <p className="font-black text-lg text-gray-900">¥{cartTotal.toLocaleString()}</p>
                    </div>
                    <button onClick={() => setStep('customer')}
                      className="px-5 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-2xl active:scale-95 transition-all">
                      次へ →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: 顧客選択 ── */}
          {step === 'customer' && (
            <div className="p-4 space-y-3">
              {!selectedCust ? (
                <>
                  <div className="relative">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={custSearch} onChange={e => setCustSearch(e.target.value)}
                      placeholder="顧客名で検索" autoFocus
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:border-indigo-500 focus:outline-none" />
                  </div>
                  {searching && <div className="text-center py-4"><Loader2 size={20} className="animate-spin text-indigo-400 mx-auto" /></div>}
                  <div className="space-y-2">
                    {custResults.map(c => (
                      <button key={c.id} onClick={() => { setSelectedCust(c); setShowReg(false) }}
                        className="w-full text-left px-4 py-3.5 bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-2xl transition-all active:scale-[0.98]">
                        <p className="font-black text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{[c.school_name, c.tel].filter(Boolean).join(' · ')}</p>
                        {c.children && c.children.length > 0 && (
                          <p className="text-[10px] text-gray-400 mt-0.5">お子様: {c.children.map(ch => ch.name).join('、')}</p>
                        )}
                      </button>
                    ))}
                  </div>
                  {/* 新規顧客登録（常時表示） */}
                  {!showReg && (
                    <button onClick={() => setShowReg(true)}
                      className="w-full flex items-center justify-center gap-1.5 py-2.5 border-2 border-dashed border-amber-300 text-amber-600 text-xs font-bold rounded-xl hover:bg-amber-50 active:scale-[0.98] transition-all">
                      <Plus size={13} />新規顧客を登録する
                    </button>
                  )}
                  {showReg && (
                    <InlineNewCustomer
                      storeId={storeId}
                      onCreated={cust => { setSelectedCust(cust as CustResult); setShowReg(false) }}
                      onCancel={() => setShowReg(false)}
                    />
                  )}
                  {custSearch.length === 0 && !showReg && (
                    <p className="text-sm text-center text-gray-400 py-4">名前を入力して顧客を検索してください</p>
                  )}
                </>
              ) : (
                <>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3.5 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                      <User size={18} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900">{selectedCust.name}</p>
                      {selectedCust.tel && <p className="text-xs text-gray-500">{selectedCust.tel}</p>}
                      {selectedCust.school_name && <p className="text-xs text-gray-400">{selectedCust.school_name}</p>}
                    </div>
                    <button onClick={() => { setSelectedCust(null); setSelectedChild(null); setCustSearch('') }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-white rounded-xl transition-all">
                      <X size={15} />
                    </button>
                  </div>
                  {selectedCust.children && selectedCust.children.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-2">お子様（任意）</label>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => setSelectedChild(null)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${!selectedChild ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                          選択しない
                        </button>
                        {selectedCust.children.map(ch => (
                          <button key={ch.id} onClick={() => setSelectedChild(ch)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-all ${selectedChild?.id === ch.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                            {ch.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <button onClick={() => setStep('confirm')}
                    className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98]">
                    <Check size={18} />次へ：注文内容を確認する
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Step 3: 確認 ── */}
          {step === 'confirm' && (
            <div className="p-4 space-y-4">
              {/* カートサマリー */}
              <div className="bg-gray-50 rounded-2xl overflow-hidden">
                <div className="px-4 py-2.5 border-b border-gray-200">
                  <p className="text-xs font-black text-gray-700">注文内容</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{item.productName}</p>
                        <p className="text-xs text-gray-500">{item.sizeLabel} × {item.qty}</p>
                      </div>
                      <p className="font-black text-gray-900 text-sm shrink-0">¥{(item.unitPrice * item.qty).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 bg-indigo-50 flex justify-between">
                  <p className="text-sm font-bold text-indigo-700">合計</p>
                  <p className="text-lg font-black text-indigo-700">¥{cartTotal.toLocaleString()}</p>
                </div>
              </div>

              {/* 顧客表示 */}
              <div className="bg-gray-50 rounded-2xl px-4 py-3 flex items-center gap-2">
                <User size={14} className="text-gray-400" />
                <div>
                  <p className="text-sm font-bold text-gray-900">{selectedCust?.name}</p>
                  {selectedChild && <p className="text-xs text-gray-500">お子様: {selectedChild.name}</p>}
                </div>
              </div>

              {/* 希望お渡し日 */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">希望お渡し日</label>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {[{ label: '1週間後', days: 7 }, { label: '2週間後', days: 14 }, { label: '1ヶ月後', days: 30 }].map(({ label, days }) => {
                    const d = new Date(); d.setDate(d.getDate() + days)
                    const val = d.toISOString().slice(0, 10)
                    return (
                      <button key={days} type="button" onClick={() => setExpectedDate(val)}
                        className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition-all ${expectedDate === val ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-600'}`}>
                        {label}
                      </button>
                    )
                  })}
                </div>
                <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
              </div>

              {/* メモ */}
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1.5">備考・メモ</label>
                <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                  placeholder="申し送り事項など"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
              </div>

              {/* 支払い */}
              <button type="button" onClick={() => setPrepaid(v => !v)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${prepaid ? 'border-emerald-500 bg-emerald-500/10' : 'border-red-400 bg-red-50'}`}>
                <div className="text-left">
                  <p className={`font-bold text-sm ${prepaid ? 'text-emerald-700' : 'text-red-700'}`}>
                    {prepaid ? '✅ 支払済み' : '⚠️ 未払い'}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">受注時に頂いた場合は「支払済み」に</p>
                </div>
                <div className={`w-12 h-6 rounded-full transition-colors shrink-0 ${prepaid ? 'bg-emerald-500' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow-lg transition-transform ${prepaid ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </div>
              </button>

              <button onClick={handleSave} disabled={saving || cart.length === 0}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 shadow-lg shadow-indigo-500/25">
                {saving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                注文を登録する（{cart.length}点 ¥{cartTotal.toLocaleString()}）
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Repair Card (お直し・依頼カード) ──────────────────────────
function RepairCard({ item, storeId, onRefresh, onToast, onEdit }: {
  item: RepairRow; storeId: string; onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: RepairRow) => void
}) {
  const [open,          setOpen]          = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [confirmPay,    setConfirmPay]    = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  const reqType = (item.request_type ?? 'repair') as RequestType
  const name    = item.child?.name ?? item.customer?.name ?? '（顧客不明）'

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const deadlineDate = item.desired_completion_date ? new Date(item.desired_completion_date) : null
  if (deadlineDate) deadlineDate.setHours(0, 0, 0, 0)
  const daysLeft   = deadlineDate ? Math.floor((deadlineDate.getTime() - today.getTime()) / 86400000) : null
  const isOverdue  = daysLeft !== null && daysLeft < 0
  const isDueSoon  = daysLeft !== null && daysLeft >= 0 && daysLeft <= 1

  async function update(patch: Record<string, unknown>, msg: string, undoPatch?: Record<string, unknown>) {
    setLoading(true)
    const { error } = await (supabase as any)
      .from('repair_histories')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onRefresh()
    onToast('ok', msg, undoPatch ? async () => {
      await (supabase as any).from('repair_histories')
        .update({ ...undoPatch, updated_at: new Date().toISOString() }).eq('id', item.id)
      onRefresh()
    } : undefined)
  }

  // Primary action config
  let primaryBtn: { label: string; color: string; onClick: () => void } | null = null
  if (reqType === 'repair') {
    if (!item.work_started) {
      primaryBtn = {
        label: '✂️ 作業開始',
        color: 'bg-amber-500 hover:bg-amber-400 shadow-amber-200',
        onClick: () => update({ work_started: true }, '作業開始しました', { work_started: false }),
      }
    } else {
      primaryBtn = {
        label: '✅ お直し完了',
        color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
        onClick: () => update(
          { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
          'お直し完了・連絡しました',
          { status: 'received', completed_date: null, notified: false }
        ),
      }
    }
  } else if (reqType === 'walk_in') {
    primaryBtn = {
      label: '✅ 対応完了・連絡する',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
        '対応完了にしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  } else if (reqType === 'hold_request') {
    primaryBtn = {
      label: '✅ 確保済み・連絡する',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
        '確保済みにしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  } else if (reqType === 'inquiry') {
    primaryBtn = {
      label: '✅ 問合せ対応完了',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
        '問合せ対応完了にしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  } else if (reqType === 'repair_consult') {
    primaryBtn = {
      label: '✅ 相談完了',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
        '相談完了にしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  } else if (reqType === 'payment_pending') {
    primaryBtn = {
      label: '✅ 入金確認・回収完了',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'completed', completed_date: new Date().toISOString().slice(0, 10), notified: true },
        '入金確認・回収完了にしました',
        { status: 'received', completed_date: null, notified: false }
      ),
    }
  }

  const cardBg =
    isOverdue  ? 'bg-red-50 border-red-400 border-2' :
    isDueSoon  ? 'bg-amber-50 border-amber-400 border-2' :
    item.work_started ? 'bg-amber-50/40 border-amber-300' :
    'bg-white border-slate-200'

  return (
    <div className={`border rounded-2xl overflow-hidden shadow-sm ${cardBg}`}>
      {/* Clickable summary area */}
      <button className="w-full text-left px-4 pt-4 pb-3 flex gap-3" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          {/* Badges */}
          <div className="flex items-center gap-1.5 flex-wrap mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${REQUEST_TYPE_COLORS[reqType]}`}>
              {REQUEST_TYPE_LABELS[reqType]}
            </span>
            {item.repair_type && (
              <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${REPAIR_TYPE_COLORS[item.repair_type]}`}>
                {REPAIR_TYPE_ICONS[item.repair_type]} {REPAIR_TYPE_LABELS[item.repair_type]}
              </span>
            )}
            {item.vendor_name && !item.sent_to_vendor_at && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-300 font-bold">
                📤 {item.vendor_name}
              </span>
            )}
            {item.sent_to_vendor_at && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 border border-orange-300 font-bold">
                🏭 外注中
              </span>
            )}
            {item.is_rework && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 font-bold">
                🔄 再加工
              </span>
            )}
            {item.work_started && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-bold">✂️ 作業中</span>
            )}
            {isOverdue && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white font-black animate-pulse">
                🚨 期限超過 {Math.abs(daysLeft!)}日
              </span>
            )}
            {isDueSoon && !isOverdue && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-black">⚠️ 期限間近</span>
            )}
            {!item.prepaid && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white font-black animate-pulse">未払い</span>
            )}
          </div>

          {/* Hero: お直し内容 */}
          {item.content ? (
            <p className="text-xl font-black text-slate-900 leading-snug mb-1">{item.content}</p>
          ) : (
            <p className="text-base font-black text-slate-400 leading-snug mb-1 italic">（内容未記入）</p>
          )}

          {/* 構造化加工データ */}
          {item.repair_type === 'hem' && item.hem_length_mm !== null && item.hem_length_mm !== 0 && (
            <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-1.5 mb-1.5">
              <span className="text-base font-black text-amber-700">
                {item.hem_length_mm > 0 ? '+' : ''}{item.hem_length_mm}mm
              </span>
              <span className="text-[10px] text-amber-500">{item.hem_length_mm > 0 ? '長くする' : '短くする'}</span>
            </div>
          )}
          {item.repair_type === 'sleeve' && item.sleeve_adjust_mm !== null && item.sleeve_adjust_mm !== 0 && (
            <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 mb-1.5">
              <span className="text-base font-black text-blue-700">
                袖丈 {item.sleeve_adjust_mm > 0 ? '+' : ''}{item.sleeve_adjust_mm}mm
              </span>
            </div>
          )}
          {item.repair_type === 'waist' && item.waist_adjust_mm !== null && item.waist_adjust_mm !== 0 && (
            <div className="inline-flex items-center gap-1.5 bg-purple-50 border border-purple-200 rounded-xl px-3 py-1.5 mb-1.5">
              <span className="text-base font-black text-purple-700">
                ウエスト {item.waist_adjust_mm > 0 ? '+' : ''}{item.waist_adjust_mm}mm
              </span>
            </div>
          )}
          {item.repair_type === 'embroidery' && item.embroidery_text && (
            <div className="bg-pink-50 border border-pink-200 rounded-xl px-3 py-1.5 mb-1.5">
              <p className="text-base font-black text-pink-800">「{item.embroidery_text}」</p>
              <p className="text-[10px] text-pink-500">
                {[item.embroidery_color, item.embroidery_pos].filter(Boolean).join(' · ')}
              </p>
            </div>
          )}

          {/* Item name */}
          <p className="text-sm font-semibold text-slate-500 leading-tight mb-2">{item.item_name}</p>

          {/* Customer */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.child?.school_name && (
              <span className="text-xs font-black text-amber-600">{item.child.school_name}</span>
            )}
            <span className="text-sm font-bold text-slate-800">{name}</span>
            {item.child && (
              <span className="text-xs text-slate-400">（保護者: {item.customer?.name}）</span>
            )}
          </div>

          {/* 外注情報 */}
          {item.vendor_name && (
            <div className="flex items-center gap-2 mt-1 mb-1">
              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 rounded-full text-slate-600 border border-slate-200">
                📤 {item.vendor_name}
              </span>
              {item.sent_to_vendor_at && (
                <span className="text-[10px] text-slate-400">送付: {fmtDate(item.sent_to_vendor_at)}</span>
              )}
              {item.expected_return_date && (
                <span className={`text-[10px] font-bold ${
                  new Date(item.expected_return_date) < new Date() ? 'text-red-500' : 'text-slate-400'
                }`}>
                  戻り: {fmtDate(item.expected_return_date)}
                </span>
              )}
            </div>
          )}

          {/* Price + dates */}
          <div className="flex items-end justify-between mt-2">
            <div className="flex items-center gap-2">
              {item.price != null && (
                <span className={`text-sm font-black ${item.prepaid ? 'text-slate-500' : 'text-red-700'}`}>
                  ¥{item.price.toLocaleString()}
                </span>
              )}
              {item.slip_number && (
                <span className="text-[10px] font-mono text-slate-400">#{item.slip_number}</span>
              )}
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">受付: {fmtDate(item.received_date)}</p>
              {item.desired_completion_date && (
                <p className={`text-xs font-semibold ${isOverdue ? 'text-red-600' : isDueSoon ? 'text-amber-600' : 'text-slate-400'}`}>
                  希望: {fmtDate(item.desired_completion_date)}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="shrink-0 mt-1">
          {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </button>

      {/* Primary action button — always visible */}
      {primaryBtn && (
        <div className="px-4 pb-4">
          <button
            onClick={primaryBtn.onClick}
            disabled={loading}
            className={`w-full py-3.5 rounded-xl font-black text-base text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md ${primaryBtn.color}`}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : primaryBtn.label}
          </button>
        </div>
      )}

      {/* Expanded details */}
      {open && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-gray-100 pt-3">
          {item.internal_memo && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2">
              <p className="text-[10px] font-bold text-yellow-600 mb-0.5">スタッフメモ</p>
              <p className="text-xs text-gray-700">{item.internal_memo}</p>
            </div>
          )}
          {item.notes && <p className="text-xs text-gray-600">{item.notes}</p>}
          {item.customer?.tel && (
            <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-xs text-indigo-600">
              <Phone size={12} />{item.customer.tel}
            </a>
          )}
          <a href={`/${storeId}/admin/crm?customerId=${item.customer_id}`}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <User size={11} />顧客詳細
          </a>

          {/* 外注送付ボタン */}
          {item.vendor_name && !item.sent_to_vendor_at && (
            <button onClick={() => update(
              { sent_to_vendor_at: new Date().toISOString().slice(0, 10) },
              `${item.vendor_name}へ送付済みにしました`,
              { sent_to_vendor_at: null }
            )} disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-xs border-2 border-orange-300 bg-orange-50 text-orange-700 flex items-center justify-center gap-2 hover:bg-orange-100 active:scale-95 transition-all">
              <Truck size={12} />📤 {item.vendor_name}へ送付済みにする
            </button>
          )}
          {item.vendor_name && item.sent_to_vendor_at && !item.work_started && (
            <button onClick={() => update(
              { work_started: true, sent_to_vendor_at: item.sent_to_vendor_at },
              '外注品が戻りました',
              { work_started: false }
            )} disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-xs border-2 border-teal-300 bg-teal-50 text-teal-700 flex items-center justify-center gap-2 hover:bg-teal-100 active:scale-95 transition-all">
              <Check size={12} />📥 外注品が戻ってきた（検品へ）
            </button>
          )}

          {/* Payment toggle */}
          {item.prepaid ? (
            <button onClick={() => update({ prepaid: false }, '未払いに戻しました', { prepaid: true })}
              disabled={loading}
              className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 bg-emerald-100 border-emerald-200 text-emerald-700">
              <Banknote size={14} />✅ 支払済み — タップで未払いに戻す
            </button>
          ) : confirmPay ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-2">
              <p className="text-xs text-emerald-700 font-bold text-center">支払い完了にしますか？</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmPay(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold">キャンセル</button>
                <button onClick={() => { update({ prepaid: true }, '支払い完了にしました'); setConfirmPay(false) }}
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-1">
                  <Banknote size={13} />支払い完了
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmPay(true)}
              className="w-full py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 border-2 bg-red-100 border-red-400 text-red-700">
              <Banknote size={14} />⚠️ 未払い — タップして支払い確認
            </button>
          )}

          {onEdit && (
            <button onClick={() => onEdit(item)}
              className="w-full py-2 rounded-xl font-bold text-xs border border-indigo-200 bg-indigo-50 text-indigo-600 flex items-center justify-center gap-1.5 hover:bg-indigo-100 active:scale-95 transition-all">
              <Pencil size={11} />注文内容を変更する
            </button>
          )}

          {item.status !== 'received' && (
            <button onClick={() => update(
              { status: 'received', completed_date: null, delivered_date: null, notified: false },
              '受付中に戻しました',
              { status: item.status, completed_date: item.completed_date, delivered_date: item.delivered_date, notified: item.notified }
            )} disabled={loading}
              className="w-full py-2 rounded-xl font-bold text-xs border border-gray-200 bg-gray-50 text-gray-500 flex items-center justify-center gap-1.5 hover:bg-gray-100 active:scale-95 transition-all">
              <RotateCcw size={11} />受付中に戻す
            </button>
          )}

          {/* Cancel / delete */}
          {!confirmCancel ? (
            <button onClick={() => setConfirmCancel(true)}
              className="w-full py-2 rounded-xl font-bold text-xs border border-red-200 bg-red-50 text-red-500 flex items-center justify-center gap-1.5 hover:bg-red-100 active:scale-95 transition-all">
              <Trash2 size={11} />キャンセル（削除）
            </button>
          ) : (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 space-y-2">
              <p className="text-xs text-red-700 font-black text-center">本当に削除しますか？</p>
              <p className="text-[10px] text-red-500 text-center">この操作は取り消せません</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmCancel(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold">戻る</button>
                <button onClick={async () => {
                  setLoading(true)
                  const { error } = await (supabase as any).from('repair_histories').delete().eq('id', item.id)
                  setLoading(false)
                  if (error) { onToast('err', '削除に失敗しました'); return }
                  onToast('ok', '削除しました')
                  onRefresh()
                }} disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <><Trash2 size={12} />削除</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Purchase Card ─────────────────────────────────────────────
function PurchaseCard({ item, storeId, onRefresh, onToast, onEdit }: {
  item: PurchaseRow; storeId: string; onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: PurchaseRow) => void
}) {
  const [open,          setOpen]          = useState(false)
  const [loading,       setLoading]       = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)

  async function update(patch: Record<string, unknown>, msg: string, undoPatch?: Record<string, unknown>) {
    setLoading(true)
    const { error } = await (supabase as any)
      .from('purchase_orders')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', item.id)
    setLoading(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onRefresh()
    onToast('ok', msg, undoPatch ? async () => {
      await (supabase as any).from('purchase_orders')
        .update({ ...undoPatch, updated_at: new Date().toISOString() }).eq('id', item.id)
      onRefresh()
    } : undefined)
  }

  // Primary action: 発注する or 入荷完了
  let primaryBtn: { label: string; color: string; onClick: () => void } | null = null
  if (['received', 'ordered'].includes(item.status)) {
    primaryBtn = {
      label: '🚚 発注する',
      color: 'bg-orange-600 hover:bg-orange-500 shadow-orange-200',
      onClick: () => update(
        { status: 'on_order' },
        '発注済みにしました',
        { status: item.status }
      ),
    }
  } else if (['on_order', 'stocked'].includes(item.status)) {
    primaryBtn = {
      label: '📦 入荷完了（お渡し待ちへ）',
      color: 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-200',
      onClick: () => update(
        { status: 'arrived', arrived_date: new Date().toISOString().slice(0, 10), notified: true },
        '入荷完了・連絡しました',
        { status: item.status, arrived_date: item.arrived_date, notified: item.notified }
      ),
    }
  }

  const name = item.child?.name ?? item.customer?.name ?? '（顧客不明）'

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <button className="w-full text-left px-4 pt-4 pb-3 flex gap-3" onClick={() => setOpen(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${PURCHASE_STATUS_COLORS[item.status]}`}>
              {PURCHASE_STATUS_LABELS[item.status]}
            </span>
            {item.maker && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
                {item.maker}
              </span>
            )}
          </div>
          <p className="text-lg font-black text-slate-900 leading-snug mb-1">{item.item_name}</p>
          {item.notes && <p className="text-xs text-slate-500 mb-1.5">{item.notes}</p>}
          <div className="flex items-center gap-1.5 flex-wrap">
            {item.child?.school_name && (
              <span className="text-xs font-black text-amber-600">{item.child.school_name}</span>
            )}
            <span className="text-sm font-bold text-slate-700">{name}</span>
            {item.child && (
              <span className="text-xs text-slate-400">（保護者: {item.customer?.name}）</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            {item.price != null && (
              <span className="text-sm font-black text-slate-600">¥{item.price.toLocaleString()}</span>
            )}
            <span className="text-xs text-slate-400">依頼: {fmtDate(item.ordered_date)}</span>
          </div>
        </div>
        <div className="shrink-0 mt-1">
          {open ? <ChevronUp size={15} className="text-gray-400" /> : <ChevronDown size={15} className="text-gray-400" />}
        </div>
      </button>

      {/* Primary action button — always visible */}
      {primaryBtn && (
        <div className="px-4 pb-4">
          <button onClick={primaryBtn.onClick} disabled={loading}
            className={`w-full py-3.5 rounded-xl font-black text-base text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 shadow-md ${primaryBtn.color}`}>
            {loading ? <Loader2 size={18} className="animate-spin" /> : primaryBtn.label}
          </button>
        </div>
      )}

      {open && (
        <div className="px-4 pb-4 space-y-2.5 border-t border-gray-100 pt-3">
          {item.customer?.tel && (
            <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-xs text-indigo-600">
              <Phone size={12} />{item.customer.tel}
            </a>
          )}
          <a href={`/${storeId}/admin/crm?customerId=${item.customer_id}`}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700">
            <User size={11} />顧客詳細
          </a>
          {onEdit && (
            <button onClick={() => onEdit(item)}
              className="w-full py-2 rounded-xl font-bold text-xs border border-indigo-200 bg-indigo-50 text-indigo-600 flex items-center justify-center gap-1.5 hover:bg-indigo-100 active:scale-95 transition-all">
              <Pencil size={11} />注文内容を変更する
            </button>
          )}
          {/* In-store stock option for unordered */}
          {['received', 'ordered'].includes(item.status) && (
            <button onClick={() => update(
              { status: 'stocked', arrived_date: new Date().toISOString().slice(0, 10), notified: true },
              '店頭在庫確保しました',
              { status: item.status, arrived_date: null, notified: false }
            )} disabled={loading}
              className="w-full py-2.5 bg-teal-700 hover:bg-teal-600 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5">
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              店頭在庫確保（取り置き済み）
            </button>
          )}
          {!['received', 'ordered'].includes(item.status) && (
            <button onClick={() => update(
              { status: 'received', arrived_date: null, delivered_date: null, notified: false },
              '依頼受付に戻しました',
              { status: item.status, arrived_date: item.arrived_date, delivered_date: item.delivered_date, notified: item.notified }
            )} disabled={loading}
              className="w-full py-2 rounded-xl font-bold text-xs border border-gray-200 bg-gray-50 text-gray-500 flex items-center justify-center gap-1.5 hover:bg-gray-100">
              <RotateCcw size={11} />依頼受付に戻す
            </button>
          )}

          {/* Cancel / delete */}
          {!confirmCancel ? (
            <button onClick={() => setConfirmCancel(true)}
              className="w-full py-2 rounded-xl font-bold text-xs border border-red-200 bg-red-50 text-red-500 flex items-center justify-center gap-1.5 hover:bg-red-100 active:scale-95 transition-all">
              <Trash2 size={11} />キャンセル（削除）
            </button>
          ) : (
            <div className="rounded-xl border border-red-300 bg-red-50 p-3 space-y-2">
              <p className="text-xs text-red-700 font-black text-center">本当に削除しますか？</p>
              <p className="text-[10px] text-red-500 text-center">この操作は取り消せません</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmCancel(false)}
                  className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-bold">戻る</button>
                <button onClick={async () => {
                  setLoading(true)
                  const { error } = await (supabase as any).from('purchase_orders').delete().eq('id', item.id)
                  setLoading(false)
                  if (error) { onToast('err', '削除に失敗しました'); return }
                  onToast('ok', '削除しました')
                  onRefresh()
                }} disabled={loading}
                  className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                  {loading ? <Loader2 size={12} className="animate-spin" /> : <><Trash2 size={12} />削除</>}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Aggregated Order UI ───────────────────────────────────────
interface OrderGroup {
  groupKey:   string
  item_name:  string
  maker:      string | null
  totalCount: number
  orders:     PurchaseRow[]
}

function AggregatedOrderCard({ group, checked, onCheck, onToast, onEdit }: {
  group: OrderGroup; checked: boolean; onCheck: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: PurchaseRow) => void
}) {
  const [open,   setOpen]   = useState(false)
  const [copied, setCopied] = useState(false)

  function copyToClipboard() {
    const breakdown = group.orders
      .map(o => `・${o.child?.name ?? o.customer?.name ?? '不明'}${o.notes ? `（${o.notes}）` : ''}`)
      .join('\n')
    const lines = [
      `【品名】${group.item_name}`,
      group.maker ? `【メーカー】${group.maker}` : null,
      `【数量】${group.totalCount}件`,
      `─内訳─`,
      breakdown,
    ].filter(Boolean).join('\n')
    navigator.clipboard.writeText(lines)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
      .catch(() => onToast('err', 'コピーに失敗しました'))
  }

  return (
    <div className={`rounded-2xl border-2 overflow-hidden transition-colors ${
      checked ? 'border-orange-400 bg-orange-50' : 'border-slate-200 bg-white'
    }`}>
      <div className="flex items-center gap-2 p-3">
        <button onClick={e => { e.stopPropagation(); onCheck() }}
          className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${
            checked ? 'border-orange-500 bg-orange-500' : 'border-gray-300 hover:border-gray-400'
          }`}>
          {checked && <Check size={13} className="text-white" />}
        </button>
        <button className="flex-1 text-left min-w-0" onClick={() => setOpen(v => !v)}>
          {group.maker && <p className="text-[10px] font-bold text-gray-400 leading-tight">{group.maker}</p>}
          <p className="font-black text-gray-900 text-sm leading-snug">{group.item_name}</p>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-2xl font-black text-orange-600">{group.totalCount}</span>
            <span className="text-xs font-bold text-gray-500">件</span>
            <span className="text-[10px] text-gray-400">/ {group.orders.length}人</span>
          </div>
        </button>
        <button onClick={copyToClipboard}
          className={`shrink-0 p-2 rounded-xl transition-all ${
            copied ? 'bg-emerald-100 text-emerald-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
          }`}>
          {copied ? <CheckCheck size={15} /> : <Copy size={15} />}
        </button>
        <button onClick={() => setOpen(v => !v)} className="shrink-0 text-gray-400 p-1">
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>
      {open && (
        <div className="border-t border-gray-100">
          {group.orders.map((order, idx) => (
            <div key={order.id} className={`px-4 py-2.5 flex items-start gap-3 ${idx > 0 ? 'border-t border-gray-50' : ''}`}>
              <div className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-[10px] font-bold text-gray-500">{idx + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-800">{order.child?.name ?? order.customer?.name ?? '（不明）'}</p>
                {order.child && <p className="text-[10px] text-gray-400">保護者: {order.customer?.name}</p>}
                {order.notes && <p className="text-xs text-gray-500 mt-0.5">{order.notes}</p>}
                <p className="text-[10px] text-gray-400 mt-0.5">依頼日: {fmtDate(order.ordered_date)}</p>
              </div>
              {order.price != null && (
                <p className="text-xs font-bold text-gray-600 shrink-0">¥{order.price.toLocaleString()}</p>
              )}
              {onEdit && (
                <button onClick={() => onEdit(order)}
                  className="shrink-0 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all">
                  <Pencil size={11} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AggregatedOrderList({ orders, storeId, onRefresh, onToast, onEdit }: {
  orders: PurchaseRow[]; storeId: string; onRefresh: () => void
  onToast: (t: 'ok' | 'err', m: string, undo?: () => Promise<void>) => void
  onEdit?: (item: PurchaseRow) => void
}) {
  const [checked,  setChecked]  = useState<Set<string>>(new Set())
  const [updating, setUpdating] = useState(false)

  const groups = useMemo<OrderGroup[]>(() => {
    const map = new Map<string, OrderGroup>()
    for (const order of orders) {
      const key = order.item_name.trim()
      if (!map.has(key)) map.set(key, { groupKey: key, item_name: order.item_name, maker: order.maker, totalCount: 0, orders: [] })
      const g = map.get(key)!
      g.totalCount++
      g.orders.push(order)
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.maker && b.maker) return a.maker.localeCompare(b.maker, 'ja')
      if (a.maker) return -1; if (b.maker) return 1
      return a.item_name.localeCompare(b.item_name, 'ja')
    })
  }, [orders])

  useEffect(() => { setChecked(new Set()) }, [orders])

  function toggleCheck(key: string) {
    setChecked(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n })
  }
  function toggleAll() {
    setChecked(checked.size === groups.length ? new Set() : new Set(groups.map(g => g.groupKey)))
  }

  async function bulkMarkOrdered() {
    const selectedGroups = groups.filter(g => checked.has(g.groupKey))
    const selectedIds    = selectedGroups.flatMap(g => g.orders.map(o => o.id))
    if (selectedIds.length === 0) return
    const prevStatuses = Object.fromEntries(selectedGroups.flatMap(g => g.orders.map(o => [o.id, o.status])))
    setUpdating(true)
    const { error } = await (supabase as any)
      .from('purchase_orders')
      .update({ status: 'on_order', updated_at: new Date().toISOString() })
      .in('id', selectedIds)
    setUpdating(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onRefresh()
    onToast('ok', `${selectedIds.length}件を発注済みにしました`, async () => {
      await Promise.all(
        Object.entries(prevStatuses).map(([id, status]) =>
          (supabase as any).from('purchase_orders')
            .update({ status, updated_at: new Date().toISOString() }).eq('id', id)
        )
      )
      onRefresh()
    })
  }

  if (orders.length === 0) {
    return (
      <div className="text-center py-6 text-gray-400">
        <ShoppingBag size={24} className="mx-auto mb-2 opacity-30" />
        <p className="text-sm">未発注の追加購入はありません</p>
      </div>
    )
  }

  const allChecked   = checked.size === groups.length && groups.length > 0
  const checkedTotal = groups.filter(g => checked.has(g.groupKey)).reduce((s, g) => s + g.totalCount, 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-3 px-1">
        <button onClick={toggleAll} className="flex items-center gap-2 text-xs font-bold text-gray-600 hover:text-gray-800">
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${allChecked ? 'border-orange-500 bg-orange-500' : 'border-gray-300'}`}>
            {allChecked && <Check size={11} className="text-white" />}
          </div>
          {allChecked ? 'すべて解除' : 'すべて選択'}
        </button>
        <span className="text-xs text-gray-400">{groups.length}品目 / 計{orders.length}件</span>
      </div>
      <div className="space-y-2 pb-4">
        {groups.map(group => (
          <AggregatedOrderCard key={group.groupKey} group={group}
            checked={checked.has(group.groupKey)} onCheck={() => toggleCheck(group.groupKey)}
            onToast={onToast} onEdit={onEdit} />
        ))}
      </div>
      {checked.size > 0 && (
        <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
          <div className="max-w-lg w-full bg-orange-700 text-white rounded-2xl shadow-2xl p-3 flex items-center gap-3 pointer-events-auto">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold opacity-70">選択中</p>
              <p className="text-sm font-black">{checked.size}品目 / {checkedTotal}件</p>
            </div>
            <button onClick={bulkMarkOrdered} disabled={updating}
              className="shrink-0 px-5 py-2.5 bg-white text-orange-700 font-black text-sm rounded-xl flex items-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow">
              {updating ? <Loader2 size={14} className="animate-spin" /> : <Truck size={14} />}
              まとめて発注済みに
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Payment Badge ─────────────────────────────────────────────
function PaymentBadge({ status, onToggle, loading }: {
  status: string | null; onToggle: () => void; loading: boolean
}) {
  const isPaid = status === 'paid'
  const [confirmPay,   setConfirmPay]   = useState(false)
  const [confirmUnpay, setConfirmUnpay] = useState(false)

  if (!isPaid && confirmPay) {
    return (
      <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 rounded-xl px-2 py-1">
        <span className="text-[10px] text-emerald-700 font-bold">支払い完了？</span>
        <button onClick={() => setConfirmPay(false)} className="text-[10px] text-gray-500 px-1">✕</button>
        <button onClick={() => { setConfirmPay(false); onToggle() }} disabled={loading}
          className="text-[10px] text-white bg-emerald-600 px-2 py-0.5 rounded-lg font-bold flex items-center gap-0.5">
          <CreditCard size={8} />完了
        </button>
      </div>
    )
  }
  if (isPaid && confirmUnpay) {
    return (
      <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-xl px-2 py-1">
        <span className="text-[10px] text-red-700 font-bold">未払いに戻す？</span>
        <button onClick={() => setConfirmUnpay(false)} className="text-[10px] text-gray-500 px-1">✕</button>
        <button onClick={() => { setConfirmUnpay(false); onToggle() }} disabled={loading}
          className="text-[10px] text-white bg-red-600 px-2 py-0.5 rounded-lg font-bold">戻す</button>
      </div>
    )
  }
  return (
    <button onClick={isPaid ? () => setConfirmUnpay(true) : () => setConfirmPay(true)} disabled={loading}
      className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full border transition-all active:scale-95 disabled:opacity-50 ${
        isPaid ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-600 border-red-200'
      }`}>
      <CreditCard size={9} />
      {loading ? <Loader2 size={9} className="animate-spin" /> : (isPaid ? '支払済' : '未払い')}
    </button>
  )
}

// ── Waiting Card (お渡し待ち) ─────────────────────────────────
function WaitingCard({ item, alertDays, onDeliver, onPaymentToggle, onRevertWaiting, onDelete }: {
  item: DeliveryItem
  alertDays: number
  onDeliver: (item: DeliveryItem, paid: boolean, deliveredBy: string) => Promise<void>
  onPaymentToggle: (item: DeliveryItem) => Promise<void>
  onRevertWaiting: (item: DeliveryItem) => Promise<void>
  onDelete: (item: DeliveryItem) => Promise<void>
}) {
  const [confirmOpen,   setConfirmOpen]   = useState(false)
  const [payAtDeliver,  setPayAtDeliver]  = useState(item.payment_status === 'paid')
  const [unpaidConfirm, setUnpaidConfirm] = useState(false)
  const [confirmRevert, setConfirmRevert] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading,       setLoading]       = useState<string | null>(null)
  const [staffName,     setStaffName]     = useState('')

  const waitDays = item.ready_date
    ? Math.floor((Date.now() - new Date(item.ready_date).getTime()) / 86400000)
    : 0
  const alertLevel = waitDays >= 14 ? 3 : waitDays >= 7 ? 2 : waitDays >= 3 ? 1 : 0

  const studentName = item.child?.name ?? item.customer?.name ?? '（名前なし）'
  const parentName  = item.child ? item.customer?.name : null
  const itemContent = item.sub_label ? `${item.item_name} — ${item.sub_label}` : item.item_name

  return (
    <div className={`border rounded-xl shadow-sm overflow-hidden ${
      alertLevel >= 2 ? 'bg-red-50 border-red-300'
      : alertLevel === 1 ? 'bg-amber-50 border-amber-200'
      : 'bg-white border-slate-200'
    }`}>
      {/* Compact content area */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 flex-wrap mb-1">
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${
                item.kind === 'repair'
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  : 'bg-teal-100 text-teal-700 border-teal-300'
              }`}>
                {item.kind === 'repair' ? '✂️ お直し完了' : '📦 入荷済み'}
              </span>
              {alertLevel === 1 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-300 flex items-center gap-0.5">
                  ⚠️ {waitDays}日経過
                </span>
              )}
              {alertLevel === 2 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 flex items-center gap-0.5">
                  🚨 1週間放置
                </span>
              )}
              {alertLevel >= 3 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-600 text-white border border-red-600 flex items-center gap-0.5 animate-pulse">
                  📢 要連絡
                </span>
              )}
              {item.notified && (
                <span className="text-[10px] bg-emerald-100 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold">
                  通知済み
                </span>
              )}
            </div>
            {item.child?.school_name && (
              <p className="text-[10px] font-black text-amber-600 truncate leading-tight">{item.child.school_name}</p>
            )}
            <p className="font-black text-base leading-tight truncate text-slate-900">{studentName}</p>
            {parentName && <p className="text-[10px] text-slate-400 truncate">保護者: {parentName}</p>}
            <p className="text-xs text-slate-600 mt-0.5 leading-snug truncate">{itemContent}</p>
          </div>
          <div className="shrink-0 text-right">
            {item.price != null && (
              <p className={`text-sm font-black ${item.payment_status === 'paid' ? 'text-gray-400' : 'text-red-600'}`}>
                ¥{item.price.toLocaleString()}
              </p>
            )}
            <p className="text-[10px] text-slate-400">{fmtDate(item.received_date)}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-1.5">
          <PaymentBadge
            status={item.payment_status}
            loading={loading === 'payment'}
            onToggle={async () => {
              setLoading('payment')
              await onPaymentToggle(item)
              setLoading(null)
            }}
          />
          {item.customer?.tel && (
            <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1 text-blue-600 text-[10px] font-bold">
              <Phone size={9} />{item.customer.tel}
            </a>
          )}
          {item.slip_number && (
            <span className="text-[10px] font-mono text-gray-400">#{item.slip_number}</span>
          )}
        </div>
      </div>

      {/* Action area */}
      {confirmDelete ? (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-red-700 font-black text-center">本当に削除しますか？</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold">戻る</button>
            <button onClick={async () => {
              setLoading('delete'); await onDelete(item); setLoading(null)
            }} disabled={!!loading}
              className="flex-1 py-2 rounded-lg bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
              {loading === 'delete' ? <Loader2 size={11} className="animate-spin" /> : <><Trash2 size={11} />削除</>}
            </button>
          </div>
        </div>
      ) : confirmRevert ? (
        <div className="px-3 pb-3 space-y-2">
          <p className="text-xs text-amber-700 font-black text-center">前の状態（作業中/発注中）に戻しますか？</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmRevert(false)}
              className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-600 text-xs font-bold">キャンセル</button>
            <button onClick={async () => {
              setLoading('revert'); await onRevertWaiting(item); setLoading(null); setConfirmRevert(false)
            }} disabled={!!loading}
              className="flex-1 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
              {loading === 'revert' ? <Loader2 size={11} className="animate-spin" /> : <><RotateCcw size={11} />戻す</>}
            </button>
          </div>
        </div>
      ) : !confirmOpen ? (
        <div className="px-3 pb-3 space-y-1.5">
          <button onClick={() => setConfirmOpen(true)}
            className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-indigo-900/15">
            <Package size={15} />お渡し済みにする
          </button>
          <div className="flex gap-1.5">
            <button onClick={() => setConfirmRevert(true)}
              className="flex-1 py-1.5 rounded-lg font-bold text-[10px] border border-amber-200 bg-amber-50 text-amber-600 flex items-center justify-center gap-1 hover:bg-amber-100 active:scale-95 transition-all">
              <RotateCcw size={9} />前の状態に戻す
            </button>
            <button onClick={() => setConfirmDelete(true)}
              className="flex-1 py-1.5 rounded-lg font-bold text-[10px] border border-red-200 bg-red-50 text-red-500 flex items-center justify-center gap-1 hover:bg-red-100 active:scale-95 transition-all">
              <Trash2 size={9} />キャンセル
            </button>
          </div>
        </div>
      ) : (
        <div className="px-3 pb-3 space-y-2 border-t border-slate-100 pt-2">
          <p className="text-xs font-black text-gray-900 text-center">お渡し確認</p>
          <input
            type="text"
            value={staffName}
            onChange={e => setStaffName(e.target.value)}
            placeholder="担当スタッフ名（任意）"
            className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:border-indigo-400"
          />
          <button onClick={() => setPayAtDeliver(v => !v)}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 transition-all ${
              payAtDeliver ? 'border-emerald-500 bg-emerald-500/10' : 'border-gray-300 bg-gray-200/50'
            }`}>
            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
              payAtDeliver ? 'border-emerald-500 bg-emerald-500' : 'border-gray-300'
            }`}>
              {payAtDeliver && <CheckCheck size={9} className="text-white" />}
            </div>
            <div className="text-left">
              <p className={`text-xs font-bold ${payAtDeliver ? 'text-emerald-700' : 'text-gray-500'}`}>代金を受け取った</p>
              <p className="text-[10px] text-gray-500">
                {item.price != null ? `¥${item.price.toLocaleString()}` : '金額未設定'}
              </p>
            </div>
          </button>
          {unpaidConfirm && (
            <div className="rounded-xl border-2 border-red-500 bg-red-50 px-3 py-2.5 space-y-2">
              <p className="text-xs font-black text-red-700 text-center flex items-center justify-center gap-1">
                <AlertCircle size={13} />まだ未払いです！
              </p>
              <div className="flex gap-2">
                <button onClick={() => setUnpaidConfirm(false)}
                  className="flex-1 py-1.5 rounded-xl font-bold text-xs bg-gray-200 text-gray-700">戻る</button>
                <button onClick={async () => {
                  setUnpaidConfirm(false); setLoading('deliver')
                  await onDeliver(item, false, staffName); setLoading(null); setConfirmOpen(false)
                }} disabled={!!loading}
                  className="flex-1 py-1.5 rounded-xl font-bold text-xs bg-red-600 text-white disabled:opacity-50 flex items-center justify-center gap-1">
                  {loading === 'deliver' ? <Loader2 size={11} className="animate-spin" /> : '未払いのままお渡し'}
                </button>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => { setConfirmOpen(false); setUnpaidConfirm(false) }}
              className="py-2.5 rounded-xl font-bold text-sm bg-gray-300 text-gray-700">キャンセル</button>
            <button onClick={async () => {
              if (!payAtDeliver && item.payment_status !== 'paid') { setUnpaidConfirm(true); return }
              setLoading('deliver')
              await onDeliver(item, payAtDeliver, staffName)
              setLoading(null); setConfirmOpen(false)
            }} disabled={!!loading || unpaidConfirm}
              className="py-2.5 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white disabled:opacity-50 flex items-center justify-center gap-1.5">
              {loading === 'deliver' ? <><Loader2 size={13} className="animate-spin" />処理中...</> : <><Package size={13} />お渡し</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Completed Card ────────────────────────────────────────────
function CompletedCard({ item, onRevert, onPaymentToggle }: {
  item: DeliveryItem
  onRevert: (item: DeliveryItem) => Promise<void>
  onPaymentToggle: (item: DeliveryItem) => Promise<void>
}) {
  const [confirmRevert, setConfirmRevert] = useState(false)
  const [loading,       setLoading]       = useState<string | null>(null)
  const [custOpen,      setCustOpen]      = useState(false)
  const isUnpaidDelivered = item.payment_status !== 'paid'

  return (
    <div className={`rounded-2xl border p-4 ${
      isUnpaidDelivered ? 'border-2 border-red-500 bg-red-50' : 'bg-gray-100 border-gray-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center bg-gray-200">
          <Package size={14} className="text-gray-500" />
        </div>
        <div className="flex-1 min-w-0">
          {item.customer && (
            <button onClick={() => setCustOpen(v => !v)}
              className="text-xs font-bold text-gray-500 mb-1 flex items-center gap-1 w-full text-left">
              <User size={10} />
              {item.customer.name}
              {item.child && <span className="text-gray-500">（{item.child.name}）</span>}
              <ChevronDown size={10} className={`ml-auto shrink-0 transition-transform text-gray-500 ${custOpen ? 'rotate-180' : ''}`} />
            </button>
          )}
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full border bg-gray-300/60 text-gray-500 border-gray-300">お渡し済み</span>
            {isUnpaidDelivered && (
              <span className="text-xs font-black px-2 py-0.5 rounded-full border bg-red-600 text-white border-red-600 flex items-center gap-1 animate-pulse">
                <AlertCircle size={9} />代金未回収
              </span>
            )}
            <PaymentBadge status={item.payment_status} loading={loading === 'payment'}
              onToggle={async () => { setLoading('payment'); await onPaymentToggle(item); setLoading(null) }} />
          </div>
          <p className="font-bold text-gray-700 text-sm">{item.item_name}</p>
          {item.sub_label && <p className="text-gray-500 text-xs mt-0.5">{item.sub_label}</p>}
          {item.price != null && <p className="text-gray-500 text-xs mt-0.5">¥{item.price.toLocaleString()}</p>}
          <div className="flex items-center gap-3 mt-1.5 text-gray-400 text-[10px]">
            <span className="flex items-center gap-1"><CalendarDays size={9} />受付 {fmtDate(item.received_date)}</span>
            {item.delivered_date && (
              <span className="flex items-center gap-1"><Package size={9} />お渡し {fmtDate(item.delivered_date)}</span>
            )}
            {item.delivered_by && (
              <span className="flex items-center gap-1 text-indigo-400">👤 {item.delivered_by}</span>
            )}
          </div>
        </div>
      </div>
      {custOpen && item.customer?.tel && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <a href={`tel:${item.customer.tel}`} className="flex items-center gap-1.5 text-blue-600 text-xs font-bold">
            <Phone size={11} />{item.customer.tel}
          </a>
        </div>
      )}
      {!confirmRevert ? (
        <button onClick={() => setConfirmRevert(true)}
          className="w-full mt-3 py-2 rounded-xl font-bold text-xs border border-gray-300 text-gray-500 hover:border-gray-400 flex items-center justify-center gap-1.5">
          <RotateCcw size={11} />お渡しを取り消す
        </button>
      ) : (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <p className="text-xs text-center text-amber-700 font-bold">お渡しを取り消して前の状態に戻しますか？</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmRevert(false)}
              className="flex-1 py-2 rounded-xl font-bold text-xs bg-gray-200 text-gray-700">キャンセル</button>
            <button onClick={async () => {
              setLoading('revert'); await onRevert(item); setLoading(null); setConfirmRevert(false)
            }} disabled={!!loading}
              className="flex-1 py-2 rounded-xl font-bold text-xs bg-amber-600 text-white disabled:opacity-50 flex items-center justify-center gap-1">
              {loading === 'revert' ? <Loader2 size={12} className="animate-spin" /> : <><RotateCcw size={12} />取り消す</>}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Edit Modal ────────────────────────────────────────────────
function EditModal({ kind, item, onClose, onSave, onToast }: {
  kind: 'repair' | 'purchase'
  item: RepairRow | PurchaseRow
  onClose: () => void
  onSave: () => void
  onToast: (t: 'ok' | 'err', m: string) => void
}) {
  const [saving,   setSaving]   = useState(false)
  const [itemName, setItemName] = useState(item.item_name)
  const [content,  setContent]  = useState(kind === 'repair' ? (item as RepairRow).content : '')
  const [maker,    setMaker]    = useState(kind === 'purchase' ? ((item as PurchaseRow).maker ?? '') : '')
  const [price,    setPrice]    = useState(String(item.price ?? ''))
  const [deadline, setDeadline] = useState(kind === 'repair' ? ((item as RepairRow).desired_completion_date ?? '') : '')
  const [notes,    setNotes]    = useState(item.notes ?? '')

  async function handleSave() {
    if (!itemName.trim()) return
    setSaving(true)
    const table = kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const patch: Record<string, unknown> = {
      item_name: itemName.trim(),
      notes:     notes.trim() || null,
      price:     price ? Number(price) : null,
      updated_at: new Date().toISOString(),
    }
    if (kind === 'repair') {
      patch.content = content.trim()
      patch.desired_completion_date = deadline || null
    } else {
      patch.maker = maker.trim() || null
    }
    const { error } = await (supabase as any).from(table).update(patch).eq('id', item.id)
    setSaving(false)
    if (error) { onToast('err', '更新に失敗しました'); return }
    onToast('ok', '変更を保存しました')
    onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4 shadow-2xl"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
            <Pencil size={14} className="text-indigo-500" />注文内容を変更
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>
        <div className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2 font-medium">
          {kind === 'repair' ? '✂️ お直し依頼' : '📦 追加購入'}
          {' — '}
          {(kind === 'repair' ? (item as RepairRow).customer?.name : (item as PurchaseRow).customer?.name) ?? '顧客不明'}
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">品名・商品名 <span className="text-red-500">*</span></label>
          <input type="text" value={itemName} onChange={e => setItemName(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
            placeholder="例: ○○中学校 スラックス Mサイズ" />
        </div>
        {kind === 'repair' && (
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">お直し内容</label>
            <input type="text" value={content} onChange={e => setContent(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="例: 裾上げ 3cm、サイズ変更 M→L" />
          </div>
        )}
        {kind === 'purchase' && (
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">メーカー</label>
            <input type="text" value={maker} onChange={e => setMaker(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="例: カンコー" />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold text-gray-600 block mb-1">金額（税込）</label>
            <input type="number" value={price} onChange={e => setPrice(e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none"
              placeholder="1200" />
          </div>
          {kind === 'repair' && (
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">希望完了日</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-bold text-gray-600 block mb-1">備考・サイズ変更メモ</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none resize-none"
            placeholder="数量変更・サイズ変更などの追記事項" />
        </div>
        <button onClick={handleSave} disabled={saving || !itemName.trim()}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-xl flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
          変更を保存する
        </button>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────
type ActiveTab = 'repair' | 'purchase' | 'delivery'
type DeliverySubTab = 'waiting' | 'history'
type SortOrder = 'priority' | 'received_asc' | 'deadline_asc' | 'school' | 'name' | 'unpaid_first'

export default function RepairsPage() {
  const { storeId } = useParams<{ storeId: string }>()

  const [tab,            setTab]            = useState<ActiveTab>('repair')
  const [deliverySubTab, setDeliverySubTab] = useState<DeliverySubTab>('waiting')
  const [repairs,        setRepairs]        = useState<RepairRow[]>([])
  const [purchases,      setPurchases]      = useState<PurchaseRow[]>([])
  const [waiting,        setWaiting]        = useState<DeliveryItem[]>([])
  const [history,        setHistory]        = useState<DeliveryItem[]>([])
  const [loading,        setLoading]        = useState(true)
  const [histLoading,    setHistLoading]    = useState(false)
  const [histFetched,    setHistFetched]    = useState(false)
  const [alertDays,      setAlertDays]      = useState(7)
  const [fetchError,     setFetchError]     = useState<string | null>(null)
  const [toast,          setToast]          = useState<{ type: 'ok' | 'err'; msg: string; onUndo?: () => Promise<void> } | null>(null)
  const [sortOrder,      setSortOrder]      = useState<SortOrder>('priority')
  const [editItem,       setEditItem]       = useState<RepairRow | PurchaseRow | null>(null)
  const [editKind,       setEditKind]       = useState<'repair' | 'purchase' | null>(null)
  const [searchText,     setSearchText]     = useState('')
  const [dummyLoading,   setDummyLoading]   = useState(false)
  const [showNewRepair,  setShowNewRepair]  = useState(false)
  const [showNewOrder,   setShowNewOrder]   = useState(false)

  const showToast = useCallback((type: 'ok' | 'err', msg: string, onUndo?: () => Promise<void>) => {
    setToast({ type, msg, onUndo })
  }, [])

  useEffect(() => {
    if (!storeId) return
    ;(supabase as any).from('stores').select('alert_days_repair')
      .eq('id', storeId).single()
      .then(({ data }: { data: { alert_days_repair: number } | null }) => {
        if (data?.alert_days_repair) setAlertDays(data.alert_days_repair)
      })
  }, [storeId])

  const fetchAll = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    setFetchError(null)
    const [
      { data: repairData,   error: repairErr   },
      { data: purchaseData, error: purchaseErr  },
      { data: waitRepairs  },
      { data: waitPurchases },
    ] = await Promise.all([
      (supabase as any).from('repair_histories')
        .select('*, desired_completion_date, work_started, customer:customers(id,name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'received')
        .order('received_date', { ascending: true }),
      (supabase as any).from('purchase_orders')
        .select('*, customer:customers(id,name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).not('status', 'in', '("arrived","delivered")')
        .order('ordered_date', { ascending: true }),
      supabase.from('repair_histories')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'completed')
        .order('completed_date', { ascending: true }),
      supabase.from('purchase_orders')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'arrived')
        .order('arrived_date', { ascending: true }),
    ])
    if (repairErr)    setFetchError(repairErr.message)
    else if (purchaseErr) setFetchError(purchaseErr.message)
    setRepairs(repairData ?? [])
    setPurchases(purchaseData ?? [])
    const waitingItems: DeliveryItem[] = [
      ...(waitRepairs   ?? []).map((r: Record<string, unknown>) => rawToItem(r, 'repair')),
      ...(waitPurchases ?? []).map((p: Record<string, unknown>) => rawToItem(p, 'purchase')),
    ].sort((a, b) => (a.ready_date ?? a.received_date).localeCompare(b.ready_date ?? b.received_date))
    setWaiting(waitingItems)
    setLoading(false)
  }, [storeId])

  const fetchHistory = useCallback(async () => {
    if (!storeId || histFetched) return
    setHistLoading(true)
    const [{ data: hRepairs }, { data: hPurchases }] = await Promise.all([
      supabase.from('repair_histories')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'delivered')
        .order('delivered_date', { ascending: false }).limit(100),
      supabase.from('purchase_orders')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'delivered')
        .order('delivered_date', { ascending: false }).limit(100),
    ])
    const histItems: DeliveryItem[] = [
      ...(hRepairs   ?? []).map((r: Record<string, unknown>) => rawToItem(r, 'repair')),
      ...(hPurchases ?? []).map((p: Record<string, unknown>) => rawToItem(p, 'purchase')),
    ].sort((a, b) => (b.delivered_date ?? '').localeCompare(a.delivered_date ?? ''))
    setHistory(histItems)
    setHistLoading(false)
    setHistFetched(true)
  }, [storeId, histFetched])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    if (tab === 'delivery' && deliverySubTab === 'history' && !histFetched) fetchHistory()
  }, [tab, deliverySubTab, histFetched, fetchHistory])

  // ── Delivery actions ───────────────────────────────────────
  const handleDeliver = useCallback(async (item: DeliveryItem, paid: boolean, deliveredBy: string) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const update: Record<string, unknown> = { status: 'delivered', delivered_date: todayJst() }
    if (paid) update.payment_status = 'paid'
    if (deliveredBy.trim()) update.delivered_by = deliveredBy.trim()
    const { error } = await (supabase as any).from(table).update(update).eq('id', item.id)
    if (error) { showToast('err', `受渡処理失敗: ${error.message}`); return }
    setWaiting(prev => prev.filter(i => i.id !== item.id))
    const snapshot = { ...item }
    showToast('ok', '📦 お渡し済みにしました', async () => {
      const revert: Record<string, unknown> = {
        status: snapshot.prev_status, delivered_date: null, payment_status: snapshot.payment_status,
      }
      if (item.kind === 'repair') revert.completed_date = snapshot.ready_date
      else                        revert.arrived_date   = snapshot.ready_date
      await (supabase as any).from(table).update(revert).eq('id', snapshot.id)
      await fetchAll()
    })
    setHistFetched(false)
  }, [showToast, fetchAll])

  const handleRevert = useCallback(async (item: DeliveryItem) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const update: Record<string, unknown> = { status: item.prev_status, delivered_date: null, payment_status: 'unpaid' }
    if (item.kind === 'repair') update.completed_date = item.ready_date
    else                        update.arrived_date   = item.ready_date
    const { error } = await (supabase as any).from(table).update(update).eq('id', item.id)
    if (error) { showToast('err', `取り消し失敗: ${error.message}`); return }
    setHistory(prev => prev.filter(i => i.id !== item.id))
    await fetchAll()
    showToast('ok', '🔄 お渡し前の状態に戻しました')
  }, [showToast, fetchAll])

  const handlePaymentToggle = useCallback(async (item: DeliveryItem) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const newStatus  = item.payment_status === 'paid' ? 'unpaid' : 'paid'
    const prevStatus = item.payment_status
    const { error } = await (supabase as any).from(table).update({ payment_status: newStatus }).eq('id', item.id)
    if (error) { showToast('err', '支払状態の更新に失敗しました'); return }
    const updater = (prev: DeliveryItem[]) =>
      prev.map(i => i.id === item.id ? { ...i, payment_status: newStatus } : i)
    setWaiting(updater)
    setHistory(updater)
    if (newStatus === 'unpaid') {
      showToast('ok', '未払いに戻しました', async () => {
        await (supabase as any).from(table).update({ payment_status: prevStatus }).eq('id', item.id)
        setWaiting(p => p.map(i => i.id === item.id ? { ...i, payment_status: prevStatus } : i))
        setHistory(p => p.map(i => i.id === item.id ? { ...i, payment_status: prevStatus } : i))
      })
    }
  }, [showToast])

  // ── Revert waiting item to previous state ─────────────────
  const handleRevertWaiting = useCallback(async (item: DeliveryItem) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const update: Record<string, unknown> = { status: item.kind === 'repair' ? 'received' : 'on_order', delivered_date: null }
    if (item.kind === 'repair') { update.completed_date = null; update.work_started = true }
    else update.arrived_date = null
    const { error } = await (supabase as any).from(table).update(update).eq('id', item.id)
    if (error) { showToast('err', `戻し失敗: ${error.message}`); return }
    setWaiting(prev => prev.filter(i => i.id !== item.id))
    await fetchAll()
    showToast('ok', '前の状態に戻しました')
  }, [showToast, fetchAll])

  const handleDeleteWaiting = useCallback(async (item: DeliveryItem) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const { error } = await (supabase as any).from(table).delete().eq('id', item.id)
    if (error) { showToast('err', `削除失敗: ${error.message}`); return }
    setWaiting(prev => prev.filter(i => i.id !== item.id))
    showToast('ok', '削除しました')
  }, [showToast])

  // ── Dummy data generator ───────────────────────────────────
  const generateDummy = useCallback(async () => {
    if (!storeId) return
    setDummyLoading(true)
    const SCHOOLS = ['○○中学校', '△△高等学校', '□□中学校', '◇◇高等学校']
    const ITEMS   = ['スラックス', 'ブレザー', 'スカート', 'セーター', 'シャツ', 'ネクタイ', 'ソックス']
    const NAMES   = ['田中花子', '鈴木太郎', '佐藤次郎', '山田美咲', '伊藤健一', '渡辺あかり', '中村大輔']
    const CONTENTS = ['裾上げ 3cm', 'ウエスト調整', 'ほつれ修理', 'ボタン付け直し', 'サイズ変更 M→L', 'ファスナー交換']
    const TYPES: Array<'repair' | 'walk_in' | 'hold_request' | 'inquiry'> = ['repair', 'repair', 'repair', 'walk_in', 'hold_request', 'inquiry']

    const rand = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
    const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)

    // Find or create a test customer
    const custName = rand(NAMES)
    let { data: existingCusts } = await (supabase as any)
      .from('customers').select('id').eq('store_id', storeId).eq('name', custName).limit(1)
    let customerId = existingCusts?.[0]?.id
    if (!customerId) {
      const { data: newCust } = await (supabase as any)
        .from('customers').insert({
          store_id: storeId, name: custName, kana: null,
          tel: `090-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
          school_name: rand(SCHOOLS), created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }).select('id').single()
      customerId = newCust?.id
    }
    if (!customerId) { setDummyLoading(false); showToast('err', '顧客作成に失敗しました'); return }

    // Randomly create a repair or purchase
    const kind = Math.random() < 0.6 ? 'repair' : 'purchase'
    if (kind === 'repair') {
      const reqType = rand(TYPES)
      await (supabase as any).from('repair_histories').insert({
        store_id: storeId, customer_id: customerId,
        item_name: rand(ITEMS), content: rand(CONTENTS),
        status: 'received', request_type: reqType,
        received_date: daysAgo(Math.floor(Math.random() * 14)),
        desired_completion_date: Math.random() < 0.6 ? daysAgo(-Math.floor(Math.random() * 14)) : null,
        work_started: Math.random() < 0.3,
        prepaid: Math.random() < 0.5,
        price: [500, 800, 1200, 2000, 3000][Math.floor(Math.random() * 5)],
        notified: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
    } else {
      const MAKERS = ['カンコー', 'トンボ', 'スクールタイガー', null]
      await (supabase as any).from('purchase_orders').insert({
        store_id: storeId, customer_id: customerId,
        item_name: rand(ITEMS), maker: rand(MAKERS),
        status: rand(['received', 'ordered', 'on_order'] as const),
        ordered_date: daysAgo(Math.floor(Math.random() * 10)),
        price: [3000, 5000, 8000, 12000][Math.floor(Math.random() * 4)],
        notified: false, created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      })
    }
    await fetchAll()
    setDummyLoading(false)
    showToast('ok', `ダミーデータを追加しました（${kind === 'repair' ? 'お直し' : '発注'}）`)
  }, [storeId, fetchAll, showToast])

  // ── Sort + derived ─────────────────────────────────────────
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)

  function priorityScore(r: RepairRow): number {
    if (!r.desired_completion_date) return 500
    const d = new Date(r.desired_completion_date); d.setHours(0, 0, 0, 0)
    const diff = Math.floor((d.getTime() - todayDate.getTime()) / 86400000)
    if (diff < 0) return diff - 1000
    if (diff === 0) return -100
    if (diff === 1) return -50
    return diff
  }

  const sortFn = (a: RepairRow, b: RepairRow): number => {
    switch (sortOrder) {
      case 'priority':     return priorityScore(a) - priorityScore(b)
      case 'received_asc': return a.received_date.localeCompare(b.received_date)
      case 'deadline_asc': {
        const da = a.desired_completion_date ?? '9999-12-31'
        const db = b.desired_completion_date ?? '9999-12-31'
        return da.localeCompare(db)
      }
      case 'school':       return (a.child?.school_name ?? '').localeCompare(b.child?.school_name ?? '', 'ja')
      case 'name': {
        const na = a.child?.name ?? a.customer?.name ?? ''
        const nb = b.child?.name ?? b.customer?.name ?? ''
        return na.localeCompare(nb, 'ja')
      }
      case 'unpaid_first': {
        const pa = a.prepaid ? 1 : 0; const pb = b.prepaid ? 1 : 0
        return pa !== pb ? pa - pb : priorityScore(a) - priorityScore(b)
      }
      default: return 0
    }
  }

  const sortedRepairs = repairs.slice().sort(sortFn)

  // 発注タブ: arrived は お渡し待ちに移動済みなので除外済み
  const purchaseUnordered = purchases.filter(p => ['received', 'ordered'].includes(p.status))
  const purchaseOnOrder   = purchases.filter(p => p.status === 'on_order')
  const purchaseStocked   = purchases.filter(p => p.status === 'stocked')

  // Search filter helpers
  function matchSearch(fields: (string | null | undefined)[]): boolean {
    if (!searchText.trim()) return true
    const q = searchText.toLowerCase()
    return fields.some(f => f?.toLowerCase().includes(q))
  }

  const filteredRepairs = sortedRepairs.filter(r =>
    matchSearch([r.content, r.item_name, r.child?.name, r.customer?.name, r.child?.school_name, r.slip_number])
  )
  const filteredPurchases = purchases.filter(p =>
    matchSearch([p.item_name, p.maker, p.notes, p.child?.name, p.customer?.name, p.child?.school_name])
  )
  const filteredPurchaseUnordered = filteredPurchases.filter(p => ['received', 'ordered'].includes(p.status))
  const filteredPurchaseOnOrder   = filteredPurchases.filter(p => p.status === 'on_order')
  const filteredPurchaseStocked   = filteredPurchases.filter(p => p.status === 'stocked')

  // ダッシュボード counts
  const repairNotStarted  = repairs.filter(r => r.request_type === 'repair' && !r.work_started)
  const repairInProgress  = repairs.filter(r => r.request_type === 'repair' && r.work_started)
  const repairConsult     = repairs.filter(r => r.request_type === 'repair_consult')
  const pendingInquiry    = repairs.filter(r => r.request_type === 'inquiry')
  const pendingPayment    = repairs.filter(r => r.request_type === 'payment_pending')
  const repairOther       = repairs.filter(r => r.request_type !== 'repair' && r.request_type !== 'inquiry')
  const overdueRepairs    = repairs.filter(r => {
    if (!r.desired_completion_date) return false
    const d = new Date(r.desired_completion_date); d.setHours(0, 0, 0, 0)
    return d < todayDate
  })
  const waitingUnpaid = waiting.filter(i => i.payment_status !== 'paid')
  const waitingPaid   = waiting.filter(i => i.payment_status === 'paid')
  const waitingAlert  = waiting.filter(i =>
    i.ready_date && (Date.now() - new Date(i.ready_date).getTime()) / 86400000 > alertDays
  )

  // 未着手数（未着手お直し + 相談 + 未対応問合せ + 入金待ち + お渡しアラート）
  const pendingCount =
    repairNotStarted.length +
    repairConsult.length +
    pendingInquiry.length +
    pendingPayment.length +
    waitingAlert.length

  // 全案件合計（進行中含む）
  const totalActive =
    repairs.length +
    purchases.length +
    waiting.length

  const filteredWaiting = [...waitingUnpaid, ...waitingPaid].filter(i =>
    matchSearch([i.item_name, i.sub_label, i.child?.name, i.customer?.name, i.child?.school_name, i.slip_number])
  )


  return (
    <div className="min-h-screen bg-slate-100 text-gray-900">
      {/* ── Header / Dashboard ────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 pt-3 pb-0">

          {/* Title row */}
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-sm font-bold text-gray-900 flex-1">業務ダッシュボード</h1>
            <button onClick={generateDummy} disabled={dummyLoading}
              className="flex items-center gap-1 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-500 text-[10px] font-bold rounded-lg transition-all disabled:opacity-50"
              title="テスト用ダミーデータを追加">
              {dummyLoading ? <Loader2 size={11} className="animate-spin" /> : <Database size={11} />}
              テスト追加
            </button>
            <button onClick={() => setShowNewOrder(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all">
              <ShoppingCart size={13} />制服注文
            </button>
            <button onClick={() => setShowNewRepair(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all">
              <Plus size={13} />✂️ お直し
            </button>
          </div>

          {/* Dashboard card — タブ切り替えも兼ねる */}
          <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 rounded-2xl px-4 py-2.5 text-white">
            <div className="flex items-center gap-3 mb-2">
              <div>
                <p className="text-[9px] font-bold opacity-70 uppercase tracking-wider mb-0.5">未着手数</p>
                <div className="flex items-baseline gap-1.5">
                  <span className={`font-black leading-none ${pendingCount >= 10 ? 'text-4xl' : 'text-5xl'}`}>
                    {pendingCount}
                  </span>
                  <span className="text-sm font-bold opacity-70">件</span>
                  <span className="text-[9px] opacity-50">/ 全{totalActive}件</span>
                </div>
              </div>
              {overdueRepairs.length > 0 && (
                <div className="ml-auto bg-red-500/30 border border-red-400/50 rounded-xl px-2.5 py-1.5 text-center">
                  <p className="text-xl font-black text-red-200">{overdueRepairs.length}</p>
                  <p className="text-[8px] font-bold text-red-200 opacity-90">🚨 期限超過</p>
                </div>
              )}
            </div>

            {/* Progress breakdown */}
            <div className="flex items-center gap-1 flex-wrap mb-2">
              {[
                { label: 'お直し未着手', count: repairNotStarted.length,    color: 'bg-white/20' },
                { label: 'お直し中',     count: repairInProgress.length,   color: 'bg-white/10' },
                { label: 'お直し相談',   count: repairConsult.length,      color: 'bg-teal-400/40' },
                { label: '問合せ',       count: pendingInquiry.length,     color: 'bg-rose-400/40' },
                { label: '入金待ち',     count: pendingPayment.length,     color: 'bg-red-400/40' },
                { label: '発注待ち',     count: purchaseUnordered.length,  color: 'bg-white/20' },
                { label: '発注中',       count: purchaseOnOrder.length,    color: 'bg-white/10' },
                { label: 'お渡し待ち',   count: waiting.length,            color: 'bg-white/20' },
              ].filter(s => s.count > 0).map(s => (
                <span key={s.label} className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${s.color} text-white/90`}>
                  {s.label} {s.count}
                </span>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5 border-t border-white/20 pt-2">
              {([
                { id: 'repair'   as const, emoji: '✂️', label: 'お直し',    count: repairs.length },
                { id: 'purchase' as const, emoji: '📦', label: '発注',      count: purchases.length },
                { id: 'delivery' as const, emoji: '🎁', label: 'お渡し待ち', count: waiting.length },
              ]).map(t => (
                <button key={t.id} onClick={() => { setTab(t.id); setSearchText('') }}
                  className={`rounded-xl py-2 text-center active:scale-95 transition-all ${
                    tab === t.id
                      ? 'bg-white/25 ring-2 ring-white/60'
                      : 'hover:bg-white/10'
                  }`}>
                  <p className={`text-2xl font-black leading-none ${t.count > 0 ? 'text-white' : 'text-white/30'}`}>
                    {t.count}
                  </p>
                  <p className={`text-[9px] font-bold mt-0.5 ${tab === t.id ? 'text-white' : 'text-white/60'}`}>
                    {t.emoji} {t.label}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 py-4 pb-32 space-y-4">
        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-600">
            DBエラー: {fetchError}
          </div>
        )}

        {/* お渡し — sub-tabs */}
        {tab === 'delivery' && (
          <div className="flex bg-gray-100 rounded-2xl p-1 gap-1">
            {([
              { id: 'waiting' as const, label: 'お渡し待ち', count: waiting.length },
              { id: 'history' as const, label: '完了履歴',   count: null },
            ]).map(t => (
              <button key={t.id} onClick={() => setDeliverySubTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  deliverySubTab === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}>
                {t.id === 'waiting' ? <Package size={14} /> : <History size={14} />}
                {t.label}
                {t.count !== null && t.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${
                    deliverySubTab === t.id ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 size={24} className="animate-spin" />
          </div>

        ) : tab === 'repair' ? (
          /* ── ①お直しタブ ─────────────────────────────────── */
          <div className="space-y-3">
            {/* Search + Sort row */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                  placeholder="名前・品名・学校で絞り込み"
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)}
                className="bg-white border border-slate-300 rounded-xl px-2 py-2 text-xs text-slate-700 font-medium focus:border-indigo-500 focus:outline-none shrink-0">
                <option value="priority">優先順</option>
                <option value="received_asc">受付日順</option>
                <option value="deadline_asc">期限順</option>
                <option value="school">学校順</option>
                <option value="name">顧客名順</option>
                <option value="unpaid_first">未払い優先</option>
              </select>
            </div>

            {filteredRepairs.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Scissors size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">{searchText ? '該当するお直しがありません' : '対応中のお直し・依頼はありません'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRepairs.map(r => (
                  <RepairCard key={r.id} item={r} storeId={storeId} onRefresh={fetchAll} onToast={showToast}
                    onEdit={item => { setEditItem(item); setEditKind('repair') }} />
                ))}
              </div>
            )}
          </div>

        ) : tab === 'purchase' ? (
          /* ── ②発注タブ ───────────────────────────────────── */
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                placeholder="名前・品名・メーカーで絞り込み"
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {filteredPurchases.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <ShoppingBag size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-bold">{searchText ? '該当する発注がありません' : '対応中の発注はありません'}</p>
              </div>
            ) : (
              <>
                {/* 未発注: 集約リスト */}
                {filteredPurchaseUnordered.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                      <p className="text-sm font-black text-orange-700">未発注 — メーカーへ発注してください</p>
                      <span className="ml-auto text-sm font-black text-orange-600">{filteredPurchaseUnordered.length}件</span>
                    </div>
                    <AggregatedOrderList
                      orders={filteredPurchaseUnordered}
                      storeId={storeId} onRefresh={fetchAll} onToast={showToast}
                      onEdit={item => { setEditItem(item); setEditKind('purchase') }}
                    />
                  </section>
                )}

                {/* 発注済み: 入荷待ち */}
                {filteredPurchaseOnOrder.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                      <p className="text-sm font-black text-blue-700">発注済み — 入荷を待っています</p>
                      <span className="ml-auto text-sm font-black text-blue-600">{filteredPurchaseOnOrder.length}件</span>
                    </div>
                    <div className="space-y-3">
                      {filteredPurchaseOnOrder.map(p => (
                        <PurchaseCard key={p.id} item={p} storeId={storeId} onRefresh={fetchAll} onToast={showToast}
                          onEdit={item => { setEditItem(item); setEditKind('purchase') }} />
                      ))}
                    </div>
                  </section>
                )}

                {/* 在庫確保済み */}
                {filteredPurchaseStocked.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-teal-500 shrink-0" />
                      <p className="text-sm font-black text-teal-700">在庫確保済み — お渡し待ちに移動できます</p>
                      <span className="ml-auto text-sm font-black text-teal-600">{filteredPurchaseStocked.length}件</span>
                    </div>
                    <div className="space-y-3">
                      {filteredPurchaseStocked.map(p => (
                        <PurchaseCard key={p.id} item={p} storeId={storeId} onRefresh={fetchAll} onToast={showToast}
                          onEdit={item => { setEditItem(item); setEditKind('purchase') }} />
                      ))}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>

        ) : tab === 'delivery' ? (
          /* ── ③お渡しタブ ─────────────────────────────────── */
          deliverySubTab === 'waiting' ? (
            <>
              {/* Search */}
              <div className="relative mb-3">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                  placeholder="名前・品名で絞り込み"
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-sm focus:border-indigo-500 focus:outline-none"
                />
              </div>
              {filteredWaiting.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <Package size={44} className="mx-auto mb-3 opacity-15" />
                  <p className="text-sm font-bold">{searchText ? '該当するアイテムがありません' : 'お渡し待ちのアイテムはありません'}</p>
                  {!searchText && <p className="text-xs mt-1 text-gray-400">お直し完了・入荷済みの商品がここに表示されます</p>}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredWaiting.map(item => (
                    <WaitingCard key={item.id} item={item} alertDays={alertDays}
                      onDeliver={handleDeliver} onPaymentToggle={handlePaymentToggle}
                      onRevertWaiting={handleRevertWaiting} onDelete={handleDeleteWaiting} />
                  ))}
                </div>
              )}
            </>
          ) : (
            histLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={28} className="animate-spin text-indigo-400" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <History size={44} className="mx-auto mb-3 opacity-15" />
                <p className="text-sm font-bold">お渡し完了履歴はありません</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map(item => (
                  <CompletedCard key={item.id} item={item} onRevert={handleRevert} onPaymentToggle={handlePaymentToggle} />
                ))}
              </div>
            )
          )
        ) : null}

      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} onClose={() => setToast(null)} />}
      {editItem && editKind && (
        <EditModal kind={editKind} item={editItem}
          onClose={() => setEditItem(null)}
          onSave={() => { setEditItem(null); fetchAll() }}
          onToast={(t, m) => showToast(t, m)} />
      )}
      {showNewRepair && (
        <NewRepairModal
          storeId={storeId}
          onClose={() => setShowNewRepair(false)}
          onSave={fetchAll}
          onToast={showToast}
        />
      )}
      {showNewOrder && (
        <NewOrderModal
          storeId={storeId}
          onClose={() => setShowNewOrder(false)}
          onSave={() => { setShowNewOrder(false); fetchAll() }}
          onToast={showToast}
        />
      )}
      <BottomNav />
    </div>
  )
}
