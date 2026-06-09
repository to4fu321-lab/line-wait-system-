'use client'

import { useState } from 'react'

// ============================================================
// PIN認証画面
// ============================================================
export function PinScreen({ storeName, storePin, storeId, onAuth, onBack }: {
  storeName: string; storePin: string; storeId: string; onAuth: () => void; onBack: () => void
}) {
  const [pin, setPin]     = useState('')
  const [error, setError] = useState(false)

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d; setPin(next); setError(false)
    if (next.length === 4) {
      if (next === storePin) {
        sessionStorage.setItem('admin_auth', '1')
        // slip-ocr API のリクエスト認証用に一時保存（同一オリジン・タブのみ）
        sessionStorage.setItem(`admin_pin_${storeId}`, next)
        onAuth()
      } else {
        setTimeout(() => { setPin(''); setError(true) }, 400)
      }
    }
  }

  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center px-6 relative overflow-hidden">
      <div className="relative text-center mb-8 animate-fade-in">
        <div className="w-20 h-20 rounded-3xl bg-indigo-100 border border-indigo-200 flex items-center justify-center mx-auto mb-5 backdrop-blur-sm">
          <span className="text-4xl">🔒</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900">スタッフ専用</h1>
        <p className="text-indigo-600 font-bold mt-1 text-lg">{storeName}</p>
        <p className="text-gray-400 text-sm mt-1">PINを入力してください</p>
      </div>
      <div className="relative flex gap-4 mb-8">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${
            pin.length > i ? error ? 'bg-red-400 scale-110' : 'bg-indigo-500 scale-110 shadow-lg shadow-indigo-500/50' : 'bg-gray-200'
          }`} />
        ))}
      </div>
      {error && <p className="relative text-red-600 text-sm mb-4 font-medium animate-pulse">PINが違います</p>}
      <div className="relative grid grid-cols-3 gap-3 w-60">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button key={i} onClick={() => d === '⌫' ? setPin(p => p.slice(0,-1)) : d && handleDigit(d)}
            className={`h-15 py-4 rounded-2xl text-xl font-bold transition-all active:scale-90 ${
              d === '' ? 'invisible' : d === '⌫' ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' :
              'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-indigo-400'
            }`}>{d}</button>
        ))}
      </div>
      <button onClick={onBack} className="relative mt-8 text-gray-400 text-sm hover:text-gray-600 transition-colors">
        ← 店舗を選び直す
      </button>
    </div>
  )
}
