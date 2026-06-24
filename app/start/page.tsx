'use client'

import { useState } from 'react'

const BRAND = 'ミセプラ'
const TRIAL_DAYS = 30

export default function StartTrialPage() {
  const [storeName, setStoreName] = useState('')
  const [contact, setContact]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [result, setResult]       = useState<{ storeId: string; pin: string } | null>(null)

  const submit = async () => {
    if (!storeName.trim()) { setError('お店の名前を入力してください'); return }
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/trial/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeName: storeName.trim(), contact: contact.trim() || undefined }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setError(json.error ?? '開始に失敗しました'); setLoading(false); return }
      setResult({ storeId: json.storeId, pin: json.pin })
    } catch {
      setError('通信エラーが発生しました'); setLoading(false)
    }
  }

  const adminUrl = result ? `/${result.storeId}/admin` : '#'

  return (
    <main className="min-h-screen bg-white text-zinc-900 antialiased">
      <header className="mx-auto flex h-16 max-w-xl items-center justify-between px-5">
        <a href="/lp?preview=1" className="text-[17px] font-black tracking-tight">{BRAND}</a>
        <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-black text-indigo-600">{TRIAL_DAYS}日間 無料</span>
      </header>

      <div className="mx-auto max-w-md px-5 py-10">
        {!result ? (
          <>
            <h1 className="text-3xl font-black leading-tight tracking-tight">
              今すぐ、無料で始める。
            </h1>
            <p className="mt-3 text-zinc-600 leading-relaxed">
              お店の名前を入れるだけ。すぐに使えるお店の画面ができあがります。
              <strong className="font-bold text-zinc-900">{TRIAL_DAYS}日間は無料</strong>、クレジットカードも要りません。
            </p>

            <div className="mt-8 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-zinc-700">お店の名前 <span className="text-red-500">*</span></label>
                <input value={storeName} onChange={e => { setStoreName(e.target.value); setError(null) }}
                  placeholder="例：ひものや 学生服店"
                  className="w-full rounded-2xl border-2 border-zinc-200 px-4 py-3.5 text-base focus:border-zinc-900 focus:outline-none" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-bold text-zinc-700">連絡先（任意）</label>
                <input value={contact} onChange={e => setContact(e.target.value)}
                  placeholder="お電話番号やメール（サポート用・任意）"
                  className="w-full rounded-2xl border-2 border-zinc-200 px-4 py-3.5 text-base focus:border-zinc-900 focus:outline-none" />
              </div>

              {error && <p className="text-sm font-bold text-red-600">{error}</p>}

              <button onClick={submit} disabled={loading}
                className="w-full rounded-full bg-zinc-900 px-6 py-4 font-bold text-white shadow-lg shadow-zinc-900/15 transition-all hover:bg-black active:scale-[0.98] disabled:opacity-50">
                {loading ? '作成中…' : `${TRIAL_DAYS}日間 無料で始める`}
              </button>
              <p className="text-center text-xs text-zinc-400">ボタンを押すと、すぐにお店の画面が作られます</p>
            </div>
          </>
        ) : (
          <div className="text-center">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgb(5 150 105)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
            </div>
            <h1 className="text-2xl font-black">お店の準備ができました！</h1>
            <p className="mt-2 text-sm text-zinc-600">下のPINでログインして、すぐに使い始められます。</p>

            <div className="mt-7 rounded-2xl border-2 border-zinc-200 bg-zinc-50 p-5 text-left">
              <p className="text-xs font-bold text-zinc-400">ログインPIN（メモしてください）</p>
              <p className="mt-1 text-4xl font-black tracking-[0.3em] text-zinc-900">{result.pin}</p>
              <p className="mt-3 break-all text-xs text-zinc-400">
                お店のURL：<br />{typeof window !== 'undefined' ? window.location.origin : ''}{adminUrl}
              </p>
            </div>

            <a href={adminUrl}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-zinc-900 px-6 py-4 font-bold text-white shadow-lg transition-all hover:bg-black active:scale-[0.98]">
              そのまま使い始める
            </a>
            <p className="mt-4 text-xs text-zinc-400 leading-relaxed">
              このURLとPINは、お店のスタッフだけに共有してください。<br />
              {TRIAL_DAYS}日間の無料体験です。続けて使う場合はそのままご利用いただけます。
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
