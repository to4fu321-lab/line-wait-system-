'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Menu, TakeoutOrder, TakeoutSettings } from '@/types/takeout'

// ─── PIN認証画面 ───────────────────────────────────────────
function PinScreen({ storePin, onAuth }: { storePin: string; onAuth: () => void }) {
  const [pin,   setPin]   = useState('')
  const [error, setError] = useState(false)

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError(false)
    if (next.length === 4) {
      if (next === storePin) {
        onAuth()
      } else {
        setTimeout(() => { setPin(''); setError(true) }, 400)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <div className="text-5xl mb-3">🥡</div>
        <h1 className="text-2xl font-bold text-gray-800">テイクアウト管理</h1>
        <p className="text-gray-500 text-sm mt-1">PINを入力してください</p>
      </div>
      <div className="flex gap-4 mb-8">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-4 h-4 rounded-full transition-all ${
            pin.length > i ? (error ? 'bg-red-400' : 'bg-blue-500') : 'bg-gray-300'
          }`} />
        ))}
      </div>
      {error && <p className="text-red-500 text-sm mb-4">PINが違います</p>}
      <div className="grid grid-cols-3 gap-3 w-56">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button key={i}
            onClick={() => d === '⌫' ? setPin(p => p.slice(0,-1)) : d && handleDigit(d)}
            className={`h-14 rounded-xl text-xl font-bold transition-all active:scale-90 ${
              d === '' ? 'invisible' :
              d === '⌫' ? 'bg-gray-200 text-gray-500' :
              'bg-white text-gray-800 shadow-sm border border-gray-200'
            }`}>{d}</button>
        ))}
      </div>
    </div>
  )
}

// ─── メニュー管理 ──────────────────────────────────────────
function MenuManager({ storeId }: { storeId: string }) {
  const [menus,    setMenus]    = useState<Menu[]>([])
  const [loading,  setLoading]  = useState(true)
  const [newName,  setNewName]  = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [adding,   setAdding]   = useState(false)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editPrice,setEditPrice]= useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('menus').select('*').eq('store_id', storeId).order('sort_order')
    if (data) setMenus(data as Menu[])
    setLoading(false)
  }, [storeId])

  useEffect(() => { load() }, [load])

  const addMenu = async () => {
    const name  = newName.trim()
    const price = parseInt(newPrice) || 0
    if (!name) return
    setAdding(true)
    const maxOrder = menus.reduce((m, i) => Math.max(m, i.sort_order), 0)
    await supabase.from('menus').insert({
      store_id: storeId, name, price, is_available: true, sort_order: maxOrder + 1
    })
    setNewName(''); setNewPrice('')
    await load()
    setAdding(false)
  }

  const toggleAvailable = async (menu: Menu) => {
    await supabase.from('menus').update({ is_available: !menu.is_available }).eq('id', menu.id)
    setMenus(prev => prev.map(m => m.id === menu.id ? { ...m, is_available: !m.is_available } : m))
  }

  const startEdit = (menu: Menu) => {
    setEditId(menu.id); setEditName(menu.name); setEditPrice(String(menu.price))
  }

  const saveEdit = async () => {
    if (!editId) return
    await supabase.from('menus').update({
      name: editName.trim(), price: parseInt(editPrice) || 0
    }).eq('id', editId)
    setEditId(null)
    await load()
  }

  const deleteMenu = async (id: string) => {
    await supabase.from('menus').delete().eq('id', id)
    setDeleteId(null)
    await load()
  }

  if (loading) return <div className="p-8 text-center text-gray-400">読み込み中...</div>

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* 追加フォーム */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 shadow-sm">
        <p className="text-sm font-semibold text-gray-600 mb-3">メニューを追加</p>
        <div className="flex gap-2 mb-2">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addMenu()}
            placeholder="品目名"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400" />
          <div className="relative shrink-0 w-28">
            <input value={newPrice} onChange={e => setNewPrice(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addMenu()}
              placeholder="価格"
              type="number" inputMode="numeric"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 pr-6" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">円</span>
          </div>
        </div>
        <button onClick={addMenu} disabled={adding || !newName.trim()}
          className="w-full py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 active:scale-98 transition-transform">
          {adding ? '追加中...' : '＋ 追加'}
        </button>
      </div>

      {/* メニューリスト */}
      {menus.length === 0 ? (
        <p className="text-center text-gray-400 py-8 text-sm">メニューがありません</p>
      ) : (
        <div className="flex flex-col gap-2">
          {menus.map(menu => (
            <div key={menu.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${
              menu.is_available ? 'border-gray-200' : 'border-gray-100 opacity-50'
            }`}>
              {editId === menu.id ? (
                /* 編集モード */
                <div className="p-3 flex gap-2 items-center">
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="flex-1 border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none" />
                  <div className="relative w-24 shrink-0">
                    <input value={editPrice} onChange={e => setEditPrice(e.target.value)}
                      type="number" inputMode="numeric"
                      className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none pr-5" />
                    <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">円</span>
                  </div>
                  <button onClick={saveEdit} className="text-blue-500 text-sm font-semibold px-2">保存</button>
                  <button onClick={() => setEditId(null)} className="text-gray-400 text-sm px-1">✕</button>
                </div>
              ) : (
                /* 通常表示 */
                <div className="flex items-center px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{menu.name}</p>
                    <p className="text-xs text-gray-500">¥{menu.price.toLocaleString()}</p>
                  </div>
                  <button onClick={() => startEdit(menu)}
                    className="text-gray-400 text-xs px-2 py-1 rounded hover:bg-gray-100">編集</button>
                  <button onClick={() => toggleAvailable(menu)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                      menu.is_available
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                    {menu.is_available ? '販売中' : '停止中'}
                  </button>
                  {deleteId === menu.id ? (
                    <div className="flex gap-1">
                      <button onClick={() => deleteMenu(menu.id)}
                        className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded font-semibold">削除</button>
                      <button onClick={() => setDeleteId(null)}
                        className="text-xs text-gray-400 px-1">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteId(menu.id)}
                      className="text-gray-300 text-sm px-1 hover:text-red-400">🗑</button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── 設定管理 ─────────────────────────────────────────────
function SettingsTab({ storeId }: { storeId: string }) {
  const [settings, setSettings] = useState<TakeoutSettings>({})
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)

  useEffect(() => {
    supabase.from('stores').select('takeout_settings').eq('id', storeId).single()
      .then(({ data }) => {
        if (data?.takeout_settings) setSettings(data.takeout_settings as TakeoutSettings)
        setLoading(false)
      })
  }, [storeId])

  const save = async () => {
    setSaving(true)
    await supabase.from('stores').update({ takeout_settings: settings } as never).eq('id', storeId)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">読み込み中...</div>

  const num = (val: number | undefined, def: number) => val ?? def

  return (
    <div className="p-4 max-w-lg mx-auto flex flex-col gap-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">

        {/* 目標提供時間 */}
        <div className="px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">目標提供時間</p>
            <p className="text-xs text-gray-400">これを超えると緊急表示になります</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <input type="number" inputMode="numeric" min={1} max={120}
              value={num(settings.target_minutes, 15)}
              onChange={e => setSettings(s => ({ ...s, target_minutes: parseInt(e.target.value) || 15 }))}
              className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:border-blue-400" />
            <span className="text-sm text-gray-500">分</span>
          </div>
        </div>

        {/* 調理中をスキップ */}
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">調理中をスキップ</p>
            <p className="text-xs text-gray-400">受付から完成に直行（お弁当など向け）</p>
          </div>
          <button onClick={() => setSettings(s => ({ ...s, skip_preparing: !s.skip_preparing }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              settings.skip_preparing ? 'bg-blue-500' : 'bg-gray-300'
            }`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
              settings.skip_preparing ? 'left-5' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* 調理開始通知 */}
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">調理開始時にLINE通知</p>
            <p className="text-xs text-gray-400">「調理を開始しました」を送信</p>
          </div>
          <button onClick={() => setSettings(s => ({ ...s, notify_on_preparing: !(s.notify_on_preparing ?? true) }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              (settings.notify_on_preparing ?? true) ? 'bg-blue-500' : 'bg-gray-300'
            }`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
              (settings.notify_on_preparing ?? true) ? 'left-5' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* 完成通知 */}
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">完成時にLINE通知</p>
            <p className="text-xs text-gray-400">「ご準備できました」を送信</p>
          </div>
          <button onClick={() => setSettings(s => ({ ...s, notify_on_ready: !(s.notify_on_ready ?? true) }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              (settings.notify_on_ready ?? true) ? 'bg-blue-500' : 'bg-gray-300'
            }`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
              (settings.notify_on_ready ?? true) ? 'left-5' : 'left-0.5'
            }`} />
          </button>
        </div>

        {/* コンボリセット */}
        <div className="px-4 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium">コンボリセット時間</p>
            <p className="text-xs text-gray-400">最後のお渡しからこの時間で0に戻ります</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <input type="number" inputMode="numeric" min={30} max={3600}
              value={num(settings.combo_timeout_seconds, 300)}
              onChange={e => setSettings(s => ({ ...s, combo_timeout_seconds: parseInt(e.target.value) || 300 }))}
              className="w-20 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-right outline-none focus:border-blue-400" />
            <span className="text-sm text-gray-500">秒</span>
          </div>
        </div>
      </div>

      <button onClick={save} disabled={saving}
        className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-98 ${
          saved ? 'bg-green-500 text-white' : 'bg-blue-500 text-white disabled:opacity-50'
        }`}>
        {saving ? '保存中...' : saved ? '✓ 保存しました' : '保存する'}
      </button>
    </div>
  )
}

// ─── 注文履歴 ─────────────────────────────────────────────
function OrderHistory({ storeId }: { storeId: string }) {
  const todayJst = () => {
    const d = new Date(Date.now() + 9 * 3600000)
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`
  }

  const [date,    setDate]    = useState(todayJst)
  const [orders,  setOrders]  = useState<TakeoutOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const from = new Date(`${date}T00:00:00+09:00`).toISOString()
    const to   = new Date(`${date}T23:59:59+09:00`).toISOString()
    const { data } = await supabase
      .from('takeout_orders')
      .select('*, items:takeout_order_items(*)')
      .eq('store_id', storeId)
      .gte('created_at', from)
      .lte('created_at', to)
      .order('created_at', { ascending: false })
    if (data) setOrders(data as TakeoutOrder[])
    setLoading(false)
  }, [storeId, date])

  useEffect(() => { load() }, [load])

  const completed = orders.filter(o => o.status === 'completed')
  const cancelled = orders.filter(o => o.status === 'cancelled')

  return (
    <div className="p-4 max-w-lg mx-auto">
      {/* 日付選択 */}
      <div className="flex items-center gap-3 mb-4">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 bg-white" />
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-3xl font-black text-green-600">{completed.length}</p>
          <p className="text-xs text-gray-500 mt-1">完了</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4 text-center shadow-sm">
          <p className="text-3xl font-black text-gray-400">{cancelled.length}</p>
          <p className="text-xs text-gray-500 mt-1">キャンセル</p>
        </div>
      </div>

      {/* 注文一覧 */}
      {loading ? (
        <div className="text-center text-gray-400 py-8">読み込み中...</div>
      ) : orders.length === 0 ? (
        <div className="text-center text-gray-400 py-8 text-sm">この日の注文はありません</div>
      ) : (
        <div className="flex flex-col gap-2">
          {orders.map(order => (
            <div key={order.id} className={`bg-white rounded-xl border shadow-sm p-4 ${
              order.status === 'cancelled' ? 'opacity-50 border-gray-100' : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-black text-lg">{order.order_number}</span>
                  {order.customer_name && (
                    <span className="text-sm text-gray-500">{order.customer_name}様</span>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  order.status === 'completed' ? 'bg-green-100 text-green-700' :
                  order.status === 'cancelled' ? 'bg-gray-100 text-gray-500' :
                  'bg-yellow-100 text-yellow-700'
                }`}>
                  {order.status === 'completed' ? '完了' : order.status === 'cancelled' ? 'キャンセル' : order.status}
                </span>
              </div>
              <div className="text-xs text-gray-400">
                {(order.items ?? []).map(i => `${i.name}×${i.quantity}`).join('・')}
              </div>
              {order.notes && <div className="text-xs text-amber-600 mt-1">📝 {order.notes}</div>}
              <div className="text-xs text-gray-400 mt-1">
                {new Date(order.created_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                {order.total_amount > 0 && ` · ¥${order.total_amount.toLocaleString()}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── メインページ ──────────────────────────────────────────
type Tab = 'menus' | 'settings' | 'history'
const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'menus',    label: 'メニュー', icon: '🍽' },
  { key: 'settings', label: '設定',    icon: '⚙️' },
  { key: 'history',  label: '注文履歴', icon: '📋' },
]

export default function TakeoutAdminPage({ params }: { params: { storeId: string } }) {
  const { storeId } = params
  const [storePin,  setStorePin]  = useState('')
  const [storeName, setStoreName] = useState('')
  const [authed,    setAuthed]    = useState(false)
  const [tab,       setTab]       = useState<Tab>('menus')

  useEffect(() => {
    supabase.from('stores').select('name, pin').eq('id', storeId).single()
      .then(({ data }) => {
        if (!data) return
        const d = data as { name: string; pin: string }
        setStoreName(d.name)
        setStorePin(d.pin)
      })
    const ok  = sessionStorage.getItem('admin_auth')    === '1'
    const sid = sessionStorage.getItem('admin_store_id') === storeId
    if (ok && sid) setAuthed(true)
  }, [storeId])

  const handleAuth = () => {
    sessionStorage.setItem('admin_auth',     '1')
    sessionStorage.setItem('admin_store_id', storeId)
    setAuthed(true)
  }

  if (!storePin) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">読み込み中...</div>
  }

  if (!authed) return <PinScreen storePin={storePin} onAuth={handleAuth} />

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs text-gray-400">テイクアウト管理</p>
          <h1 className="font-bold text-gray-800">{storeName}</h1>
        </div>
        <a href={`/${storeId}/kitchen`} target="_blank"
          className="text-sm text-blue-500 bg-blue-50 px-3 py-1.5 rounded-lg font-medium">
          🍳 キッチン画面
        </a>
      </header>

      {/* タブ */}
      <nav className="bg-white border-b border-gray-100 flex">
        {TABS.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-3 text-sm font-medium flex flex-col items-center gap-0.5 transition-colors border-b-2 ${
              tab === key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-400'
            }`}>
            <span>{icon}</span>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* コンテンツ */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'menus'    && <MenuManager   storeId={storeId} />}
        {tab === 'settings' && <SettingsTab   storeId={storeId} />}
        {tab === 'history'  && <OrderHistory  storeId={storeId} />}
      </div>
    </div>
  )
}
