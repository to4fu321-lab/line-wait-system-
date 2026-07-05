'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { PinScreen, verifyStorePinApi } from '@/app/_components/PinScreen'
import { hasStaffSession } from '@/lib/staffSessionClient'
import type { Menu, TakeoutOrder, TakeoutSettings } from '@/types/takeout'
import type { KitchenStation } from '@/types/kitchen-scheduler'

// MenuManager のドロップダウン用（後方互換）
const STATION_OPTIONS = [
  { value: 'grill',   label: '焼き台',    },
  { value: 'fryer',   label: 'フライヤー', },
  { value: 'drink',   label: 'ドリンク',   },
  { value: 'oven',    label: 'オーブン',   },
  { value: 'pot',     label: '鍋',        },
  { value: 'steamer', label: '蒸し器',    },
  { value: 'counter', label: '盛り付け',  },
  { value: 'other',   label: 'その他',    },
]
// 旧レコード（'grill' 等）の表示用
const STATION_ICON: Record<string, string> = {
  grill: '🔥', fryer: '🍳', drink: '🥤',
  oven: '♨️', pot: '🍲', steamer: '🫕', counter: '🍱',
  other: '📦',
}
const STATION_LABEL: Record<string, string> = {
  grill: '焼き台', fryer: 'フライヤー', drink: 'ドリンク',
  oven: 'オーブン', pot: '鍋', steamer: '蒸し器', counter: '盛り付け',
  other: 'その他',
}

// ── アイコンパレット（絵文字を直接 station_type として保存） ──
const ICON_PALETTE: { cat: string; icons: string[] }[] = [
  {
    cat: '🔥 熱調理・火力',
    icons: ['🔥', '🍳', '🥘', '🫕', '🍲', '♨️', '🥞', '🧇'],
  },
  {
    cat: '🍟 揚げ物・焼き物',
    icons: ['🍟', '🍤', '🍢', '🥩', '🍖', '🥓', '🍗', '🐟'],
  },
  {
    cat: '🍺 ドリンク・バー',
    icons: ['🍺', '🍻', '🥂', '🍶', '🍸', '🥃', '🥤', '☕', '🍵', '🧋'],
  },
  {
    cat: '🍱 盛り付け・仕込み',
    icons: ['🍱', '🍚', '🍙', '🥗', '🥚', '🍣', '🍜', '🧆', '🥙', '🥪'],
  },
  {
    cat: '⚙️ 設備・その他',
    icons: ['❄️', '🧊', '🔪', '⚡', '🧺', '📦', '🪣', '⚙️', '🧹', '🧽'],
  },
]

