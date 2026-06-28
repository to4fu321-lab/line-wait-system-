'use client'

import { X } from 'lucide-react'

interface Props {
  storeId: string
  onClose: () => void
  onSwitchStore?: () => void
}

export function QrRegistrationModal({ storeId, onClose, onSwitchStore }: Props) {
  const liffId = process.env.NEXT_PUBLIC_LIFF_ID || ''
  const url    = `https://liff.line.me/${liffId}/${storeId}`
  const qrSrc  = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(url)}`

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
      <div className="bg-white border border-gray-200 rounded-3xl p-6 w-full max-w-xs text-center relative shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-900 transition-colors"
        >
          <X size={16} />
        </button>
        <p className="font-black text-gray-900 text-base mb-1">お客様受付 QR</p>
        <p className="text-gray-500 text-xs mb-4">このQRをお客様のLINEで読み取ってもらってください</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrSrc}
          alt="受付QR"
          width={240}
          height={240}
          className="mx-auto rounded-2xl bg-white p-2"
        />
        {onSwitchStore && (
          <button
            onClick={onSwitchStore}
            className="mt-5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
          >
            店舗を切り替える
          </button>
        )}
      </div>
    </div>
  )
}
