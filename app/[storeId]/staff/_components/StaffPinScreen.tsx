'use client'

import { useState } from 'react'
import { applyStaffSession } from '@/lib/staffSessionClient'

// スタッフ個人PINで本人特定（/api/staff/verify でサーバ照合）
export function StaffPinScreen({ storeId, storeName, onAuth }: {
  storeId: string
  storeName: string
  onAuth: (staff: { id: string; name: string; role?: string | null; color?: string | null }) => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (value: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/staff/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, pin: value }),
      })
      const json = await res.json()
      if (!res.ok) { setTimeout(() => { setPin(''); setError(true); setBusy(false) }, 300); return }
      // 店舗スコープの Supabase Auth セッションを適用(シフト等の RLS 通過に必須)
      if (json.session) await applyStaffSession(json.session)
      onAuth(json.staff)
    } catch {
      setTimeout(() => { setPin(''); setError(true); setBusy(false) }, 300)
    }
  }

  const handleDigit = (d: string) => {
    if (pin.length >= 4 || busy) return
    const next = pin + d; setPin(next); setError(false)
    if (next.length === 4) submit(next)
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-3xl bg-indigo-100 border border-indigo-200 flex items-center justify-center mx-auto mb-5">
          <span className="text-4xl">📆</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900">シフト確認</h1>
        <p className="text-indigo-600 font-bold mt-1 text-lg">{storeName}</p>
        <p className="text-gray-400 text-sm mt-1">あなたのPIN（4桁）を入力してください</p>
      </div>
      <div className="flex gap-4 mb-8">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${
            pin.length > i ? error ? 'bg-red-400 scale-110' : 'bg-indigo-500 scale-110' : 'bg-gray-200'
          }`} />
        ))}
      </div>
      {error && <p className="text-red-600 text-sm mb-4 font-medium">PINが違います</p>}
      <div className="grid grid-cols-3 gap-3 w-60">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((d, i) => (
          <button key={i} disabled={busy} onClick={() => d === '⌫' ? setPin(p => p.slice(0, -1)) : d && handleDigit(d)}
            className={`h-15 py-4 rounded-2xl text-xl font-bold transition-all active:scale-90 disabled:opacity-50 ${
              d === '' ? 'invisible' : d === '⌫' ? 'bg-gray-100 text-gray-600' : 'bg-white border border-gray-200 text-gray-900 hover:border-indigo-400'
            }`}>{d}</button>
        ))}
      </div>
      <p className="text-gray-300 text-xs mt-8">店長から共有されたPINでログインできます</p>
    </div>
  )
}
