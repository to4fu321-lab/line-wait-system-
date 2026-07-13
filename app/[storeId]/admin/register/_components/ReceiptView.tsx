'use client'

// ============================================================
// レシート / 領収書 表示（印刷対象 DOM: id="receipt-print"）
//   POS会計直後・取引履歴からの再発行の両方で使用。
//   領収書はインボイス（適格請求書）対応:
//     宛名・但し書き・登録番号・税率別内訳を表示する。
// ============================================================

import { lineTotal, PAYMENT_METHOD_LABELS, type ReceiptData } from '@/types/sales'

const yen = (n: number) => `¥${Math.round(n).toLocaleString()}`

type Props = {
  storeName: string
  invoiceNumber: string | null   // インボイス登録番号（stores.invoice_number）
  kind: 'receipt' | 'invoice'
  data: ReceiptData
  receiptName: string            // 宛名（invoice時のみ表示）
  receiptNote: string            // 但し書き（invoice時のみ表示）
}

export function ReceiptView({ storeName, invoiceNumber, kind, data, receiptName, receiptNote }: Props) {
  const gross = data.total + data.discount // 値引き前（税込）
  return (
    <div id="receipt-print" className="max-w-sm mx-auto w-full p-5 bg-white text-gray-900" style={{ fontFamily: 'monospace' }}>
      <div className="text-center mb-4">
        <p className="font-black text-lg">{storeName || 'お店'}</p>
        <p className="text-sm text-gray-500">{kind === 'invoice' ? '領収書' : 'レシート'}</p>
        {invoiceNumber && <p className="text-[10px] text-gray-400 mt-0.5">登録番号: {invoiceNumber}</p>}
      </div>

      {kind === 'invoice' && (
        <div className="mb-3">
          <p className="text-base font-bold border-b border-gray-300 pb-1">
            {receiptName.trim() ? `${receiptName.trim()} 様` : '上様'}
          </p>
          <p className="text-2xl font-black text-center my-3">{yen(data.total)} −</p>
          <p className="text-xs">但し {receiptNote.trim() || 'お品代'} として</p>
          <p className="text-xs text-gray-500 mt-1">上記正に領収いたしました</p>
        </div>
      )}

      <p className="text-xs text-gray-400 mb-1">{data.saleNumber}</p>
      <p className="text-xs text-gray-400 mb-3">{data.createdAt.toLocaleString('ja-JP')}</p>
      <div className="border-t border-dashed my-3" />

      {data.lines.map(l => (
        <div key={l.key} className="flex justify-between text-sm py-0.5">
          <span className="truncate pr-2">{l.name}{l.qty > 1 ? ` ×${l.qty}` : ''}</span>
          <span className="shrink-0">{yen(lineTotal(l))}</span>
        </div>
      ))}
      {data.discount > 0 && (
        <div className="flex justify-between text-sm py-0.5">
          <span>値引き</span><span>-{yen(data.discount)}</span>
        </div>
      )}
      <div className="border-t border-dashed my-3" />

      <div className="space-y-1 text-sm">
        {data.discount > 0 && (
          <div className="flex justify-between text-gray-500"><span>値引き前合計</span><span>{yen(gross)}</span></div>
        )}
        <div className="flex justify-between text-gray-500"><span>小計（税抜）</span><span>{yen(data.subtotal)}</span></div>
        <div className="flex justify-between text-gray-500"><span>消費税（{data.taxRate}%）</span><span>{yen(data.tax)}</span></div>
        <div className="flex justify-between font-black text-base mt-1"><span>合計</span><span>{yen(data.total)}</span></div>
        {/* インボイス: 税率別内訳（本システムは単一税率のため1行） */}
        <div className="flex justify-between text-[11px] text-gray-400">
          <span>（{data.taxRate}%対象 {yen(data.total)} 内消費税 {yen(data.tax)}）</span><span />
        </div>
        <div className="flex justify-between"><span>{PAYMENT_METHOD_LABELS[data.payment]}</span><span>{data.cashReceived != null ? yen(data.cashReceived) : ''}</span></div>
        {data.change != null && <div className="flex justify-between"><span>おつり</span><span>{yen(data.change)}</span></div>}
      </div>
      <p className="text-center text-xs text-gray-400 mt-6">ありがとうございました</p>
    </div>
  )
}

// 印刷用スタイル（80mm レシートロール想定）
export function ReceiptPrintStyle() {
  return (
    <style>{`@media print {
      body * { visibility: hidden !important }
      #receipt-print, #receipt-print * { visibility: visible !important }
      #receipt-print {
        position: absolute; left: 0; top: 0; width: 80mm;
        background: #fff !important; color: #000 !important;
        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
      }
    }`}</style>
  )
}
