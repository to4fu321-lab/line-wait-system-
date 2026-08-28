'use client'

import { useState, type ReactNode } from 'react'
import { applyStaffSession, type StaffSessionTokens } from '@/lib/staffSessionClient'

import { PinAuthError, PIN_ERROR_MESSAGES } from '@/lib/pinAuth'

// 既存の import 経路を壊さないための再エクスポート（定義は lib/pinAuth.ts）
export { PinAuthError, PIN_ERROR_MESSAGES }

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
  const [pin,      setPin]      = useState('')
  const [error,    setError]    = useState(false)
  const [errorMsg, setErrorMsg] = useState<string>(PIN_ERROR_MESSAGES.wrongPin)
  const [loading,  setLoading]  = useState(false)

  const handleDigit = async (d: string) => {
    if (pin.length >= digits || loading) return
    const next = pin + d
    setPin(next)
    setError(false)
    if (next.length !== digits) return

    setLoading(true)
    // 既定は入力ミス。障害由来の失敗は PinAuthError の文面をそのまま出す
    let message: string = PIN_ERROR_MESSAGES.wrongPin
    try {
      const result = await verify(next)
      if (result !== null) { onAuth(result); return }
    } catch (e) {
      message = e instanceof PinAuthError ? e.message : PIN_ERROR_MESSAGES.network
    }
    setTimeout(() => { setPin(''); setError(true); setErrorMsg(message); setLoading(false) }, 400)
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
      {error && (
        // 入力ミスは1行、障害の説明は複数行になるため折り返して表示する
        <p className={`relative text-red-500 text-sm mb-4 font-medium max-w-xs text-center leading-relaxed ${
          errorMsg === PIN_ERROR_MESSAGES.wrongPin ? 'animate-pulse' : ''
        }`}>
          {errorMsg}
        </p>
      )}
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
  let res: Response
  try {
    res = await fetch('/api/super-admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    })
  } catch {
    // fetch自体が失敗＝サーバーに到達できていない（通信断・DNS・遮断）
    throw new PinAuthError(PIN_ERROR_MESSAGES.network)
  }
  if (res.status === 401) return null /* 本当にPINが違う場合だけ入力ミス扱い */
  if (!res.ok) throw new PinAuthError(PIN_ERROR_MESSAGES.server(res.status))
  sessionStorage.setItem('super_admin_auth', '1')
  return true
}

export async function verifyStorePinApi(storeId: string, pin: string): Promise<'owner' | 'staff' | null> {
  let res: Response
  try {
    res = await fetch('/api/admin/verify-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, pin }),
    })
  } catch {
    // fetch自体が失敗＝サーバーに到達できていない（通信断・DNS・遮断）
    throw new PinAuthError(PIN_ERROR_MESSAGES.network)
  }
  // 401 のみが「PINが違う」。他はサーバー障害なので原因を区別して伝える
  if (res.status === 401) return null
  if (!res.ok) throw new PinAuthError(PIN_ERROR_MESSAGES.server(res.status))

  const json = await res.json().catch(() => null) as
    { ok?: boolean; role?: string; session?: StaffSessionTokens } | null
  if (!json?.ok) throw new PinAuthError(PIN_ERROR_MESSAGES.badResponse)

  // 店舗スコープの Supabase Auth セッションを適用(RLS 通過に必須)。
  // ここはブラウザ→Supabaseの直接通信なので、社内ネットワークの遮断で
  // PIN照合成功後にだけ失敗しうる。入力ミスと明確に区別して伝える。
  if (json.session) {
    const ok = await applyStaffSession(json.session)
    if (!ok) throw new PinAuthError(PIN_ERROR_MESSAGES.database)
  }
  sessionStorage.setItem('admin_auth', '1')
  sessionStorage.setItem(`admin_pin_${storeId}`, pin)
  return json.role === 'owner' ? 'owner' : 'staff'
}