// ─── メニュー管理 ──────────────────────────────────────────
function MenuManager({ storeId }: { storeId: string }) {
  const [menus,    setMenus]    = useState<Menu[]>([])
  const [loading,  setLoading]  = useState(true)
  const [adding,   setAdding]   = useState(false)
  const [editId,   setEditId]   = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // 追加フォーム
  const [newName,        setNewName]        = useState('')
  const [newPrice,       setNewPrice]       = useState('')
  const [newStationType, setNewStationType] = useState('')
  const [newCookMins,    setNewCookMins]    = useState('')
  const [newFinishMins,  setNewFinishMins]  = useState('')

  // 編集フォーム
  const [editName,        setEditName]        = useState('')
  const [editPrice,       setEditPrice]       = useState('')
  const [editStationType, setEditStationType] = useState('')
  const [editCookMins,    setEditCookMins]    = useState('')
  const [editFinishMins,  setEditFinishMins]  = useState('')

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
    await (supabase as any).from('menus').insert({
      store_id: storeId, name, price, is_available: true, sort_order: maxOrder + 1,
      station_type:   newStationType   || null,
      cook_minutes:   newCookMins      ? parseInt(newCookMins)   : null,
      finish_minutes: newFinishMins    ? parseInt(newFinishMins) : null,
    })
    setNewName(''); setNewPrice(''); setNewStationType(''); setNewCookMins(''); setNewFinishMins('')
    await load()
    setAdding(false)
  }

  const startEdit = (menu: Menu) => {
    setEditId(menu.id)
    setEditName(menu.name)
    setEditPrice(String(menu.price))
    setEditStationType(menu.station_type ?? '')
    setEditCookMins(menu.cook_minutes    != null ? String(menu.cook_minutes)    : '')
    setEditFinishMins(menu.finish_minutes != null ? String(menu.finish_minutes) : '')
  }

  const saveEdit = async () => {
    if (!editId) return
    await (supabase as any).from('menus').update({
      name:           editName.trim(),
      price:          parseInt(editPrice) || 0,
      station_type:   editStationType   || null,
      cook_minutes:   editCookMins      ? parseInt(editCookMins)   : null,
      finish_minutes: editFinishMins    ? parseInt(editFinishMins) : null,
    }).eq('id', editId)
    setEditId(null)
    await load()
  }

  const toggleAvailable = async (menu: Menu) => {
    await (supabase as any).from('menus').update({ is_available: !menu.is_available }).eq('id', menu.id)
    setMenus(prev => prev.map(m => m.id === menu.id ? { ...m, is_available: !m.is_available } : m))
  }

  const deleteMenu = async (id: string) => {
    await (supabase as any).from('menus').delete().eq('id', id)
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
              placeholder="価格" type="number" inputMode="numeric"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 pr-6" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">円</span>
          </div>
        </div>
        {/* 調理設定 */}
        <div className="flex gap-2 mb-2">
          <select value={newStationType} onChange={e => setNewStationType(e.target.value)}
            className="flex-1 border border-gray-200 rounded-lg px-2 py-2 text-sm outline-none focus:border-blue-400 bg-white">
            <option value="">ステーション未設定</option>
            {STATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <input value={newCookMins} onChange={e => setNewCookMins(e.target.value)}
              placeholder="調理時間" type="number" inputMode="numeric"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 pr-7" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">分</span>
          </div>
          <div className="relative flex-1">
            <input value={newFinishMins} onChange={e => setNewFinishMins(e.target.value)}
              placeholder="仕上げ(任意)" type="number" inputMode="numeric"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 pr-7" />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">分</span>
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
                <div className="p-3 flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input value={editName} onChange={e => setEditName(e.target.value)}
                      className="flex-1 border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none" />
                    <div className="relative w-24 shrink-0">
                      <input value={editPrice} onChange={e => setEditPrice(e.target.value)}
                        type="number" inputMode="numeric"
                        className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none pr-5" />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">円</span>
                    </div>
                  </div>
                  <select value={editStationType} onChange={e => setEditStationType(e.target.value)}
                    className="border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none bg-white">
                    <option value="">ステーション未設定</option>
                    {STATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input value={editCookMins} onChange={e => setEditCookMins(e.target.value)}
                        placeholder="調理時間" type="number" inputMode="numeric"
                        className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none pr-6" />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">分</span>
                    </div>
                    <div className="relative flex-1">
                      <input value={editFinishMins} onChange={e => setEditFinishMins(e.target.value)}
                        placeholder="仕上げ(任意)" type="number" inputMode="numeric"
                        className="w-full border border-blue-300 rounded-lg px-2 py-1.5 text-sm outline-none pr-6" />
                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-400 text-xs">分</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit} className="flex-1 py-1.5 bg-blue-500 text-white text-sm font-semibold rounded-lg">保存</button>
                    <button onClick={() => setEditId(null)} className="px-4 py-1.5 text-gray-400 text-sm border border-gray-200 rounded-lg">✕</button>
                  </div>
                </div>
              ) : (
                /* 通常表示 */
                <div className="flex items-center px-4 py-3 gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{menu.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-400">¥{menu.price.toLocaleString()}</span>
                      {menu.station_type && (
                        <span className="text-xs text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded">
                          {STATION_ICON[menu.station_type] ?? '⚙️'} {STATION_LABEL[menu.station_type] ?? menu.station_type}
                          {menu.cook_minutes != null && ` · ${menu.cook_minutes}分`}
                          {menu.finish_minutes != null && ` / 仕上げ${menu.finish_minutes}分`}
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => startEdit(menu)}
                    className="text-gray-400 text-xs px-2 py-1 rounded hover:bg-gray-100 shrink-0">編集</button>
                  <button onClick={() => toggleAvailable(menu)}
                    className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${
                      menu.is_available ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                    {menu.is_available ? '販売中' : '停止中'}
                  </button>
                  {deleteId === menu.id ? (
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => deleteMenu(menu.id)}
                        className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded font-semibold">削除</button>
                      <button onClick={() => setDeleteId(null)} className="text-xs text-gray-400 px-1">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteId(menu.id)}
                      className="text-gray-300 text-sm px-1 hover:text-red-400 shrink-0">🗑</button>
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

// ─── 調理機材管理 ──────────────────────────────────────────
function StationManager({ storeId }: { storeId: string }) {
  const [stations,    setStations]    = useState<KitchenStation[]>([])
  const [loading,     setLoading]     = useState(true)
  const [adding,      setAdding]      = useState(false)
  const [newName,     setNewName]     = useState('')
  const [newType,     setNewType]     = useState('🔥')
  const [newCapacity, setNewCapacity] = useState('10')

  // インライン編集
  const [editId,       setEditId]       = useState<string | null>(null)
  const [editName,     setEditName]     = useState('')
  const [editType,     setEditType]     = useState('🔥')
  const [editCapacity, setEditCapacity] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('kitchen_stations').select('*').eq('store_id', storeId).order('station_type')
    if (data) setStations(data as KitchenStation[])
    setLoading(false)
  }, [storeId])

  useEffect(() => { load() }, [load])

  const startEdit = (s: KitchenStation) => {
    setEditId(s.id)
    setEditName(s.name)
    setEditType(s.station_type)
    setEditCapacity(String(s.capacity))
  }

  const saveEdit = async () => {
    if (!editId || !editName.trim()) return
    await (supabase as any).from('kitchen_stations')
      .update({ name: editName.trim(), station_type: editType, capacity: parseInt(editCapacity) || 10 } as never)
      .eq('id', editId)
    setEditId(null)
    await load()
  }

  const add = async () => {
    if (!newName.trim()) return
    setAdding(true)
    await (supabase as any).from('kitchen_stations').insert({
      store_id: storeId, name: newName.trim(),
      station_type: newType, capacity: parseInt(newCapacity) || 10, is_active: true,
    })
    setNewName(''); setNewCapacity('10')
    await load()
    setAdding(false)
  }

  const toggleActive = async (s: KitchenStation) => {
    await (supabase as any).from('kitchen_stations').update({ is_active: !s.is_active }).eq('id', s.id)
    setStations(prev => prev.map(st => st.id === s.id ? { ...st, is_active: !s.is_active } : st))
  }

  const del = async (id: string) => {
    await (supabase as any).from('kitchen_stations').delete().eq('id', id)
    await load()
  }

  const IconPalette = ({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) => {
    const displayIcon = STATION_ICON[selected] ?? selected
    return (
      <div>
        {/* 選択中プレビュー */}
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-3xl leading-none">{displayIcon}</span>
          <span className="text-xs text-gray-400">選択中 — タップで変更</span>
        </div>
        {/* カテゴリ別パレット */}
        {ICON_PALETTE.map(({ cat, icons }) => (
          <div key={cat} className="mb-2">
            <p className="text-[10px] font-semibold text-gray-400 mb-1">{cat}</p>
            <div className="grid grid-cols-8 gap-1">
              {icons.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => onSelect(icon)}
                  className={`aspect-square flex items-center justify-center rounded-xl text-xl transition-all active:scale-90 ${
                    selected === icon || displayIcon === icon
                      ? 'bg-blue-500 ring-2 ring-blue-300 scale-110 shadow-sm'
                      : 'bg-gray-100 active:bg-gray-200'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (loading) return <div className="py-4 text-center text-gray-400 text-sm">読み込み中...</div>

  return (
    <div className="mt-6">
      <p className="text-sm font-semibold text-gray-700 mb-3 px-1">調理機材・ステーション</p>

      {/* 新規追加フォーム */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3 shadow-sm">
        <p className="text-xs font-semibold text-gray-500 mb-2">新規追加</p>
        <input value={newName} onChange={e => setNewName(e.target.value)}
          placeholder="機材名（例: メイン焼き台）"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 mb-2" />
        <IconPalette selected={newType} onSelect={setNewType} />
        <div className="relative mt-2">
          <input value={newCapacity} onChange={e => setNewCapacity(e.target.value)}
            placeholder="同時調理数" type="number" inputMode="numeric"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 pr-10" />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">同時</span>
        </div>
        <button onClick={add} disabled={adding || !newName.trim()}
          className="w-full mt-2 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold disabled:opacity-40">
          {adding ? '追加中...' : '＋ 追加'}
        </button>
      </div>

      {/* 機材リスト */}
      {stations.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">機材が登録されていません</p>
      ) : (
        <div className="flex flex-col gap-2">
          {stations.map(s => (
            <div key={s.id} className={`bg-white rounded-xl border shadow-sm ${
              s.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'
            }`}>
              {editId === s.id ? (
                /* インライン編集モード */
                <div className="p-3 flex flex-col gap-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="border border-blue-300 rounded-lg px-3 py-2 text-sm outline-none" />
                  <IconPalette selected={editType} onSelect={setEditType} />
                  <div className="relative">
                    <input value={editCapacity} onChange={e => setEditCapacity(e.target.value)}
                      type="number" inputMode="numeric" placeholder="同時調理数"
                      className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm outline-none pr-10" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">同時</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={saveEdit}
                      className="flex-1 py-2 bg-blue-500 text-white text-sm font-semibold rounded-lg">
                      保存
                    </button>
                    <button onClick={() => setEditId(null)}
                      className="px-4 py-2 text-gray-400 text-sm border border-gray-200 rounded-lg">
                      ✕
                    </button>
                  </div>
                </div>
              ) : (
                /* 通常表示 */
                <div className="px-4 py-3 flex items-center gap-3">
                  <span className="text-xl shrink-0">{STATION_ICON[s.station_type] ?? s.station_type ?? '⚙️'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{s.name}</p>
                    <p className="text-xs text-gray-400">
                      同時{s.capacity}個
                    </p>
                  </div>
                  <button onClick={() => startEdit(s)}
                    className="text-gray-400 text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50 shrink-0">
                    編集
                  </button>
                  <button onClick={() => toggleActive(s)}
                    className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                      s.is_active ? 'bg-blue-500' : 'bg-gray-300'
                    }`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      s.is_active ? 'left-5' : 'left-0.5'
                    }`} />
                  </button>
                  <button onClick={() => del(s.id)} className="text-gray-300 text-sm hover:text-red-400 shrink-0">🗑</button>
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
  const [settings,         setSettings]         = useState<TakeoutSettings>({})
  const [storeName,        setStoreName]        = useState('')
  const [loading,          setLoading]          = useState(true)
  const [saving,           setSaving]           = useState(false)
  const [saved,            setSaved]            = useState(false)
  const [richmenuApplying, setRichmenuApplying] = useState(false)
  const [richmenuMsg,      setRichmenuMsg]      = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    ;(supabase as any).from('stores').select('name, takeout_settings').eq('id', storeId).single()
      .then(({ data }: { data: any }) => {
        if (data?.takeout_settings) setSettings(data.takeout_settings as TakeoutSettings)
        if (data?.name) setStoreName(data.name)
        setLoading(false)
      })
  }, [storeId])

  const applyRichmenu = async () => {
    setRichmenuApplying(true); setRichmenuMsg(null)
    try {
      const res = await fetch('/api/richmenu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, storeName, storeType: 'takeout' }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`)
      setRichmenuMsg({ ok: true, text: `登録完了 (ID: ${data.richMenuId?.slice(0, 12)}...)` })
    } catch (e) {
      setRichmenuMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
    } finally {
      setRichmenuApplying(false)
    }
  }

  const save = async () => {
    setSaving(true)
    await (supabase as any).from('stores').update({ takeout_settings: settings } as never).eq('id', storeId)
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">読み込み中...</div>

  const num = (val: number | undefined, def: number) => val ?? def

  return (
    <div className="p-4 max-w-lg mx-auto flex flex-col gap-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
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
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">調理中をスキップ</p>
            <p className="text-xs text-gray-400">受付から完成に直行（お弁当など向け）</p>
          </div>
          <button onClick={() => setSettings(s => ({ ...s, skip_preparing: !s.skip_preparing }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${settings.skip_preparing ? 'bg-blue-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${settings.skip_preparing ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">調理開始時にLINE通知</p>
            <p className="text-xs text-gray-400">「調理を開始しました」を送信</p>
          </div>
          <button onClick={() => setSettings(s => ({ ...s, notify_on_preparing: !(s.notify_on_preparing ?? true) }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${(settings.notify_on_preparing ?? true) ? 'bg-blue-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${(settings.notify_on_preparing ?? true) ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
        <div className="px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">完成時にLINE通知</p>
            <p className="text-xs text-gray-400">「ご準備できました」を送信</p>
          </div>
          <button onClick={() => setSettings(s => ({ ...s, notify_on_ready: !(s.notify_on_ready ?? true) }))}
            className={`relative w-11 h-6 rounded-full transition-colors ${(settings.notify_on_ready ?? true) ? 'bg-blue-500' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${(settings.notify_on_ready ?? true) ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
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

      {/* LINEリッチメニュー */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-col gap-3">
        <div>
          <p className="text-sm font-bold text-gray-800">📲 LINEリッチメニュー</p>
          <p className="text-xs text-gray-400 mt-0.5">
            全店共通の4パネルメニュー（テイクアウト注文・採寸受付・来店予約・お直し依頼）を登録します。
            LINEアカウントを複数業種で共有している場合でも1つのメニューで全対応できます。
          </p>
        </div>
        <button onClick={applyRichmenu} disabled={richmenuApplying}
          className="w-full py-3 rounded-xl font-bold text-sm bg-green-500 text-white disabled:opacity-50 active:scale-98 transition-all flex items-center justify-center gap-2">
          {richmenuApplying ? '登録中...' : 'リッチメニューを登録・更新する'}
        </button>
        {richmenuMsg && (
          <p className={`text-xs text-center font-medium ${richmenuMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
            {richmenuMsg.ok ? '✅ ' : '❌ '}{richmenuMsg.text}
          </p>
        )}
      </div>

      {/* 調理機材管理 */}
      <StationManager storeId={storeId} />
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
      .gte('created_at', from).lte('created_at', to)
      .order('created_at', { ascending: false })
    if (data) setOrders(data as TakeoutOrder[])
    setLoading(false)
  }, [storeId, date])

  useEffect(() => { load() }, [load])

  const completed = orders.filter(o => o.status === 'completed')
  const cancelled = orders.filter(o => o.status === 'cancelled')

  return (
    <div className="p-4 max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-blue-400 bg-white" />
      </div>
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
                  {order.customer_name && <span className="text-sm text-gray-500">{order.customer_name}様</span>}
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
  const [storeName, setStoreName] = useState('')
  const [loaded,    setLoaded]    = useState(false)
  const [authed,    setAuthed]    = useState(false)
  const [tab,       setTab]       = useState<Tab>('menus')

  useEffect(() => {
    (supabase as any).from('stores').select('name').eq('id', storeId).single()
      .then(({ data }: { data: { name: string } | null }) => {
        if (data) setStoreName(data.name)
        setLoaded(true)
      })
    ;(async () => {
      const ok  = sessionStorage.getItem('admin_auth')     === '1'
      const sid = sessionStorage.getItem('admin_store_id') === storeId
      // Supabase Auth セッション(RLS通過に必須)が生きている場合のみ復元
      if (ok && sid && await hasStaffSession(storeId)) setAuthed(true)
    })()
  }, [storeId])

  const handleAuth = () => {
    sessionStorage.setItem('admin_auth',     '1')
    sessionStorage.setItem('admin_store_id', storeId)
    setAuthed(true)
  }

  if (!loaded) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">読み込み中...</div>
  if (!authed) return (
    <PinScreen title="テイクアウト管理" emoji="🥡" subtitle={storeName}
      verify={pin => verifyStorePinApi(storeId, pin)} onAuth={handleAuth} />
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div>
          <p className="text-xs text-gray-400">テイクアウト管理</p>
          <h1 className="font-bold text-gray-800">{storeName}</h1>
        </div>
        <div className="flex items-center gap-2">
          <a href={`/${storeId}/admin`}
            className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">
            🏪 管理画面
          </a>
          <a href={`/${storeId}/kitchen`} target="_blank"
            className="text-sm text-blue-500 bg-blue-50 px-3 py-1.5 rounded-lg font-medium">
            🍳 キッチン画面
          </a>
        </div>
      </header>
      <nav className="bg-white border-b border-gray-100 flex">
        {TABS.map(({ key, label, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 py-3 text-sm font-medium flex flex-col items-center gap-0.5 transition-colors border-b-2 ${
              tab === key ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-400'
            }`}>
            <span>{icon}</span><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="flex-1 overflow-y-auto">
        {tab === 'menus'    && <MenuManager  storeId={storeId} />}
        {tab === 'settings' && <SettingsTab  storeId={storeId} />}
        {tab === 'history'  && <OrderHistory storeId={storeId} />}
      </div>
    </div>
  )
}
