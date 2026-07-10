'use client'

import { useState, useRef } from 'react'
import {
  Loader2, X, AlertCircle, ScanLine,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { IntakeFormType } from './types'
import { INTAKE_OPTIONS } from './types'
import { Field } from '@/app/_components/Field'

// ============================================================
// 共通フィールドラベル
// ============================================================
// ============================================================
// 統合新規依頼受付フォーム
// ============================================================
export function NewIntakeForm({ customerId, childId, storeId, reservationUrl, onSaved, onCancel, defaultType }: {
  customerId: string; childId: string | null; storeId: string
  reservationUrl?: string | null
  onSaved: () => void; onCancel: () => void; defaultType?: IntakeFormType
}) {
  const [intakeType,  setIntakeType]  = useState<IntakeFormType>(defaultType ?? 'repair')
  const [itemName,    setItemName]    = useState('')
  const [content,     setContent]     = useState('')
  const [maker,       setMaker]       = useState('')
  const [slipNumber,  setSlipNumber]  = useState('')
  const [price,       setPrice]       = useState('')
  const [prepaid,     setPrepaid]     = useState(false)
  const [notes,       setNotes]       = useState('')
  const [desiredDate, setDesiredDate] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [scanLoading, setScanLoading] = useState(false)
  const barcodeInputRef = useRef<HTMLInputElement | null>(null)

  const opt = INTAKE_OPTIONS.find(o => o.value === intakeType) ?? INTAKE_OPTIONS[0]

  const handleBarcodeScan = async (file: File) => {
    setScanLoading(true)
    try {
      let barcode: string | null = null
      if ('BarcodeDetector' in window) {
        try {
          const bd = new (window as any).BarcodeDetector()
          const bitmap = await createImageBitmap(file)
          const codes = await bd.detect(bitmap)
          if (codes.length > 0) barcode = codes[0].rawValue
        } catch {}
      }
      if (!barcode) {
        const b64 = await new Promise<string>((res, rej) => {
          const reader = new FileReader()
          reader.onload = () => res((reader.result as string).split(',')[1])
          reader.onerror = rej; reader.readAsDataURL(file)
        })
        const resp = await fetch('/api/tag-scan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: b64, mimeType: file.type }),
        })
        const { ok, data: td } = await resp.json()
        if (ok && td) {
          barcode = td.barcode ?? null
          if (!barcode && td.item_name) {
            setItemName(td.item_name)
            if (td.price) setPrice(String(td.price))
            return
          }
        }
      }
      if (barcode) {
        const { data: prods } = await (supabase as any).from('school_products')
          .select('item_name, school_product_variants(price, sort_order)')
          .eq('store_id', storeId).eq('barcode', barcode).eq('active', true).limit(1)
        if (prods?.[0]) {
          const p = prods[0]
          setItemName(p.item_name); setError(null)
          const v = ((p.school_product_variants ?? []) as any[]).sort((a: any, b: any) => a.sort_order - b.sort_order)
          if (v[0]?.price) setPrice(String(v[0].price))
        } else {
          setError(`バーコード「${barcode}」に一致する商品がマスタに登録されていません`)
        }
      } else {
        setError('バーコードが読み取れませんでした')
      }
    } catch (e) { setError(`スキャンエラー: ${String(e)}`) }
    finally { setScanLoading(false) }
  }

  const handleSave = async () => {
    if (!itemName.trim()) { setError('内容を入力してください'); return }
    if (intakeType === 'repair' && !content.trim()) { setError('お直し内容を入力してください'); return }
    setLoading(true); setError(null)
    if (opt.isPurchase) {
      const { error: err } = await (supabase as any).from('purchase_orders').insert({
        store_id: storeId, customer_id: customerId,
        child_id: childId ?? null,
        item_name: itemName.trim(),
        maker: maker.trim() || null,
        notes: notes.trim() || null,
        price: price ? parseInt(price) : null,
        status: 'ordered', ordered_date: new Date().toISOString().slice(0, 10),
      })
      setLoading(false)
      if (err) { setError(`保存失敗: ${err.message}`); return }
    } else {
      const { error: err } = await (supabase as any).from('repair_histories').insert({
        store_id: storeId, customer_id: customerId,
        child_id: childId ?? null,
        item_name: itemName.trim(), content: content.trim(),
        slip_number: slipNumber.trim() || null,
        price: price ? parseInt(price) : null,
        notes: notes.trim() || null,
        status: 'received', received_date: new Date().toISOString().slice(0, 10),
        request_type: intakeType,
        prepaid,
        desired_completion_date: desiredDate || null,
      })
      setLoading(false)
      if (err) { setError(`保存失敗: ${err.message}`); return }
    }
    onSaved()
  }

  const contentLabel =
    intakeType === 'repair'        ? 'お直し内容' :
    intakeType === 'repair_consult' ? '相談内容'   : '詳細'

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="p-4 space-y-3 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <p className="font-black text-gray-900 text-sm">依頼受付</p>
          <button onClick={onCancel} className="p-1 text-gray-500 hover:text-gray-900"><X size={16} /></button>
        </div>

        {/* 依頼タイプ選択 */}
        <div className="grid grid-cols-2 gap-1">
          {INTAKE_OPTIONS.map(o => (
            <button key={o.value} type="button"
              onClick={() => { setIntakeType(o.value); setError(null) }}
              className={`text-[11px] font-bold py-2 px-1 rounded-xl border transition-all ${
                intakeType === o.value
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                  : 'bg-gray-100 border-gray-300 text-gray-500'
              }`}>
              {o.label}
            </button>
          ))}
          {reservationUrl && (
            <a href={reservationUrl} target="_blank" rel="noopener noreferrer"
              className="text-[11px] font-bold py-2 px-1 rounded-xl border border-sky-300 bg-sky-50 text-sky-700 flex items-center justify-center">
              🗓️ 来店予約（外部）
            </a>
          )}
        </div>

        <Field label={opt.isPurchase ? '商品名' : '内容・商品名'} required>
          <div className="flex gap-2">
            <input type="text"
              className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
              placeholder={opt.ph_item} value={itemName}
              onChange={e => { setItemName(e.target.value); setError(null) }} />
            {opt.isPurchase && (
              <>
                <button type="button" onClick={() => barcodeInputRef.current?.click()} disabled={scanLoading}
                  title="バーコード・QRコードで商品を検索"
                  className="shrink-0 flex items-center gap-1 px-2.5 py-2 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-bold rounded-xl transition-all active:scale-95 disabled:opacity-60">
                  {scanLoading ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
                  {scanLoading ? '…' : 'スキャン'}
                </button>
                <input ref={barcodeInputRef} type="file" accept="image/*" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleBarcodeScan(f); e.target.value = '' }} />
              </>
            )}
          </div>
        </Field>

        {opt.isPurchase && (
          <Field label="メーカー">
            <input type="text"
              className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
              placeholder="例：カンコー、トンボ"
              value={maker} onChange={e => setMaker(e.target.value)} />
          </Field>
        )}

        {opt.showContent && (
          <Field label={contentLabel} required={intakeType === 'repair'}>
            <input type="text"
              className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
              placeholder={opt.ph_content} value={content}
              onChange={e => { setContent(e.target.value); setError(null) }} />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-2">
          {opt.showPrice && (
            <Field label="金額（円）">
              <input type="number" inputMode="numeric"
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
                placeholder="例：1200" value={price} onChange={e => setPrice(e.target.value)} />
            </Field>
          )}
          {opt.showSlip && (
            <Field label="伝票番号">
              <input type="text"
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm font-mono focus:border-indigo-500 focus:outline-none placeholder-gray-400"
                placeholder="例：001" value={slipNumber} onChange={e => setSlipNumber(e.target.value)} />
            </Field>
          )}
        </div>

        {opt.showDate && (
          <Field label="希望完了日">
            <div className="space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { label: '1週間後', days: 7 },
                  { label: '2週間後', days: 14 },
                  { label: '1ヶ月後', days: 30 },
                ].map(({ label, days }) => {
                  const d = new Date(); d.setDate(d.getDate() + days)
                  const val = d.toISOString().slice(0, 10)
                  return (
                    <button key={days} type="button"
                      onClick={() => setDesiredDate(val)}
                      className={`text-xs px-3 py-1.5 rounded-xl border font-bold transition-all ${
                        desiredDate === val
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                      }`}>
                      {label}
                    </button>
                  )
                })}
                {desiredDate && (
                  <button type="button" onClick={() => setDesiredDate('')}
                    className="text-xs px-2 py-1.5 rounded-xl border border-gray-300 text-gray-400 hover:bg-gray-100">
                    クリア
                  </button>
                )}
              </div>
              <input type="date" value={desiredDate} onChange={e => setDesiredDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none" />
            </div>
          </Field>
        )}

        {opt.showPrepaid && (
          <button type="button" onClick={() => setPrepaid(v => !v)}
            className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
              prepaid ? 'border-emerald-500 bg-emerald-500/10' : 'border-red-400 bg-red-50'
            }`}>
            <div className="text-left">
              <p className={`font-bold text-sm ${prepaid ? 'text-emerald-700' : 'text-red-700'}`}>
                {prepaid ? '✅ 支払済み' : '⚠️ 未払い'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">受付時に支払いを頂いた場合は「支払済み」に</p>
            </div>
            <div className={`w-12 h-6 rounded-full transition-colors shrink-0 ${prepaid ? 'bg-emerald-500' : 'bg-gray-300'}`}>
              <div className={`w-5 h-5 bg-white rounded-full mt-0.5 shadow-lg transition-transform ${prepaid ? 'translate-x-6' : 'translate-x-0.5'}`} />
            </div>
          </button>
        )}

        <Field label="メモ">
          <input type="text"
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
            placeholder="スタッフへの申し送り等" value={notes} onChange={e => setNotes(e.target.value)} />
        </Field>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            <AlertCircle size={13} />{error}
          </div>
        )}
        <button onClick={handleSave} disabled={loading}
          className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
          {loading ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '受付として登録する'}
        </button>
      </div>
    </div>
  )
}
