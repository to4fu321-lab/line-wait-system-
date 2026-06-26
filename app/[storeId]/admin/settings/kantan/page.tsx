'use client'

// ── かんたんLINEモード 設定 ──────────────────────────────────
// スタッフのLINE登録コード発行・登録済みスタッフ管理・朝のリスト配信

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface StaffAccount {
  id: string
  line_user_id: string
  display_name: string | null
  created_at: string
}

export default function KantanSettingsPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()

  const [storeName, setStoreName] = useState('')
  const [linkCode, setLinkCode] = useState<string | null>(null)
  const [staff, setStaff] = useState<StaffAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null)

  const showToast = (kind: 'ok' | 'err', msg: string) => {
    setToast({ kind, msg })
    setTimeout(() => setToast(null), 3000)
  }

  const load = useCallback(async () => {
    if (!storeId) return
    const [{ data: store }, { data: accounts }] = await Promise.all([
      (supabase as any).from('stores').select('name, staff_link_code').eq('id', storeId).single(),
      (supabase as any).from('staff_line_accounts').select('*').eq('store_id', storeId).order('created_at'),
    ])
    setStoreName(store?.name ?? '')
    setLinkCode(store?.staff_link_code ?? null)
    setStaff((accounts ?? []) as StaffAccount[])
    setLoading(false)
  }, [storeId])

  useEffect(() => { load() }, [load])

  const generateCode = async () => {
    const code = String(Math.floor(100000 + Math.random() * 900000))
    const { error } = await (supabase as any)
      .from('stores').update({ staff_link_code: code }).eq('id', storeId)
    if (error) { showToast('err', 'コードの発行に失敗しました'); return }
    setLinkCode(code)
    showToast('ok', '登録コードを発行しました')
  }

  const removeStaff = async (id: string) => {
    if (!window.confirm('このスタッフの登録を解除しますか？')) return
    await (supabase as any).from('staff_line_accounts').delete().eq('id', id)
    load()
  }

  const sendBriefing = async () => {
    setSending(true)
    try {
      const storePin = sessionStorage.getItem(`admin_pin_${storeId}`) ?? ''
      const res = await fetch('/api/kantan/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, storePin }),
      })
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      showToast('ok', `タスク${json.taskCount}件をスタッフ${json.sentTo}人に送りました`)
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : '送信に失敗しました')
    }
    setSending(false)
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-10">
      <div className="bg-white border-b border-gray-200 px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={() => router.push(`/${storeId}/admin/settings/staff`)}
          className="text-gray-400 font-black text-xl active:scale-90 transition-all">←</button>
        <div>
          <h1 className="font-black text-gray-900">🍀 かんたんLINEモード</h1>
          <p className="text-xs text-gray-400 font-bold">{storeName}</p>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 mt-5 space-y-5">
        {/* 使い方 */}
        <div className="bg-teal-50 border border-teal-200 rounded-3xl p-5">
          <p className="font-black text-teal-800 mb-2">管理画面を開かなくても、LINEの返信だけでお店が回ります</p>
          <ol className="text-sm text-teal-700 font-bold space-y-1.5 list-decimal list-inside">
            <li>下のコードを発行する</li>
            <li>スタッフがお店のLINEに「スタッフ登録 <span className="bg-white rounded px-1">コード</span>」と送る</li>
            <li>毎朝「きょうのやること」がLINEに届く</li>
            <li>終わったら「1できた」と返信 → お客様への連絡まで自動で完了</li>
          </ol>
        </div>

        {/* 登録コード */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <p className="font-black text-gray-900 mb-3">スタッフ登録コード</p>
          {linkCode ? (
            <div className="flex items-center gap-4">
              <p className="text-4xl font-black tracking-[0.3em] text-gray-900 bg-gray-50 rounded-2xl px-5 py-3">
                {linkCode}
              </p>
              <button onClick={generateCode}
                className="text-sm font-bold text-gray-400 underline active:opacity-60">
                再発行
              </button>
            </div>
          ) : (
            <button onClick={generateCode} disabled={loading}
              className="bg-teal-500 text-white rounded-2xl px-6 py-4 text-lg font-black active:scale-95 transition-all disabled:opacity-50">
              コードを発行する
            </button>
          )}
          <p className="text-xs text-gray-400 font-bold mt-3">
            スタッフはお店のLINEに「スタッフ登録 {linkCode ?? '○○○○○○'}」と送ると登録されます
          </p>
        </div>

        {/* 登録済みスタッフ */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <p className="font-black text-gray-900 mb-3">登録済みスタッフ（{staff.length}人）</p>
          {staff.length === 0 ? (
            <p className="text-sm text-gray-400 font-bold">まだ登録されていません</p>
          ) : (
            <div className="space-y-2">
              {staff.map(s => (
                <div key={s.id} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                  <div>
                    <p className="font-black text-gray-800">{s.display_name ?? '（名前未取得）'}</p>
                    <p className="text-[10px] text-gray-400 font-bold">
                      {new Date(s.created_at).toLocaleDateString('ja-JP')} 登録
                    </p>
                  </div>
                  <button onClick={() => removeStaff(s.id)}
                    className="text-xs font-bold text-rose-400 active:opacity-60">
                    解除
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 手動配信 */}
        <div className="bg-white rounded-3xl p-5 shadow-sm">
          <p className="font-black text-gray-900 mb-1">きょうのやることリスト</p>
          <p className="text-xs text-gray-400 font-bold mb-4">
            納期が来ているお直し・お渡し待ち・入荷連絡待ちから自動で作られます。
            スタッフがLINEで「きょう」と送っても同じリストが届きます。
          </p>
          <button onClick={sendBriefing} disabled={sending || staff.length === 0}
            className="w-full bg-indigo-500 text-white rounded-2xl py-4 text-lg font-black active:scale-95 transition-all disabled:opacity-40">
            {sending ? '送信中...' : '📋 いまスタッフ全員に送る'}
          </button>
        </div>
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl font-black text-white shadow-xl z-50 ${toast.kind === 'ok' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
