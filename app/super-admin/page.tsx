'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, Loader2, ExternalLink, ShieldCheck, Scissors, Package,
  Plus, ChevronDown, ChevronUp, Palette, Pencil, Trash2, X, Check,
} from 'lucide-react'
import ColorPicker from '@/app/_components/ColorPicker'
import type { Store } from '@/types/database'

const SUPER_ADMIN_PIN = process.env.NEXT_PUBLIC_SUPER_ADMIN_PIN || '9999'

const FEATURES: { key: string; label: string; icon: string }[] = [
  { key: 'queue',           label: '順番待ち',    icon: '🔢' },
  { key: 'crm',             label: '顧客管理',    icon: '👥' },
  { key: 'reservation',     label: '採寸予約',    icon: '📅' },
  { key: 'orders',          label: '注文管理',    icon: '🛒' },
  { key: 'products',        label: '商品マスタ',   icon: '📦' },
  { key: 'repairs',         label: '修理管理',    icon: '✂️'  },
  { key: 'purchase_orders', label: '発注管理',    icon: '📋' },
  { key: 'takeout',         label: 'テイクアウト', icon: '🥡' },
]

interface StoreStats {
  store: Store & { group_id?: string | null; features?: Record<string, boolean> }
  waiting:         number
  calling:         number
  completed:       number
  total:           number
  repairPending:   number
  deliveryWaiting: number
}
interface GroupInfo { id: string; name: string; code?: string | null; pin?: string | null }

