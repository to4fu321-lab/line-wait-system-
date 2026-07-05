'use client'

import { useState, type ReactNode } from 'react'
import { applyStaffSession, type StaffSessionTokens } from '@/lib/staffSessionClient'

// ============================================================
// PIN認証画面（共通コンポーネント）
//
// 正解PINを props で受け取らない。照合は verify コールバック
// （通常はサーバーAPI呼び出し）に委譲し、結果だけを受け取る。
//   verify: 成功時は任意の結果（role など）、失敗時は null を返す
// ============================================================
export function PinScreen<T>({
  title, subtitle, emoji = '🔒', dark = false, digits = 4,
  verify, onAuth, onBack, backLabel = '← 戻る', headerExtra,
}: {
  title: string
  subtitle?: string
  emoji?: string
  dark?: boolean
  digits?: number
  verify: (pin: string) => Promise<T | null>
  onAuth: (result: T) => void
  onBack?: () => void
  backLabel?: string
  headerExtra?: ReactNode
}) {
  const [pin,     setPin]     = useState('')
  const [error,   setError]   = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDigit = async (d: string) => {
    if (pin.length >= digits || loading) return
    const next = pin + d
    setPin(next)
    setError(false)
    if (next.length !== digits) return

    setLoading(true)
    try {
      const result = await verify(next)
      if (result !== null) { onAuth(result); return }
    } catch { /* 通信エラーも入力エラーと同扱い */ }
    setTimeout(() => { setPin(''); setError(true); setLoading(false) }, 400)
  }

  const c = dark
    ? {
        bg: 'bg-gray-800', iconBg: 'bg-gray-700 border-gray-600', title: 'text-white',
        subtitle: 'text-gray-400', dotOff: 'bg-gray-600', dotOn: 'bg-blue-400',
        key: 'bg-gray-700 text-white hover:bg-gray-600', del: 'bg-gray-700 text-gray-300',
        back: 'text-gray-400 hover:text-gray-200',
      }
    : {
        bg: 'bg-gray-50', iconBg: 'bg-indigo-100 border-indigo-200', title: 'text-gray-900',
        subtitle: 'text-gray-400', dotOff: 'bg-gray-200', dotOn: 'bg-indigo-500 shadow-lg shadow-indigo-500/50',
        key: 'bg-white border border-gray-200 text-gray-900 hover:bg-gray-50 hover:border-indigo-400',
        del: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
        back: 'text-gray-400 hover:text-gray-600',
      }

  return (
    <div className={`min-h-[100dvh] ${c.bg} flex flex-col items-center justify-center px-6 relative overflow-hidden`}>
      <div className="relative text-center mb-8 animate-fade-in">
        <div className={`w-20 h-20 rounded-3xl border ${c.iconBg} flex items-center justify-center mx-auto mb-5`}>
          <span className="text-4xl">{emoji}</span>
        </div>
        <h1 className={`text-2xl font-black ${c.title}`}>{title}</h1>
        {headerExtra}
        {subtitle && <p className={`${c.subtitle} text-sm mt-1`}>{subtitle}</p>}
        <p className={`${c.subtitle} text-sm mt-1`}>PINを入力してください</p>
      </div>
      <div className="relative flex gap-4 mb-8">
        {Array.from({ length: digits }, (_, i) => (
          <div key={i} className={`w-4 h-4 rounded-full transition-all duration-200 ${
            pin.length > i
              ? error ? 'bg-red-400 scale-110' : loading ? `${c.dotOn} animate-pulse scale-110` : `${c.dotOn} scale-110`
              : c.dotOff
          }`} />
        ))}
      </div>
      {loading && <p className="relative text-indigo-400 text-sm mb-4 font-medium">確認中...</p>}
      {error && <p className="relative text-red-500 text-sm mb-4 font-medium animate-pulse">PINが違います</p>}
      <div className="relative grid grid-cols-3 gap-3 w-60">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button key={i} disabled={loading}
            onClick={() => d === '⌫' ? setPin(p => p.slice(0, -1)) : d && handleDigit(d)}
            className={`py-4 rounded-2xl text-xl font-bold transition-all active:scale-90 ${
              d === '' ? 'invisible' : d === '⌫' ? c.del : c.key
            }`}>{d}</button>
        ))}
      </div>
      {onBack && (
        <button onClick={onBack} className={`relative mt-8 text-sm transition-colors ${c.back}`}>
          {backLabel}
        </button>
      )}
    </div>
  )
}

/**
 * 店舗管理画面用の照合関数。/api/admin/verify-pin でサーバー照合し、
 * 成功時は既存フロー互換のため sessionStorage に認証フラグと
 * 検証済みPIN（slip-ocr 等の API 認証に使用）を保存する。
 */
/**
 * 総管理（super-admin）用の照合関数。成功時は HttpOnly cookie が
 * サーバー側でセットされる。sessionStorage は UI 表示用フラグのみ。
 */
export async function verifySuperAdminPin(pin: string): Promise<true | null> {
  const res = await fetch('/api/super-admin/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  })
  if (!res.ok) return null
  sessionStorage.setItem('super_admin_auth', '1')
  return true
}

export async function verifyStorePinApi(storeId: string, pin: string): Promise<'owner' | 'staff' | null> {
  const res = await fetch('/api/admin/verify-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ storeId, pin }),
  })
  if (!res.ok) return null
  const json = await res.json()
  if (!json.ok) return null
  // 店舗スコープの Supabase Auth セッションを適用(RLS 通過に必須)
  if (json.session) {
    const ok = await applyStaffSession(json.session as StaffSessionTokens)
    if (!ok) return null
  }
  sessionStorage.setItem('admin_auth', '1')
  sessionStorage.setItem(`admin_pin_${storeId}`, pin)
  return json.role === 'owner' ? 'owner' : 'staff'
}
