'use client'

import { Printer, X } from 'lucide-react'
import { fmtDate } from './utils'

// 外注業者へそのまま渡せる依頼書。上代・金額は一切含めない。
export interface PrintableRepair {
  reqNo: string
  garmentName: string
  itemName: string
  content: string
  schoolName: string | null
  childName: string | null
  customerName: string
  receivedDate: string
  desiredDate: string | null
  vendorName: string | null
  memo: string | null
  hemLengthMm: number | null
  sleeveAdjustMm: number | null
  waistAdjustMm: number | null
  embroideryText: string | null
  embroideryColor: string | null
  embroideryPos: string | null
}

function DetailLines({ item }: { item: PrintableRepair }) {
  const lines: string[] = []
  if (item.hemLengthMm)     lines.push(`裾上げ ${item.hemLengthMm > 0 ? '+' : ''}${item.hemLengthMm}mm`)
  if (item.sleeveAdjustMm)  lines.push(`袖丈 ${item.sleeveAdjustMm > 0 ? '+' : ''}${item.sleeveAdjustMm}mm`)
  if (item.waistAdjustMm)   lines.push(`ウエスト ${item.waistAdjustMm > 0 ? '+' : ''}${item.waistAdjustMm}mm`)
  if (item.embroideryText)  lines.push(`刺繍「${item.embroideryText}」${[item.embroideryColor, item.embroideryPos].filter(Boolean).join(' / ')}`)
  if (lines.length === 0) return null
  return (
    <div className="mt-1 space-y-0.5">
      {lines.map((l, i) => <p key={i} className="text-sm font-bold text-gray-800">・{l}</p>)}
    </div>
  )
}

function Slip({ item, storeName }: { item: PrintableRepair; storeName: string }) {
  return (
    <div className="border-b-2 border-dashed border-gray-300 py-5 break-inside-avoid last:border-0">
      <div className="flex items-center justify-between mb-3">
        <p className="font-black text-lg">{storeName || 'お店'}　お直し依頼書</p>
        <p className="font-mono font-black text-lg">{item.reqNo}</p>
      </div>
      <div className="border-t border-gray-300 pt-3 space-y-2">
        <div className="flex justify-between text-sm text-gray-500">
          <span>受付日: {fmtDate(item.receivedDate)}</span>
          {item.desiredDate && <span>仕上がり希望: {fmtDate(item.desiredDate)}</span>}
        </div>
        {item.schoolName && <p className="text-sm font-bold text-gray-600">{item.schoolName}</p>}
        <p className="text-base font-bold text-gray-900">
          {item.childName ?? item.customerName} 様
          {item.childName && item.childName !== item.customerName && (
            <span className="text-xs text-gray-400 font-normal ml-1">（保護者: {item.customerName}）</span>
          )}
        </p>
        <div className="border-t border-gray-200 pt-2">
          <p className="text-xs font-bold text-gray-400">{item.garmentName}</p>
          <p className="text-xl font-black text-gray-900 leading-snug">{item.content || item.itemName}</p>
          <DetailLines item={item} />
        </div>
        {item.vendorName ? (
          <p className="text-sm font-bold text-orange-700">外注先: {item.vendorName}</p>
        ) : (
          <p className="text-sm text-gray-500">外注先: <span className="inline-block border-b border-gray-400 w-40 align-bottom">&nbsp;</span></p>
        )}
        {item.memo && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            <p className="text-xs font-bold text-gray-400 mb-0.5">メモ</p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{item.memo}</p>
          </div>
        )}

        {/* 外注業者記入欄: 受領・作業完了のチェックとサイン */}
        <div className="border-2 border-gray-400 rounded-lg px-3 py-3 mt-2">
          <p className="text-xs font-bold text-gray-500 mb-2">外注業者様 記入欄</p>
          <div className="space-y-2.5 text-sm text-gray-800">
            <div className="flex items-baseline gap-2">
              <span>□ 受領しました　　日付：　　　／　　／　　</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span>□ 作業完了しました　日付：　　　／　　／　　</span>
            </div>
            <div className="flex items-baseline gap-2 pt-1">
              <span className="shrink-0">サイン・印：</span>
              <span className="flex-1 border-b border-gray-400 h-5" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function RepairPrintModal({ items, storeName, onClose }: {
  items: PrintableRepair[]; storeName: string; onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-[80] bg-black/50 flex items-end sm:items-center justify-center print:bg-white print:static" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[92dvh] flex flex-col print:max-h-none print:rounded-none print:w-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0 print:hidden">
          <h2 className="text-lg font-black text-gray-800">🖨️ 印刷プレビュー</h2>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold active:scale-95">
              <Printer size={15} />印刷する
            </button>
            <button onClick={onClose} className="p-2 bg-gray-100 hover:bg-gray-200 rounded-xl">
              <X size={18} className="text-gray-600" />
            </button>
          </div>
        </div>
        <p className="px-5 pt-3 text-[11px] text-gray-400 print:hidden">価格は印刷されません。商品に添付して外注先へお渡しいただけます。</p>
        <div id="repair-print" className="flex-1 overflow-y-auto px-5 py-4 bg-white text-gray-900">
          {items.length === 0 && <p className="text-center text-sm text-gray-400 py-8">印刷する内容がありません</p>}
          {items.map((it, i) => <Slip key={i} item={it} storeName={storeName} />)}
        </div>
      </div>
      <style>{`@media print {
        body * { visibility: hidden !important }
        #repair-print, #repair-print * { visibility: visible !important }
        #repair-print {
          position: absolute; left: 0; top: 0; width: 100%; padding: 12mm;
          background: #fff !important; color: #000 !important;
        }
      }`}</style>
    </div>
  )
}
