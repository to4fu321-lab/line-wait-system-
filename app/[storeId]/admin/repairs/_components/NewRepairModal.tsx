'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Loader2, ChevronDown, ChevronLeft, ChevronRight,
  User, Check, X, Search, Camera, ScanLine, Plus,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import {
  REPAIR_TYPE_LABELS, REPAIR_TYPE_ICONS, REPAIR_TYPE_COLORS,
} from '@/types/crm'
import type { RepairType } from '@/types/crm'
import { compressImage } from './utils'
import { REPAIR_TYPES_DEF, DEFAULT_REPAIR_CATS, CAT_ICON_COLORS } from './constants'
import { getCatIcon } from './utils'
import type { CustResult } from './types'

export function NewRepairModal({ storeId, onClose, onSave, onToast, showOcr = true }: {
  storeId: string; onClose: () => void; onSave: () => void
  onToast: (t: 'ok' | 'err', m: string) => void
  showOcr?: boolean
}) {
  type Step = 'type' | 'ocr_confirm' | 'cat_repair' | 'details' | 'customer'
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
  const [selectedCategoryId,   setSelectedCategoryId]   = useState<string | null>(null)
  const [selectedCategoryName, setSelectedCategoryName] = useState<string>('')
  const [categories,     setCategories] = useState<{ id: string; name: string }[]>([])
  const [ocrLoading,      setOcrLoading]      = useState(false)
  const [ocrWarnings,     setOcrWarnings]     = useState<string[]>([])
  const [ocrConfidence,   setOcrConfidence]   = useState<'high' | 'medium' | 'low' | null>(null)
  const [ocrCustomerName, setOcrCustomerName] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleOcrRepair = async (file: File) => {
    setOcrLoading(true); setOcrWarnings([])
    try {
      const base64 = await compressImage(file)
      const res = await fetch('/api/slip-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType: 'image/jpeg', slipType: 'repair' }),
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
      if (data.customer_name)    setOcrCustomerName(data.customer_name)
      if (data.warnings?.length) setOcrWarnings(data.warnings)
      setOcrConfidence(data.confidence ?? null)

      setStep('ocr_confirm')
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
      const q = custSearch.trim()
      const qTel = q.replace(/[-\s]/g, '')
      const { data } = await (supabase as any)
        .from('customers')
        .select('id, name, tel, school_name, children:children(id, name, school_name)')
        .eq('store_id', storeId)
        .or(`name.ilike.%${q}%,kana.ilike.%${q}%,tel.ilike.%${q}%,tel.ilike.%${qTel}%,school_name.ilike.%${q}%`)
        .is('deleted_at', null).limit(8)
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

  // DBカテゴリがあればそれのみ使用、なければデフォルト表示
  const displayCats = useMemo(() => {
    if (categories.length > 0) {
      return categories.map(c => ({ id: c.id, name: c.name, icon: getCatIcon(c.name) }))
    }
    return DEFAULT_REPAIR_CATS.map(dc => ({ id: null as string | null, name: dc.name as string, icon: dc.icon }))
  }, [categories])

  const stepLabels: Record<Step, string> = { type: 'アイテム選択', ocr_confirm: '読み取り確認・修正', cat_repair: 'お直し選択', details: '内容入力', customer: '顧客選択' }
  const steps: Step[] = ['type', 'cat_repair', 'details', 'customer']

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '92dvh', paddingBottom: 'env(safe-area-inset-bottom)' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleOcrRepair(f); e.target.value = '' }} />
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => {
                if (step === 'type') onClose()
                else if (step === 'ocr_confirm') {
                  setStep('type')
                  setOcrConfidence(null); setOcrWarnings([]); setOcrCustomerName('')
                  setRepairType(null); setItemName(''); setHemMm(0); setSleeveMm(0); setWaistMm(0)
                  setContent(''); setPrice(''); setDeadline(''); setMemo('')
                }
                else if (step === 'cat_repair') { setStep('type'); setPresets([]); setSelectedCategoryId(null); setSelectedCategoryName('') }
                else if (step === 'details') setStep(ocrConfidence ? 'ocr_confirm' : selectedCategoryName ? 'cat_repair' : 'type')
                else if (step === 'customer') setStep('details')
              }}
              className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 active:scale-95 transition-all">
              {step === 'type' ? <X size={18} /> : <ChevronLeft size={18} />}
            </button>
            <h2 className="flex-1 text-base font-black text-gray-900">
              {step === 'type' ? '✂️ お直し受付'
               : step === 'cat_repair' ? `${displayCats.find(c => c.name === selectedCategoryName)?.icon ?? '📦'} ${selectedCategoryName}`
               : step === 'details' && repairType ? `${REPAIR_TYPE_ICONS[repairType]} ${REPAIR_TYPE_LABELS[repairType]}`
               : '👤 顧客選択'}
            </h2>
            {/* OCR ボタン */}
            {showOcr && (
              <button onClick={() => fileInputRef.current?.click()} disabled={ocrLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-60 shrink-0">
                {ocrLoading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                {ocrLoading ? '解析中...' : '伝票読取'}
              </button>
            )}
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

          {/* OCR 警告バナー（確認画面以外のステップで表示） */}
          {ocrWarnings.length > 0 && step !== 'ocr_confirm' && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl px-4 py-3 space-y-1">
              <p className="text-xs font-black text-amber-700 flex items-center gap-1.5"><ScanLine size={13} />読み取り確認が必要な箇所</p>
              {ocrWarnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-600 pl-4">・{w}</p>
              ))}
            </div>
          )}

          {/* ── Step OCR確認: 読み取り結果の確認・修正 ── */}
          {step === 'ocr_confirm' && (
            <div className="space-y-4">

              {/* 精度バッジ */}
              <div className={`rounded-2xl px-4 py-3 flex items-center gap-3 ${
                ocrConfidence === 'high' ? 'bg-emerald-50 border border-emerald-200' :
                ocrConfidence === 'low'  ? 'bg-red-50 border border-red-200' :
                'bg-amber-50 border border-amber-200'
              }`}>
                <span className="text-2xl">
                  {ocrConfidence === 'high' ? '✅' : ocrConfidence === 'low' ? '🔍' : '⚠️'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-black ${
                    ocrConfidence === 'high' ? 'text-emerald-700' :
                    ocrConfidence === 'low'  ? 'text-red-700' : 'text-amber-700'
                  }`}>
                    読み取り精度: {ocrConfidence === 'high' ? '高' : ocrConfidence === 'medium' ? '中' : '低'}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    {ocrConfidence === 'high' ? 'すべての項目が明確に読み取れました' :
                     ocrConfidence === 'low'  ? '手書きが不鮮明のため内容をご確認ください' :
                     '一部推測が含まれます。太字の項目を重点的にご確認ください'}
                  </p>
                </div>
              </div>

              {/* 抽出結果フォーム */}
              <div className="space-y-3.5">

                {/* お直し種別 */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1.5">
                    お直し種別 <span className="text-red-500">*必須</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {REPAIR_TYPES_DEF.map(t => (
                      <button key={t.type} onClick={() => setRepairType(t.type as RepairType)}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold border-2 transition-all active:scale-95 ${
                          repairType === t.type
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'
                        }`}>
                        <span>{t.icon}</span>{t.label}
                      </button>
                    ))}
                  </div>
                  {!repairType && <p className="text-[10px] text-red-500 mt-1.5">⚠️ 伝票から読み取れませんでした。選択してください</p>}
                </div>

                {/* 品名 */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">品名</label>
                  <input type="text" value={itemName} onChange={e => setItemName(e.target.value)}
                    placeholder="例: スラックス 165A"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none bg-white shadow-sm" />
                </div>

                {/* 種別ごとの主要フィールド */}
                {repairType === 'hem' && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">裾上げ量</label>
                    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                      <button onClick={() => setHemMm(hemMm - 5)} className="w-9 h-9 rounded-lg bg-gray-100 font-black text-gray-700 text-lg flex items-center justify-center active:scale-95">−</button>
                      <p className={`flex-1 text-center text-2xl font-black ${hemMm !== 0 ? 'text-amber-600' : 'text-gray-300'}`}>{hemMm > 0 ? '+' : ''}{hemMm}mm</p>
                      <button onClick={() => setHemMm(hemMm + 5)} className="w-9 h-9 rounded-lg bg-gray-100 font-black text-gray-700 text-lg flex items-center justify-center active:scale-95">＋</button>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {[-30,-25,-20,-15,-10,-5,5,10,15,20,25,30].map(v => (
                        <button key={v} onClick={() => setHemMm(v)}
                          className={`flex-1 min-w-[calc(16.6%-4px)] py-1 rounded-lg text-[11px] font-bold border transition-all ${hemMm === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                          {v > 0 ? '+' : ''}{v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {repairType === 'sleeve' && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">袖丈調整量</label>
                    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                      <button onClick={() => setSleeveMm(sleeveMm - 5)} className="w-9 h-9 rounded-lg bg-gray-100 font-black text-gray-700 text-lg flex items-center justify-center active:scale-95">−</button>
                      <p className={`flex-1 text-center text-2xl font-black ${sleeveMm !== 0 ? 'text-blue-600' : 'text-gray-300'}`}>{sleeveMm > 0 ? '+' : ''}{sleeveMm}mm</p>
                      <button onClick={() => setSleeveMm(sleeveMm + 5)} className="w-9 h-9 rounded-lg bg-gray-100 font-black text-gray-700 text-lg flex items-center justify-center active:scale-95">＋</button>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {[-30,-25,-20,-15,-10,-5,5,10,15,20,25,30].map(v => (
                        <button key={v} onClick={() => setSleeveMm(v)}
                          className={`flex-1 min-w-[calc(16.6%-4px)] py-1 rounded-lg text-[11px] font-bold border transition-all ${sleeveMm === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                          {v > 0 ? '+' : ''}{v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {repairType === 'waist' && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">ウエスト調整量</label>
                    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
                      <button onClick={() => setWaistMm(waistMm - 5)} className="w-9 h-9 rounded-lg bg-gray-100 font-black text-gray-700 text-lg flex items-center justify-center active:scale-95">−</button>
                      <p className={`flex-1 text-center text-2xl font-black ${waistMm !== 0 ? 'text-purple-600' : 'text-gray-300'}`}>{waistMm > 0 ? '+' : ''}{waistMm}mm</p>
                      <button onClick={() => setWaistMm(waistMm + 5)} className="w-9 h-9 rounded-lg bg-gray-100 font-black text-gray-700 text-lg flex items-center justify-center active:scale-95">＋</button>
                    </div>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {[-30,-25,-20,-15,-10,-5,5,10,15,20,25,30].map(v => (
                        <button key={v} onClick={() => setWaistMm(v)}
                          className={`flex-1 min-w-[calc(16.6%-4px)] py-1 rounded-lg text-[11px] font-bold border transition-all ${waistMm === v ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600 hover:border-indigo-300'}`}>
                          {v > 0 ? '+' : ''}{v}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {repairType === 'embroidery' && (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">刺繍文字</label>
                      <input type="text" value={embText} onChange={e => setEmbText(e.target.value)}
                        placeholder="例: 田中　花子"
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none bg-white shadow-sm" />
                    </div>
                    <div className="flex gap-1.5">
                      {['黒', '白', '紺', '指定'].map(c => (
                        <button key={c} onClick={() => setEmbColor(c)}
                          className={`flex-1 py-2 rounded-xl text-xs font-bold border-2 transition-all ${embColor === c ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white border-gray-200 text-gray-600'}`}>
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {repairType && !['hem', 'sleeve', 'waist', 'embroidery'].includes(repairType) && (
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">お直し内容</label>
                    <input type="text" value={content} onChange={e => setContent(e.target.value)}
                      placeholder="例: 右ひざほつれ修理"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none bg-white shadow-sm" />
                  </div>
                )}

                {/* 希望完了日・金額 */}
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">希望完了日</label>
                    <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none bg-white shadow-sm" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">金額（税込）</label>
                    <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="未読み取り"
                      className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none bg-white shadow-sm" />
                  </div>
                </div>

                {/* 顧客名（OCR読み取り） */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">読み取った顧客名</label>
                  <div className="relative">
                    <User size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" value={ocrCustomerName} onChange={e => setOcrCustomerName(e.target.value)}
                      placeholder="未読み取り"
                      className="w-full pl-8 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none bg-white shadow-sm" />
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">次ステップの顧客検索に自動入力されます</p>
                </div>

                {/* スタッフメモ */}
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-1">スタッフメモ</label>
                  <input type="text" value={internalMemo} onChange={e => setMemo(e.target.value)}
                    placeholder="未読み取り"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none bg-white shadow-sm" />
                </div>
              </div>

              {/* 要確認ウォーニング */}
              {ocrWarnings.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 space-y-1">
                  <p className="text-xs font-black text-amber-700 flex items-center gap-1.5">
                    <ScanLine size={12} />要確認 ({ocrWarnings.length}箇所)
                  </p>
                  {ocrWarnings.map((w, i) => <p key={i} className="text-xs text-amber-600 pl-4">・{w}</p>)}
                </div>
              )}

              {/* アクションボタン */}
              <div className="flex gap-2.5">
                <button onClick={() => fileInputRef.current?.click()} disabled={ocrLoading}
                  className="flex items-center gap-1.5 px-4 py-3.5 border-2 border-gray-200 text-gray-600 text-sm font-bold rounded-2xl hover:bg-gray-50 active:scale-95 transition-all disabled:opacity-50 shrink-0">
                  {ocrLoading ? <Loader2 size={13} className="animate-spin" /> : <Camera size={13} />}
                  再撮影
                </button>
                <button
                  onClick={() => {
                    if (ocrCustomerName) setCustSearch(ocrCustomerName)
                    setStep('details')
                  }}
                  disabled={!repairType}
                  className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40 shadow-lg shadow-indigo-500/25">
                  <Check size={16} />
                  {repairType ? '確認OK・詳細フォームへ' : '種別を選択してください'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 1: 服種選択 ── */}
          {step === 'type' && (
            <div className="space-y-2">
              {displayCats.map((cat, i) => (
                <button key={cat.name}
                  onClick={() => { setSelectedCategoryId(cat.id); setSelectedCategoryName(cat.name); setStep('cat_repair') }}
                  className="w-full flex items-center gap-4 px-4 py-3.5 bg-white rounded-2xl shadow-sm border border-gray-100 hover:border-indigo-200 hover:shadow-md active:scale-[0.98] transition-all text-left">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl shrink-0 ${CAT_ICON_COLORS[i % CAT_ICON_COLORS.length]}`}>
                    {cat.icon}
                  </div>
                  <span className="flex-1 text-base font-bold text-gray-800">{cat.name}</span>
                  <ChevronRight size={18} className="text-gray-300 shrink-0" />
                </button>
              ))}
              <div className="pt-2">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-2">服種以外のお直し</p>
                <div className="grid grid-cols-4 gap-2">
                  {REPAIR_TYPES_DEF.map(t => (
                    <button key={t.type}
                      onClick={() => { setRepairType(t.type); setSelectedCategoryId(null); setSelectedCategoryName(''); setStep('details') }}
                      className="flex flex-col items-center gap-1.5 py-3 rounded-xl bg-white border border-gray-200 hover:border-gray-300 hover:shadow-sm active:scale-95 transition-all font-bold text-gray-600">
                      <span className="text-xl">{t.icon}</span>
                      <span className="text-[10px] leading-tight text-center">{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 1b: カテゴリ内お直し選択（フラット一覧） ── */}
          {step === 'cat_repair' && selectedCategoryName && (
            <div className="space-y-3">
              {presets.length === 0 ? (
                <div className="text-center py-10">
                  <span className="text-4xl block mb-3">✂️</span>
                  <p className="text-sm text-gray-400 font-bold">プリセットが未登録です</p>
                  <p className="text-xs text-gray-300 mt-1">マスタページで料金を登録してください</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {presets.map(p => {
                    const icon = REPAIR_TYPE_ICONS[(p.repair_type ?? 'other') as RepairType] ?? '✂️'
                    return (
                      <button key={p.id}
                        onClick={() => {
                          setRepairType((p.repair_type ?? 'other') as RepairType)
                          setItemName(p.item_name)
                          if (p.default_price != null) setPrice(String(p.default_price))
                          setStep('details')
                        }}
                        className="flex flex-col items-start gap-2 px-4 py-5 bg-white hover:bg-indigo-50 border-2 border-gray-200 hover:border-indigo-300 rounded-2xl text-left transition-all active:scale-95 shadow-sm min-h-[88px]">
                        <span className="text-2xl leading-none">{icon}</span>
                        <div className="w-full">
                          <p className="text-sm font-bold text-gray-800 leading-snug">{p.item_name}</p>
                          {p.default_price != null && (
                            <p className="text-base font-black text-indigo-600 mt-0.5">¥{p.default_price.toLocaleString()}</p>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
              {/* その他（種別直接指定） */}
              <div className="border-t border-gray-100 pt-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">この服種のその他のお直し</p>
                <div className="grid grid-cols-3 gap-2">
                  {REPAIR_TYPES_DEF.map(t => (
                    <button key={t.type}
                      onClick={() => { setRepairType(t.type as RepairType); setStep('details') }}
                      className={`flex flex-col items-center gap-1.5 py-3.5 rounded-2xl border-2 font-bold text-xs transition-all active:scale-95 ${t.color}`}>
                      <span className="text-2xl">{t.icon}</span>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

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
                    <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-4 text-center space-y-3">
                      <p className="text-xs font-black text-indigo-800">お客様にQRを読み取ってもらってください</p>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=10&data=${encodeURIComponent(`https://liff.line.me/${process.env.NEXT_PUBLIC_LIFF_ID || ''}/${storeId}`)}`}
                        alt="受付QR" width={200} height={200}
                        className="mx-auto rounded-xl bg-white p-1 shadow-sm"
                      />
                      <p className="text-[10px] text-indigo-500 leading-relaxed">
                        LINEで登録後、上の検索欄でお名前を検索してください
                      </p>
                      <button onClick={() => setShowRegister(false)}
                        className="w-full py-2 text-xs font-bold text-gray-600 border border-gray-200 rounded-xl hover:bg-white active:scale-[0.98]">
                        閉じる
                      </button>
                    </div>
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