// ============================================================
// PIN認証画面
// ============================================================
function PinScreen({ onAuth }: { onAuth: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return
    const next = pin + d
    setPin(next)
    setError(false)
    if (next.length === 4) {
      if (next === SUPER_ADMIN_PIN) {
        sessionStorage.setItem('super_admin_auth', '1')
        onAuth()
      } else {
        setTimeout(() => { setPin(''); setError(true) }, 400)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center px-6">
      <div className="text-center mb-8">
        <div className="text-5xl mb-4">🏢</div>
        <h1 className="text-2xl font-bold text-white">総管理ダッシュボード</h1>
        <p className="text-gray-400 text-sm mt-1">PINを入力してください</p>
      </div>
      <div className="flex gap-4 mb-8">
        {[0,1,2,3].map(i => (
          <div key={i} className={`w-5 h-5 rounded-full transition-all ${
            pin.length > i ? (error ? 'bg-red-500' : 'bg-blue-400') : 'bg-gray-600'
          }`} />
        ))}
      </div>
      {error && <p className="text-red-400 text-sm mb-4 font-medium">PINが違います</p>}
      <div className="grid grid-cols-3 gap-4 w-64">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          <button key={i}
            onClick={() => d === '⌫' ? setPin(p => p.slice(0,-1)) : d && handleDigit(d)}
            className={`h-16 rounded-2xl text-2xl font-bold transition-all active:scale-90 ${
              d === '' ? 'invisible' :
              d === '⌫' ? 'bg-gray-700 text-gray-300' :
              'bg-gray-700 text-white hover:bg-gray-600'
            }`}>{d}</button>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// 総管理ダッシュボード
// ============================================================
function SuperDashboard() {
  const [storeStats,  setStoreStats]  = useState<StoreStats[]>([])
  const [groups,      setGroups]      = useState<GroupInfo[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [fetchError,  setFetchError]  = useState<string | null>(null)

  // カラーピッカー
  const [colorPickerStoreId, setColorPickerStoreId] = useState<string | null>(null)
  const [themeOverrides, setThemeOverrides] = useState<Record<string, string>>({})

  // 店舗追加フォーム
  const [showAddForm,  setShowAddForm]  = useState(false)
  const [addStoreName, setAddStoreName] = useState('')
  const [addStorePin,  setAddStorePin]  = useState('1111')
  const [addGroupMode, setAddGroupMode] = useState<'existing' | 'new'>('existing')
  const [addGroupId,   setAddGroupId]   = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupCode, setNewGroupCode] = useState('')
  const [newGroupPin,  setNewGroupPin]  = useState('1111')
  const [adding,       setAdding]       = useState(false)
  const [addMsg,       setAddMsg]       = useState<{ ok: boolean; text: string } | null>(null)

  // 店舗編集
  const [editStoreId, setEditStoreId] = useState<string | null>(null)
  const [editStoreName, setEditStoreName] = useState('')
  const [editStorePin, setEditStorePin] = useState('')
  const [editStoreGroupId, setEditStoreGroupId] = useState('')
  const [editStoreFeatures, setEditStoreFeatures] = useState<Record<string, boolean>>({})
  const [storeSaving, setStoreSaving] = useState(false)
  const [storeMsg, setStoreMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [deleteStoreId, setDeleteStoreId] = useState<string | null>(null)

  // 会社編集
  const [editGroupId,   setEditGroupId]   = useState<string | null>(null)
  const [editGroupName, setEditGroupName] = useState('')
  const [editGroupCode, setEditGroupCode] = useState('')
  const [editGroupPin,  setEditGroupPin]  = useState('')
  const [groupSaving,   setGroupSaving]   = useState(false)
  const [groupMsg,      setGroupMsg]      = useState<{ ok: boolean; text: string } | null>(null)
  const [deleteGroupId, setDeleteGroupId] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setRefreshing(true)
    setFetchError(null)
    try {
      const res = await fetch('/api/super-admin/stats')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setFetchError(`サーバーエラー (${res.status}): ${body.error || res.statusText}`)
        return
      }
      const body = await res.json()
      if (!body.stats || body.stats.length === 0) {
        setFetchError('storesテーブルにデータがありません（RLSポリシーまたはデータ未挿入）')
      }
      setStoreStats(body.stats ?? [])
      setGroups(body.groups ?? [])
      setLastUpdated(new Date())
    } catch (e) {
      setFetchError(`ネットワークエラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRefreshing(false)
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
    const id = setInterval(fetchAll, 30000)
    return () => clearInterval(id)
  }, [fetchAll])

  const totalWaiting   = storeStats.reduce((s, x) => s + x.waiting, 0)
  const totalCompleted = storeStats.reduce((s, x) => s + x.completed, 0)
  const totalAll       = storeStats.reduce((s, x) => s + x.total, 0)

  // ── 店舗編集を開く
  function openEditStore(stat: StoreStats) {
    const s = stat.store
    setEditStoreId(s.id)
    setEditStoreName(s.name)
    setEditStorePin(s.pin ?? '')
    setEditStoreGroupId(s.group_id ?? '')
    setEditStoreFeatures(s.features ?? {})
    setStoreMsg(null)
    setDeleteStoreId(null)
    setColorPickerStoreId(null)
  }

  // ── 店舗保存
  async function saveStore() {
    if (!editStoreId) return
    setStoreSaving(true); setStoreMsg(null)
    const res = await fetch(`/api/super-admin/stores/${editStoreId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editStoreName, pin: editStorePin,
        group_id: editStoreGroupId || null,
        features: editStoreFeatures,
      }),
    })
    const j = await res.json()
    setStoreSaving(false)
    if (!res.ok) { setStoreMsg({ ok: false, text: j.error ?? '保存失敗' }); return }
    setStoreMsg({ ok: true, text: '保存しました' })
    fetchAll()
    setTimeout(() => setEditStoreId(null), 800)
  }

  // ── 店舗削除
  async function deleteStore(storeId: string) {
    const res = await fetch(`/api/super-admin/stores/${storeId}`, { method: 'DELETE' })
    const j = await res.json()
    if (!res.ok) { setStoreMsg({ ok: false, text: j.error ?? '削除失敗' }); return }
    setDeleteStoreId(null)
    setEditStoreId(null)
    fetchAll()
  }

  // ── 会社編集を開く
  function openEditGroup(g: GroupInfo) {
    setEditGroupId(g.id)
    setEditGroupName(g.name)
    setEditGroupCode(g.code ?? '')
    setEditGroupPin(g.pin ?? '')
    setGroupMsg(null)
    setDeleteGroupId(null)
  }

  // ── 会社保存
  async function saveGroup() {
    if (!editGroupId) return
    setGroupSaving(true); setGroupMsg(null)
    const res = await fetch(`/api/super-admin/groups/${editGroupId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editGroupName, code: editGroupCode, pin: editGroupPin }),
    })
    const j = await res.json()
    setGroupSaving(false)
    if (!res.ok) { setGroupMsg({ ok: false, text: j.error ?? '保存失敗' }); return }
    setGroupMsg({ ok: true, text: '保存しました' })
    fetchAll()
    setTimeout(() => setEditGroupId(null), 800)
  }

  // ── 会社削除
  async function deleteGroup(groupId: string) {
    const res = await fetch(`/api/super-admin/groups/${groupId}`, { method: 'DELETE' })
    const j = await res.json()
    if (!res.ok) { setGroupMsg({ ok: false, text: j.error ?? '削除失敗' }); return }
    setDeleteGroupId(null)
    setEditGroupId(null)
    fetchAll()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="px-4 py-5">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-black">🏢 総管理ダッシュボード</h1>
            {lastUpdated && (
              <p className="text-gray-500 text-xs mt-0.5">最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}</p>
            )}
          </div>
          <button onClick={fetchAll} disabled={refreshing}
            className="p-2 rounded-xl bg-gray-700 active:scale-90 transition-transform disabled:opacity-50">
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        {fetchError && (
          <div className="bg-red-900/40 border border-red-700/50 rounded-xl px-4 py-3 mb-4 text-sm text-red-300 break-all">
            ⚠️ {fetchError}
          </div>
        )}

        {/* 全店合計 */}
        <div className="bg-gray-800 rounded-2xl p-4 mb-6 mt-4">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">全店合計</p>
          <div className="grid grid-cols-3 gap-3">
            <SummaryCard label="合計受付" value={totalAll}       color="text-white" />
            <SummaryCard label="全待機数" value={totalWaiting}   color="text-blue-400" />
            <SummaryCard label="全完了数" value={totalCompleted} color="text-green-400" />
          </div>
        </div>

        {/* 会社管理 */}
        {groups.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">会社管理</p>
            <div className="space-y-2">
              {groups.map(g => (
                <div key={g.id} className="bg-gray-800 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2.5">
                    <span className="text-sm font-bold flex-1">🏢 {g.name}</span>
                    {g.code && <span className="text-xs text-gray-500 font-mono">{g.code}</span>}
                    <button onClick={() => editGroupId === g.id ? setEditGroupId(null) : openEditGroup(g)}
                      className={`p-1.5 rounded-lg transition-colors ${editGroupId === g.id ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                      {editGroupId === g.id ? <X size={13} /> : <Pencil size={13} />}
                    </button>
                    <a href={`/company/${g.code ?? g.id}`} target="_blank" rel="noopener noreferrer"
                      className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-indigo-300 transition-colors">
                      <ExternalLink size={13} />
                    </a>
                  </div>

                  {/* 会社編集パネル */}
                  {editGroupId === g.id && (
                    <div className="border-t border-gray-700 px-3 pb-3 pt-3 space-y-2.5">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <label className="text-[10px] text-gray-400 mb-1 block">会社名</label>
                          <input value={editGroupName} onChange={e => setEditGroupName(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 mb-1 block">URLコード</label>
                          <input value={editGroupCode}
                            onChange={e => setEditGroupCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-indigo-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 mb-1 block">会社PIN</label>
                          <input value={editGroupPin} onChange={e => setEditGroupPin(e.target.value)}
                            maxLength={4} inputMode="numeric"
                            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
                        </div>
                      </div>

                      {groupMsg && (
                        <p className={`text-xs px-3 py-2 rounded-xl ${groupMsg.ok ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
                          {groupMsg.text}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button onClick={saveGroup} disabled={groupSaving}
                          className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-1.5 transition-colors">
                          {groupSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          保存
                        </button>
                        {deleteGroupId === g.id ? (
                          <button onClick={() => deleteGroup(g.id)}
                            className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-bold transition-colors">
                            本当に削除
                          </button>
                        ) : (
                          <button onClick={() => setDeleteGroupId(g.id)}
                            className="px-4 py-2 rounded-xl bg-gray-700 hover:bg-red-900/50 text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {deleteGroupId === g.id && (
                        <p className="text-xs text-red-400 text-center">⚠️ 所属する店舗のグループ紐付けが解除されます</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 店舗一覧 */}
        <div className="space-y-3">
          {storeStats.map(({ store, waiting, calling, completed, total, repairPending, deliveryWaiting }) => {
            const group = groups.find(g => g.id === store.group_id)
            const isEditing = editStoreId === store.id
            return (
              <div key={store.id} className="bg-gray-800 rounded-2xl overflow-hidden">
                {/* カードヘッダー */}
                <div className="p-4 pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-base font-black">{store.name}</span>
                      {group && <span className="text-gray-500 text-xs ml-2">{group.name}</span>}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => {
                        if (isEditing) { setEditStoreId(null); return }
                        openEditStore({ store, waiting, calling, completed, total, repairPending, deliveryWaiting })
                      }}
                        className={`p-1.5 rounded-lg transition-colors ${isEditing ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'}`}>
                        {isEditing ? <X size={13} /> : <Pencil size={13} />}
                      </button>
                      <button onClick={() => setColorPickerStoreId(colorPickerStoreId === store.id ? null : store.id)}
                        className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors" title="テーマカラーを変更">
                        <Palette size={13} className="text-gray-300" />
                      </button>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        store.is_open
                          ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                          : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>{store.is_open ? '受付中' : '停止'}</span>
                    </div>
                  </div>

                  {/* カラーピッカー */}
                  {colorPickerStoreId === store.id && (
                    <ColorPicker storeId={store.id}
                      currentColor={themeOverrides[store.id] ?? (store as any).theme_color ?? null}
                      onSaved={(c) => { setThemeOverrides(prev => ({ ...prev, [store.id]: c })); setColorPickerStoreId(null) }}
                      dark />
                  )}

                  {/* 店舗編集パネル */}
                  {isEditing && (
                    <div className="mt-3 border border-gray-700 rounded-xl p-3 space-y-3">
                      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">店舗設定</p>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <label className="text-[10px] text-gray-400 mb-1 block">店舗名</label>
                          <input value={editStoreName} onChange={e => setEditStoreName(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 mb-1 block">店舗PIN</label>
                          <input value={editStorePin} onChange={e => setEditStorePin(e.target.value)}
                            maxLength={4} inputMode="numeric"
                            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-400 mb-1 block">会社</label>
                          <select value={editStoreGroupId} onChange={e => setEditStoreGroupId(e.target.value)}
                            className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                            <option value="">— 独立店舗 —</option>
                            {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                          </select>
                        </div>
                      </div>

                      {/* 機能フラグ */}
                      <div>
                        <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-wider">利用機能（プラン）</p>
                        <div className="grid grid-cols-2 gap-1.5">
                          {FEATURES.map(f => {
                            const on = editStoreFeatures[f.key] !== false
                            return (
                              <button key={f.key}
                                onClick={() => setEditStoreFeatures(prev => ({ ...prev, [f.key]: !on }))}
                                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-left text-xs font-bold transition-all ${
                                  on ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                                     : 'border-gray-700 bg-gray-700/50 text-gray-500'
                                }`}>
                                <span>{f.icon}</span>
                                <span className="flex-1">{f.label}</span>
                                <div className={`w-7 h-4 rounded-full shrink-0 transition-colors ${on ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                                  <div className={`w-3 h-3 bg-white rounded-full mt-0.5 transition-transform shadow ${on ? 'translate-x-3.5' : 'translate-x-0.5'}`} />
                                </div>
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {storeMsg && (
                        <p className={`text-xs px-3 py-2 rounded-xl ${storeMsg.ok ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
                          {storeMsg.text}
                        </p>
                      )}

                      <div className="flex gap-2">
                        <button onClick={saveStore} disabled={storeSaving}
                          className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-bold flex items-center justify-center gap-1.5 transition-colors">
                          {storeSaving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          保存
                        </button>
                        {deleteStoreId === store.id ? (
                          <button onClick={() => deleteStore(store.id)}
                            className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-bold transition-colors">
                            本当に削除
                          </button>
                        ) : (
                          <button onClick={() => setDeleteStoreId(store.id)}
                            className="px-4 py-2 rounded-xl bg-gray-700 hover:bg-red-900/50 text-red-400 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      {deleteStoreId === store.id && (
                        <p className="text-xs text-red-400 text-center">⚠️ 受付データ・顧客データも全て削除されます</p>
                      )}
                    </div>
                  )}
                </div>

                {/* 統計 */}
                <div className="px-4 pt-3 pb-0">
                  <div className="grid grid-cols-4 gap-2 text-center mb-2">
                    <MiniStatCard label="合計" value={total}     color="text-white" />
                    <MiniStatCard label="待機" value={waiting}   color="text-blue-400" />
                    <MiniStatCard label="呼出" value={calling}   color="text-yellow-400" />
                    <MiniStatCard label="完了" value={completed} color="text-green-400" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    <div className="bg-gray-700 rounded-xl py-2 flex items-center justify-center gap-1.5">
                      <Scissors size={11} className="text-amber-400" />
                      <span className="text-amber-400 font-black text-lg">{repairPending}</span>
                      <span className="text-gray-400 text-xs">お直し</span>
                    </div>
                    <div className="bg-gray-700 rounded-xl py-2 flex items-center justify-center gap-1.5">
                      <Package size={11} className="text-teal-400" />
                      <span className="text-teal-400 font-black text-lg">{deliveryWaiting}</span>
                      <span className="text-gray-400 text-xs">お渡し待ち</span>
                    </div>
                  </div>
                </div>

                {/* アクションボタン */}
                <div className="px-4 pb-4 grid grid-cols-2 gap-2">
                  <a href={`/${store.id}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-sm font-bold">
                    <ExternalLink size={13} />受付ページ
                  </a>
                  <button onClick={() => {
                    sessionStorage.setItem('admin_auth', '1')
                    sessionStorage.setItem('admin_store_id', store.id)
                    window.open(`/${store.id}/admin`, '_blank')
                  }} className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-300 text-sm font-bold">
                    <ShieldCheck size={13} />管理画面
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* 店舗追加フォーム */}
        <div className="mt-4 border border-dashed border-gray-600 rounded-2xl overflow-hidden">
          <button onClick={() => { setShowAddForm(v => !v); setAddMsg(null) }}
            className="w-full flex items-center justify-between px-4 py-3 text-gray-400 hover:text-white transition-colors">
            <span className="flex items-center gap-2 text-sm font-bold">
              <Plus size={15} />新規店舗・会社を追加
            </span>
            {showAddForm ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          {showAddForm && (
            <div className="px-4 pb-4 space-y-3 border-t border-gray-700">
              <div className="pt-3 space-y-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">店舗名 *</label>
                  <input value={addStoreName} onChange={e => setAddStoreName(e.target.value)}
                    placeholder="例: ひものや 南店"
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">店舗PIN (4桁)</label>
                  <input value={addStorePin} onChange={e => setAddStorePin(e.target.value)}
                    maxLength={4} inputMode="numeric" placeholder="1111"
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">会社（グループ）</label>
                  <div className="flex gap-2 mb-2">
                    {(['existing','new'] as const).map(m => (
                      <button key={m} onClick={() => setAddGroupMode(m)}
                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${addGroupMode === m ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                        {m === 'existing' ? '既存の会社' : '新しい会社'}
                      </button>
                    ))}
                  </div>
                  {addGroupMode === 'existing' ? (
                    <select value={addGroupId} onChange={e => setAddGroupId(e.target.value)}
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                      <option value="">— 会社なし（独立店舗）—</option>
                      {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  ) : (
                    <div className="space-y-2">
                      <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)}
                        placeholder="会社名 例: 学生服のタナカ"
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none" />
                      <input value={newGroupCode} onChange={e => setNewGroupCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        placeholder="URLコード 例: tanaka (英数字)"
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none" />
                      <input value={newGroupPin} onChange={e => setNewGroupPin(e.target.value)}
                        maxLength={4} inputMode="numeric" placeholder="会社PIN 1111"
                        className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none" />
                    </div>
                  )}
                </div>

                {addMsg && (
                  <div className={`text-sm px-3 py-2 rounded-xl ${addMsg.ok ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50' : 'bg-red-900/40 text-red-300 border border-red-700/50'}`}>
                    {addMsg.text}
                  </div>
                )}

                <button disabled={adding || !addStoreName.trim()}
                  onClick={async () => {
                    setAdding(true); setAddMsg(null)
                    const body: Record<string, string> = { storeName: addStoreName, storePin: addStorePin }
                    if (addGroupMode === 'existing' && addGroupId) body.groupId = addGroupId
                    else if (addGroupMode === 'new') {
                      body.newGroupName = newGroupName
                      body.newGroupCode = newGroupCode
                      body.newGroupPin  = newGroupPin
                    }
                    const res = await fetch('/api/super-admin/stores', {
                      method: 'POST', headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(body),
                    })
                    const json = await res.json()
                    setAdding(false)
                    if (!res.ok) { setAddMsg({ ok: false, text: json.error ?? '追加失敗' }); return }
                    setAddMsg({ ok: true, text: `✅ 「${addStoreName}」を追加しました` })
                    setAddStoreName(''); setAddStorePin('1111')
                    setNewGroupName(''); setNewGroupCode(''); setNewGroupPin('1111'); setAddGroupId('')
                    fetchAll()
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm transition-all flex items-center justify-center gap-2">
                  {adding ? <><Loader2 size={14} className="animate-spin" />追加中...</> : <><Plus size={14} />追加する</>}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">30秒ごとに自動更新</p>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className={`text-4xl font-black tabular-nums ${color}`}>{value}</div>
      <div className="text-gray-400 text-xs mt-0.5">{label}</div>
    </div>
  )
}

function MiniStatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-700 rounded-xl py-2">
      <div className={`text-2xl font-black tabular-nums ${color}`}>{value}</div>
      <div className="text-gray-400 text-xs">{label}</div>
    </div>
  )
}

export default function SuperAdminPage() {
  const [authed,  setAuthed]  = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (sessionStorage.getItem('super_admin_auth') === '1') setAuthed(true)
    setChecked(true)
  }, [])

  if (!checked) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-gray-400" />
      </div>
    )
  }

  if (!authed) return <PinScreen onAuth={() => setAuthed(true)} />
  return <SuperDashboard />
}
