'use client'

// ============================================================
// 値札（バーコードラベル）印刷
//   商品マスタの barcode から JAN/CODE128 バーコード画像を生成し、
//   A4用紙に 2列×5段（105×59.4mm 目安）で面付けして印刷する。
//   バーコード生成: jsbarcode（動的import）
// ============================================================

import { useState, useEffect, useMemo } from 'react'
import { X, Printer, Tag, Minus, Plus } from 'lucide-react'
import type { ProductMaster } from '@/types/master'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

type Props = {
  storeName?: string
  products: ProductMaster[]
  onClose: () => void
}

// 13桁/8桁の数字は EAN として描画を試み、失敗（チェックデジット不正等）は CODE128 に落とす
function barcodeFormat(code: string): 'EAN13' | 'EAN8' | 'CODE128' {
  if (/^\d{13}$/.test(code)) return 'EAN13'
  if (/^\d{8}$/.test(code)) return 'EAN8'
  return 'CODE128'
}

export function LabelPrintModal({ storeName, products, onClose }: Props) {
  const withCode = useMemo(() => products.filter(p => (p.barcode ?? '').trim()), [products])
  const [qtyMap, setQtyMap] = useState<Record<string, number>>({})

  const setQty = (id: string, qty: number) =>
    setQtyMap(m => {
      const next = { ...m }
      if (qty <= 0) delete next[id]
      else next[id] = Math.min(99, qty)
      return next
    })

  // 印刷対象ラベル（数量分展開）
  const labels = useMemo(() => {
    const out: ProductMaster[] = []
    for (const p of withCode) {
      const q = qtyMap[p.id] ?? 0
      for (let i = 0; i < q; i++) out.push(p)
    }
    return out
  }, [withCode, qtyMap])

  // バーコード描画（ラベル構成が変わるたびに再描画）
  useEffect(() => {
    if (labels.length === 0) return
    let cancelled = false
    import('jsbarcode').then(({ default: JsBarcode }) => {
      if (cancelled) return
      document.querySelectorAll<SVGElement>('#label-print-root svg[data-code]').forEach(el => {
        const code = el.getAttribute('data-code') ?? ''
        const tryFormats: ('EAN13' | 'EAN8' | 'CODE128')[] =
          barcodeFormat(code) === 'CODE128' ? ['CODE128'] : [barcodeFormat(code), 'CODE128']
        for (const format of tryFormats) {
          try {
            JsBarcode(el, code, {
              format, width: 2, height: 44, margin: 0,
              displayValue: true, fontSize: 12, textMargin: 1,
            })
            break
          } catch { /* チェックデジット不正など → 次の形式(CODE128)で再試行 */ }
        }
      })
    })
    return () => { cancelled = true }
  }, [labels])

  const handlePrint = () => {
    if (labels.length === 0) return
    window.print()
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b flex items-center gap-2">
          <Tag size={18} className="text-indigo-500" />
          <div className="flex-1">
            <p className="font-black text-gray-900">値札（バーコード）印刷</p>
            <p className="text-[11px] text-gray-400">A4に2列×5段で印刷します。枚数を選んでください</p>
          </div>
          <button onClick={onClose} className="p-1 text-gray-400"><X size={22} /></button>
        </div>

        <div className="p-4 space-y-1.5 overflow-y-auto flex-1">
          {withCode.length === 0 && (
            <p className="text-center text-xs text-gray-400 py-8">
              バーコードが登録された商品がありません。<br />商品の編集画面でバーコードを登録してください。
            </p>
          )}
          {withCode.map(p => {
            const q = qtyMap[p.id] ?? 0
            return (
              <div key={p.id} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border ${q > 0 ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{p.name}</p>
                  <p className="text-[10px] text-gray-400 truncate">{p.barcode}{p.base_price_tax_in != null ? ` ・ ${yen(p.base_price_tax_in)}` : ''}</p>
                </div>
                <button onClick={() => setQty(p.id, q - 1)} disabled={q <= 0}
                  className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center disabled:opacity-30"><Minus size={14} /></button>
                <span className="w-8 text-center font-black text-gray-900">{q}</span>
                <button onClick={() => setQty(p.id, q + 1)}
                  className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center"><Plus size={14} /></button>
              </div>
            )
          })}
        </div>

        <div className="p-4 border-t" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          <button onClick={handlePrint} disabled={labels.length === 0}
            className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-40">
            <Printer size={17} />{labels.length}枚を印刷する
          </button>
        </div>
      </div>

      {/* ── 印刷レイアウト（画面上は非表示・印刷時のみ可視） ── */}
      <div id="label-print-root" aria-hidden style={{ position: 'fixed', left: '-200vw', top: 0, width: '210mm', background: '#fff' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
          {labels.map((p, i) => (
            <div key={`${p.id}_${i}`} style={{
              width: '105mm', height: '59.4mm', boxSizing: 'border-box',
              padding: '5mm', border: '0.2mm dashed #ddd',
              display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              color: '#111', fontFamily: '"Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif',
            }}>
              <div>
                {storeName && <p style={{ fontSize: '8pt', color: '#888', margin: 0 }}>{storeName}</p>}
                <p style={{ fontSize: '12pt', fontWeight: 700, margin: '1mm 0 0', lineHeight: 1.25 }}>{p.name}</p>
                <p style={{ fontSize: '8pt', color: '#666', margin: '0.5mm 0 0' }}>
                  {[p.category, p.maker, p.maker_code].filter(Boolean).join(' ・ ')}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '4mm' }}>
                <svg data-code={p.barcode ?? ''} />
                {p.base_price_tax_in != null && (
                  <p style={{ fontSize: '16pt', fontWeight: 900, margin: 0, whiteSpace: 'nowrap' }}>
                    {yen(p.base_price_tax_in)}<span style={{ fontSize: '8pt', fontWeight: 700 }}>(税込)</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <style>{`@media print {
        body * { visibility: hidden !important; }
        #label-print-root, #label-print-root * { visibility: visible !important; }
        #label-print-root { position: absolute !important; left: 0 !important; top: 0 !important; }
        @page { size: A4 portrait; margin: 0; }
      }`}</style>
    </div>
  )
}
