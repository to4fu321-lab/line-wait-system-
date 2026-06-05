'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  RefreshCw, Loader2, ExternalLink, ShieldCheck, Scissors, Package,
  Plus, ChevronDown, ChevronUp, Palette, Pencil, Trash2, X, Check, Building2,
} from 'lucide-react'
import ColorPicker from '@/app/_components/ColorPicker'
import type { Store, BusinessType } from '@/types/database'
import { PLAN_DEFS, type Plan, type FeatureKey } from '@/lib/features'

const SUPER_ADMIN_PIN = process.env.NEXT_PUBLIC_SUPER_ADMIN_PIN || '9999'

// ── 細粒度フラグ（プランに加えて個別 on/off できる項目） ────────
const GRANULAR_FEATURES: { key: FeatureKey; label: string; icon: string }[] = [
  { key: 'tab_queue',            label: '受付タブ',         icon: '🔢' },
  { key: 'tab_repairs',          label: '案件タブ',         icon: '✂️' },
  { key: 'tab_inquiries',        label: '問合せタブ',       icon: '💬' },
  { key: 'tab_crm',              label: '顧客タブ',         icon: '👥' },
  { key: 'repairs_tab_purchase', label: '発注サブタブ',     icon: '📋' },
  { key: 'repairs_tab_arrival',  label: '入荷待ちサブタブ', icon: '🚚' },
  { key: 'repairs_tab_delivery', label: 'お渡しサブタブ',   icon: '🎁' },
  { key: 'repairs_ocr',          label: '伝票OCR',          icon: '📷' },
  { key: 'repairs_master',       label: '料金マスタ',       icon: '📐' },
  { key: 'repairs_dummy',        label: 'テストデータ生成', icon: '🗄️' },
  { key: 'reservation',         label: '採寸予約',         icon: '📅' },
  { key: 'orders',              label: '注文管理',         icon: '🛒' },
  { key: 'takeout',             label: 'テイクアウト',     icon: '🥡' },
]

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
  waiting:               number
  calling:               number
  completed:             number
  total:                 number
  repairPending:         number
  deliveryWaiting:       number
  takeoutPending:        number
  takeoutPreparing:      number
  takeoutReady:          number
  takeoutCompletedToday: number
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
// 店舗カード（編集パネル込み）
// ============================================================
function StoreCard({
  stat, groups, isEditing, onOpenEdit, onCloseEdit, onSaved, onDeleted,
  colorPickerStoreId, onOpenColorPicker, onColorSaved,
}: {
  stat: StoreStats
  groups: GroupInfo[]
  isEditing: boolean
  onOpenEdit: () => void
  onCloseEdit: () => void
  onSaved: () => void
  onDeleted: () => void
  colorPickerStoreId: string | null
  onOpenColorPicker: () => void
  onColorSaved: (c: string) => void
}) {
  const { store, waiting, calling, completed, total, repairPending, deliveryWaiting,
          takeoutPending, takeoutPreparing, takeoutReady, takeoutCompletedToday } = stat

  const [name,    setName]    = useState(store.name)
  const [pin,     setPin]     = useState(store.pin ?? '')
  const [groupId, setGroupId] = useState(store.group_id ?? '')
  const [bizType, setBizType] = useState<'uniform' | 'takeout'>((store.business_type as 'uniform' | 'takeout') ?? 'uniform')
  const [features, setFeatures] = useState<Record<string, boolean>>(store.features ?? {})
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<{ ok: boolean; text: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [isTestMode,       setIsTestMode]       = useState<boolean>((store as any).is_test_mode ?? false)
  const [richmenuApplying, setRichmenuApplying] = useState(false)
  const [richmenuMsg,      setRichmenuMsg]      = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    if (isEditing) {
      setName(store.name); setPin(store.pin ?? '')
      setGroupId(store.group_id ?? '')
      setBizType((store.business_type as 'uniform' | 'takeout') ?? 'uniform')
      setFeatures(store.features ?? {})
      setMsg(null); setConfirmDelete(false)
    }
  }, [isEditing, store])

  async function save() {
    setSaving(true); setMsg(null)
    const res = await fetch(`/api/super-admin/stores/${store.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, pin, group_id: groupId || null, features, business_type: bizType }),
    })
    const j = await res.json()
    setSaving(false)
    if (!res.ok) { setMsg({ ok: false, text: j.error ?? '保存失敗' }); return }
    setMsg({ ok: true, text: '保存しました' })
    onSaved()
    setTimeout(onCloseEdit, 800)
  }

  async function del() {
    const res = await fetch(`/api/super-admin/stores/${store.id}`, { method: 'DELETE' })
    const j = await res.json()
    if (!res.ok) { setMsg({ ok: false, text: j.error ?? '削除失敗' }); return }
    onDeleted()
  }

  const isTakeout = store.business_type === 'takeout'

  return (
    <div className="bg-gray-800/80 rounded-2xl overflow-hidden border border-gray-700/50">
      {/* ヘッダー行 */}
      <div className="flex items-center gap-2 px-4 pt-3 pb-2">
        <div className="flex-1 min-w-0 flex items-center gap-1.5 flex-wrap">
          <span className="font-black text-sm text-white">{store.name}</span>
          {isTakeout
            ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">🥡</span>
            : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">🏫</span>
          }
        </div>
        <button onClick={isEditing ? onCloseEdit : onOpenEdit}
          className={`p-1.5 rounded-lg transition-colors shrink-0 ${isEditing ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'}`}>
          {isEditing ? <X size={12} /> : <Pencil size={12} />}
        </button>
        <button onClick={onOpenColorPicker}
          className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 transition-colors shrink-0">
          <Palette size={12} className="text-gray-400" />
        </button>
        <span className={`text-xs font-bold px-2.5 py-1 rounded-full shrink-0 ${
          store.is_open ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>{store.is_open ? '受付中' : '停止'}</span>
      </div>

      {/* カラーピッカー */}
      {colorPickerStoreId === store.id && (
        <div className="px-4 pb-3">
          <ColorPicker storeId={store.id} currentColor={(store as any).theme_color ?? null} onSaved={onColorSaved} dark />
        </div>
      )}

      {/* 編集パネル */}
      {isEditing && (
        <div className="mx-3 mb-3 border border-gray-700 rounded-xl p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-gray-400 mb-1 block">店舗名</label>
              <input value={name} onChange={e => setName(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 mb-1 block">PIN</label>
              <input value={pin} onChange={e => setPin(e.target.value)} maxLength={4} inputMode="numeric"
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-gray-400 mb-1 block">会社</label>
              <select value={groupId} onChange={e => setGroupId(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none">
                <option value="">— 独立 —</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
          </div>

          {/* 業種 */}
          <div>
            <p className="text-[10px] text-gray-400 mb-1.5 uppercase tracking-wider">業種</p>
            <div className="flex gap-2">
              {([{ key: 'uniform', label: '🏫 制服販売' }, { key: 'takeout', label: '🥡 テイクアウト' }] as const).map(t => (
                <button key={t.key} onClick={() => setBizType(t.key)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${bizType === t.key ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* ── プラン選択 ── */}
          <div>
            <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-wider">プラン（機能セット）</p>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(PLAN_DEFS) as [Plan, typeof PLAN_DEFS[Plan]][]).map(([key, def]) => {
                const currentPlan = (features._plan as Plan | undefined) ?? 'full'
                const selected = currentPlan === key
                return (
                  <button key={key}
                    onClick={() => setFeatures(prev => {
                      // プラン変更時は個別オーバーライドをリセット
                      const { _plan: _p, ...overrides } = prev as Record<string, unknown>
                      void _p
                      const planFeatureKeys = Object.keys(def.features) as FeatureKey[]
                      const cleaned = Object.fromEntries(
                        Object.entries(overrides).filter(([k]) => !planFeatureKeys.includes(k as FeatureKey))
                      )
                      return { ...cleaned, _plan: key }
                    })}
                    className={`flex flex-col gap-0.5 px-2.5 py-2 rounded-xl border text-left transition-all ${
                      selected
                        ? `${def.tailwind} ring-1 ring-current`
                        : 'border-gray-700 bg-gray-700/40 text-gray-500 hover:bg-gray-700'
                    }`}>
                    <span className="text-base leading-none">{def.emoji}</span>
                    <span className="text-[11px] font-black leading-none mt-0.5">{def.label}</span>
                    <span className="text-[9px] leading-tight opacity-70">{def.desc}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── 個別フラグ（プランからの上書き） ── */}
          <div>
            <p className="text-[10px] text-gray-400 mb-1.5 uppercase tracking-wider">個別オーバーライド（プランより優先）</p>
            <div className="grid grid-cols-2 gap-1">
              {GRANULAR_FEATURES.map(f => {
                const currentPlan = (features._plan as Plan | undefined) ?? 'full'
                const planDefault = PLAN_DEFS[currentPlan]?.features[f.key as FeatureKey]
                const override = (features as Record<string, unknown>)[f.key]
                const effective = override !== undefined ? (override as boolean) : (planDefault !== false)
                const hasOverride = override !== undefined && override !== planDefault
                return (
                  <button key={f.key}
                    onClick={() => setFeatures(prev => {
                      const next = { ...prev }
                      if (override === undefined) {
                        // 未設定 → planDefault の反転
                        next[f.key] = !effective
                      } else if (override === planDefault) {
                        // plan と同値 → 削除（override 解除）
                        delete next[f.key]
                      } else {
                        // 逆値 → 削除（override 解除）
                        delete next[f.key]
                      }
                      return next
                    })}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-left text-xs font-bold transition-all ${
                      effective
                        ? 'border-indigo-500/50 bg-indigo-500/10 text-indigo-300'
                        : 'border-gray-700 bg-gray-700/50 text-gray-500'
                    }`}>
                    <span className="text-[12px]">{f.icon}</span>
                    <span className="flex-1 text-[10px] leading-tight">{f.label}</span>
                    {hasOverride && <span className="text-[8px] px-1 py-0.5 rounded bg-amber-500/30 text-amber-300 font-black shrink-0">上書</span>}
                    <div className={`w-6 h-3.5 rounded-full shrink-0 transition-colors ${effective ? 'bg-indigo-500' : 'bg-gray-600'}`}>
                      <div className={`w-2.5 h-2.5 bg-white rounded-full mt-0.5 transition-transform shadow ${effective ? 'translate-x-3' : 'translate-x-0.5'}`} />
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {msg && <p className={`text-xs px-3 py-2 rounded-xl ${msg.ok ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>{msg.text}</p>}

          {/* 店舗ツール */}
          <div className="border-t border-gray-700 pt-2 space-y-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider">店舗ツール</p>
            <button
              onClick={async () => {
                const next = !isTestMode
                setIsTestMode(next)
                await fetch('/api/test/mode', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ storeId: store.id, enabled: next }),
                })
              }}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-bold transition-all ${
                isTestMode ? 'border-amber-500/50 bg-amber-500/10 text-amber-300' : 'border-gray-700 bg-gray-700/50 text-gray-400 hover:bg-gray-700'
              }`}>
              <span>🧪 テストモード</span>
              <div className={`w-8 h-4 rounded-full transition-colors ${isTestMode ? 'bg-amber-500' : 'bg-gray-600'}`}>
                <div className={`w-3 h-3 bg-white rounded-full mt-0.5 shadow transition-transform ${isTestMode ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </button>
            <button
              onClick={async () => {
                setRichmenuApplying(true); setRichmenuMsg(null)
                try {
                  const res = await fetch('/api/richmenu', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ storeId: store.id, storeName: name }),
                  })
                  const data = await res.json()
                  if (!res.ok || !data.ok) throw new Error(data.error || `HTTP ${res.status}`)
                  setRichmenuMsg({ ok: true, text: `登録完了 (${data.richMenuId?.slice(0, 8)}...)` })
                } catch (e) {
                  setRichmenuMsg({ ok: false, text: e instanceof Error ? e.message : String(e) })
                } finally {
                  setRichmenuApplying(false)
                }
              }}
              disabled={richmenuApplying}
              className="w-full py-2 rounded-xl bg-green-900/40 border border-green-700/50 text-green-300 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-green-900/60 disabled:opacity-50 transition-colors">
              {richmenuApplying ? <Loader2 size={12} className="animate-spin" /> : '📲'}
              LINEリッチメニューを更新
            </button>
            {richmenuMsg && (
              <p className={`text-xs text-center ${richmenuMsg.ok ? 'text-emerald-300' : 'text-red-400'}`}>
                {richmenuMsg.ok ? '✅ ' : '❌ '}{richmenuMsg.text}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}保存
            </button>
            {confirmDelete ? (
              <button onClick={del} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold">本当に削除</button>
            ) : (
              <button onClick={() => setConfirmDelete(true)} className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-red-900/50 text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            )}
          </div>
          {confirmDelete && <p className="text-[10px] text-red-400 text-center">⚠️ 受付・顧客データも全て削除されます</p>}
        </div>
      )}

      {/* 統計・リンク */}
      <div className="px-3 pb-3 space-y-2">
        {isTakeout ? (
          <>
            {/* テイクアウト統計 */}
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {([
                ['受付中',   takeoutPending,        'text-blue-400'],
                ['調理中',   takeoutPreparing,      'text-amber-400'],
                ['渡し待ち', takeoutReady,          'text-emerald-400'],
                ['本日完了', takeoutCompletedToday, 'text-white'],
              ] as [string, number, string][]).map(([label, val, color]) => (
                <div key={label} className="bg-gray-700/80 rounded-xl py-1.5">
                  <div className={`text-xl font-black tabular-nums ${color}`}>{val}</div>
                  <div className="text-gray-400 text-[10px]">{label}</div>
                </div>
              ))}
            </div>
            {/* ボタン */}
            <div className="grid grid-cols-2 gap-1.5">
              <button onClick={() => {
                sessionStorage.setItem('admin_auth', '1')
                sessionStorage.setItem('admin_store_id', store.id)
                window.open(`/${store.id}/kitchen`, '_blank')
              }} className="flex items-center justify-center gap-1 py-2 rounded-xl bg-orange-600/20 border border-orange-500/30 text-orange-300 text-xs font-bold">
                🍳 キッチン
              </button>
              <button onClick={() => {
                sessionStorage.setItem('admin_auth', '1')
                sessionStorage.setItem('admin_store_id', store.id)
                window.open(`/${store.id}/takeout-admin`, '_blank')
              }} className="flex items-center justify-center gap-1 py-2 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <ShieldCheck size={11} />管理
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-1.5 text-center">
              {[['合計', total, 'text-white'], ['待機', waiting, 'text-blue-400'], ['呼出', calling, 'text-yellow-400'], ['完了', completed, 'text-green-400']].map(([label, val, color]) => (
                <div key={label as string} className="bg-gray-700/80 rounded-xl py-1.5">
                  <div className={`text-xl font-black tabular-nums ${color}`}>{val}</div>
                  <div className="text-gray-400 text-[10px]">{label}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="bg-gray-700/80 rounded-xl py-1.5 flex items-center justify-center gap-1">
                <Scissors size={10} className="text-amber-400" />
                <span className="text-amber-400 font-black">{repairPending}</span>
                <span className="text-gray-400 text-[10px]">お直し</span>
              </div>
              <div className="bg-gray-700/80 rounded-xl py-1.5 flex items-center justify-center gap-1">
                <Package size={10} className="text-teal-400" />
                <span className="text-teal-400 font-black">{deliveryWaiting}</span>
                <span className="text-gray-400 text-[10px]">お渡し待ち</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <a href={`/${store.id}`} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-1 py-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
                <ExternalLink size={11} />受付ページ
              </a>
              <button onClick={() => {
                sessionStorage.setItem('admin_auth', '1')
                sessionStorage.setItem('admin_store_id', store.id)
                window.open(`/${store.id}/admin`, '_blank')
              }} className="flex items-center justify-center gap-1 py-2 rounded-xl bg-amber-600/20 border border-amber-500/30 text-amber-300 text-xs font-bold">
                <ShieldCheck size={11} />管理画面
              </button>
            </div>
          </>
        )}
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

  const [colorPickerStoreId, setColorPickerStoreId] = useState<string | null>(null)
  const [editStoreId,        setEditStoreId]        = useState<string | null>(null)
  const [bizFilter,          setBizFilter]          = useState<'all' | BusinessType>('all')

  // 会社編集
  const [editGroupId,    setEditGroupId]    = useState<string | null>(null)
  const [editGroupName,  setEditGroupName]  = useState('')
  const [editGroupCode,  setEditGroupCode]  = useState('')
  const [editGroupPin,   setEditGroupPin]   = useState('')
  const [groupSaving,    setGroupSaving]    = useState(false)
  const [groupMsg,       setGroupMsg]       = useState<{ ok: boolean; text: string } | null>(null)
  const [deleteGroupId,  setDeleteGroupId]  = useState<string | null>(null)

  // 折りたたみ（グループID → 開閉）デフォルト全開
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  // 店舗追加フォーム
  const [showAddForm,  setShowAddForm]  = useState(false)
  const [addStoreName, setAddStoreName] = useState('')
  const [addStorePin,  setAddStorePin]  = useState('1111')
  const [addBizType,   setAddBizType]   = useState<BusinessType>('uniform')
  const [addGroupMode, setAddGroupMode] = useState<'existing' | 'new'>('existing')
  const [addGroupId,   setAddGroupId]   = useState('')
  const [newGroupName, setNewGroupName] = useState('')
  const [newGroupCode, setNewGroupCode] = useState('')
  const [newGroupPin,  setNewGroupPin]  = useState('1111')
  const [adding,       setAdding]       = useState(false)
  const [addMsg,       setAddMsg]       = useState<{ ok: boolean; text: string } | null>(null)

  const fetchAll = useCallback(async () => {
    setRefreshing(true); setFetchError(null)
    try {
      const res = await fetch('/api/super-admin/stats')
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setFetchError(`サーバーエラー (${res.status}): ${body.error || res.statusText}`)
        return
      }
      const body = await res.json()
      if (!body.stats || body.stats.length === 0)
        setFetchError('storesテーブルにデータがありません（RLSポリシーまたはデータ未挿入）')
      setStoreStats(body.stats ?? [])
      setGroups(body.groups ?? [])
      setLastUpdated(new Date())
    } catch (e) {
      setFetchError(`ネットワークエラー: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRefreshing(false); setLoading(false)
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

  function openEditGroup(g: GroupInfo) {
    setEditGroupId(g.id); setEditGroupName(g.name)
    setEditGroupCode(g.code ?? ''); setEditGroupPin(g.pin ?? '')
    setGroupMsg(null); setDeleteGroupId(null)
  }

  async function saveGroup() {
    if (!editGroupId) return
    setGroupSaving(true); setGroupMsg(null)
    const res = await fetch(`/api/super-admin/groups/${editGroupId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editGroupName, code: editGroupCode, pin: editGroupPin }),
    })
    const j = await res.json()
    setGroupSaving(false)
    if (!res.ok) { setGroupMsg({ ok: false, text: j.error ?? '保存失敗' }); return }
    setGroupMsg({ ok: true, text: '保存しました' })
    fetchAll(); setTimeout(() => setEditGroupId(null), 800)
  }

  async function deleteGroup(groupId: string) {
    const res = await fetch(`/api/super-admin/groups/${groupId}`, { method: 'DELETE' })
    const j = await res.json()
    if (!res.ok) { setGroupMsg({ ok: false, text: j.error ?? '削除失敗' }); return }
    setDeleteGroupId(null); setEditGroupId(null); fetchAll()
  }

  const uniformCount = storeStats.filter(x => (x.store.business_type ?? 'uniform') !== 'takeout').length
  const takeoutCount = storeStats.filter(x => x.store.business_type === 'takeout').length

  const filterStats = (stats: StoreStats[]) => stats.filter(x => {
    if (bizFilter === 'all')     return true
    if (bizFilter === 'takeout') return x.store.business_type === 'takeout'
    return (x.store.business_type ?? 'uniform') !== 'takeout'
  })

  // 会社ごとにグループ化
  const grouped = groups.map(g => ({
    group: g,
    stats: storeStats.filter(s => s.store.group_id === g.id),
  }))
  const standalone = storeStats.filter(s => !s.store.group_id || !groups.find(g => g.id === s.store.group_id))

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-gray-400" />
      </div>
    )
  }

  const toggleCollapse = (key: string) =>
    setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="px-4 py-5">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-black">🏢 総管理ダッシュボード</h1>
            {lastUpdated && <p className="text-gray-500 text-xs mt-0.5">最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}</p>}
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
        <div className="bg-gray-800 rounded-2xl p-4 mb-6">
          <p className="text-gray-400 text-xs font-bold uppercase tracking-wider mb-3">全店合計</p>
          <div className="grid grid-cols-3 gap-3">
            {[['合計受付', totalAll, 'text-white'], ['全待機数', totalWaiting, 'text-blue-400'], ['全完了数', totalCompleted, 'text-green-400']].map(([label, val, color]) => (
              <div key={label as string} className="text-center">
                <div className={`text-4xl font-black tabular-nums ${color}`}>{val}</div>
                <div className="text-gray-400 text-xs mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── 業種フィルタータブ ─── */}
        <div className="flex gap-2 mb-4">
          {([
            { key: 'all',     label: `すべて ${storeStats.length}` },
            { key: 'uniform', label: `🏫 制服 ${uniformCount}` },
            { key: 'takeout', label: `🥡 テイクアウト ${takeoutCount}` },
          ] as { key: 'all' | BusinessType; label: string }[]).map(t => (
            <button key={t.key} onClick={() => setBizFilter(t.key)}
              className={`px-3 py-1.5 rounded-xl text-sm font-bold transition-all ${
                bizFilter === t.key ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 会社グループ × 店舗一覧 */}
        <div className="space-y-3">
          {grouped.map(({ group, stats }) => {
            const filtered     = filterStats(stats)
            if (filtered.length === 0 && bizFilter !== 'all') return null
            const isOpen = !collapsed[group.id]
            const isEditingGroup = editGroupId === group.id
            const groupTotal   = filtered.reduce((s, x) => s + x.total, 0)
            const groupWaiting = filtered.reduce((s, x) => s + x.waiting, 0)

            return (
              <div key={group.id} className="border border-gray-700/60 rounded-2xl overflow-hidden">
                {/* 会社ヘッダー */}
                <div className="bg-gray-800 flex items-center gap-2 px-3 py-2.5">
                  <button onClick={() => toggleCollapse(group.id)} className="flex items-center gap-2 flex-1 min-w-0">
                    <Building2 size={14} className="text-indigo-400 shrink-0" />
                    <span className="font-black text-sm text-white truncate">{group.name}</span>
                    {group.code && <span className="text-[10px] text-gray-500 font-mono shrink-0">{group.code}</span>}
                    <span className="text-[10px] text-gray-500 shrink-0">{stats.length}店舗</span>
                    {groupWaiting > 0 && (
                      <span className="text-[10px] bg-blue-500/20 text-blue-300 border border-blue-500/20 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                        待機{groupWaiting}
                      </span>
                    )}
                  </button>
                  <a href={`/company/${group.code ?? group.id}`} target="_blank" rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-indigo-300 transition-colors shrink-0">
                    <ExternalLink size={12} />
                  </a>
                  <button onClick={() => isEditingGroup ? setEditGroupId(null) : openEditGroup(group)}
                    className={`p-1.5 rounded-lg transition-colors shrink-0 ${isEditingGroup ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-400'}`}>
                    {isEditingGroup ? <X size={12} /> : <Pencil size={12} />}
                  </button>
                  <button onClick={() => toggleCollapse(group.id)} className="p-1.5 rounded-lg bg-gray-700 text-gray-400 shrink-0">
                    {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                </div>

                {/* 会社編集パネル */}
                {isEditingGroup && (
                  <div className="bg-gray-800/60 border-t border-gray-700 px-3 pb-3 pt-3 space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <label className="text-[10px] text-gray-400 mb-1 block">会社名</label>
                        <input value={editGroupName} onChange={e => setEditGroupName(e.target.value)}
                          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 mb-1 block">URLコード</label>
                        <input value={editGroupCode} onChange={e => setEditGroupCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-indigo-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-400 mb-1 block">会社PIN</label>
                        <input value={editGroupPin} onChange={e => setEditGroupPin(e.target.value)} maxLength={4} inputMode="numeric"
                          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none" />
                      </div>
                    </div>
                    {groupMsg && <p className={`text-xs px-3 py-2 rounded-xl ${groupMsg.ok ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>{groupMsg.text}</p>}
                    <div className="flex gap-2">
                      <button onClick={saveGroup} disabled={groupSaving}
                        className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1 transition-colors">
                        {groupSaving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}保存
                      </button>
                      {deleteGroupId === group.id ? (
                        <button onClick={() => deleteGroup(group.id)} className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold">本当に削除</button>
                      ) : (
                        <button onClick={() => setDeleteGroupId(group.id)} className="px-3 py-2 rounded-xl bg-gray-700 hover:bg-red-900/50 text-red-400 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    {deleteGroupId === group.id && <p className="text-[10px] text-red-400 text-center">⚠️ 所属店舗のグループ紐付けが解除されます</p>}
                  </div>
                )}

                {/* 店舗一覧（折りたたみ） */}
                {isOpen && (
                  <div className="p-2 space-y-2 bg-gray-900/30">
                    {filtered.length === 0 ? (
                      <p className="text-center text-gray-600 text-xs py-3">店舗なし</p>
                    ) : (
                      filtered.map(stat => (
                        <StoreCard key={stat.store.id} stat={stat} groups={groups}
                          isEditing={editStoreId === stat.store.id}
                          onOpenEdit={() => { setEditStoreId(stat.store.id); setColorPickerStoreId(null) }}
                          onCloseEdit={() => setEditStoreId(null)}
                          onSaved={fetchAll} onDeleted={fetchAll}
                          colorPickerStoreId={colorPickerStoreId}
                          onOpenColorPicker={() => setColorPickerStoreId(colorPickerStoreId === stat.store.id ? null : stat.store.id)}
                          onColorSaved={() => setColorPickerStoreId(null)}
                        />
                      ))
                    )}
                  </div>
                )}
                {!isOpen && (
                  <div className="bg-gray-900/30 px-4 py-2 text-center text-gray-600 text-xs">
                    {filtered.length}店舗 — 合計受付{groupTotal} / 待機{groupWaiting}
                  </div>
                )}
              </div>
            )
          })}

          {/* 独立店舗（会社なし） */}
          {(() => {
            const filteredStandalone = filterStats(standalone)
            if (filteredStandalone.length === 0) return null
            return (
              <div className="border border-gray-700/60 rounded-2xl overflow-hidden">
                <button onClick={() => toggleCollapse('__standalone')}
                  className="w-full bg-gray-800 flex items-center gap-2 px-3 py-2.5">
                  <Building2 size={14} className="text-gray-500 shrink-0" />
                  <span className="font-black text-sm text-gray-300 flex-1 text-left">独立店舗（会社なし）</span>
                  <span className="text-[10px] text-gray-500">{filteredStandalone.length}店舗</span>
                  {collapsed['__standalone'] ? <ChevronDown size={12} className="text-gray-500" /> : <ChevronUp size={12} className="text-gray-500" />}
                </button>
                {!collapsed['__standalone'] && (
                  <div className="p-2 space-y-2 bg-gray-900/30">
                    {filteredStandalone.map(stat => (
                      <StoreCard key={stat.store.id} stat={stat} groups={groups}
                        isEditing={editStoreId === stat.store.id}
                        onOpenEdit={() => { setEditStoreId(stat.store.id); setColorPickerStoreId(null) }}
                        onCloseEdit={() => setEditStoreId(null)}
                        onSaved={fetchAll} onDeleted={fetchAll}
                        colorPickerStoreId={colorPickerStoreId}
                        onOpenColorPicker={() => setColorPickerStoreId(colorPickerStoreId === stat.store.id ? null : stat.store.id)}
                        onColorSaved={() => setColorPickerStoreId(null)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
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
            <div className="px-4 pb-4 border-t border-gray-700 pt-3 space-y-3">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">店舗名 *</label>
                <input value={addStoreName} onChange={e => setAddStoreName(e.target.value)} placeholder="例: ひものや 南店"
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">店舗PIN (4桁)</label>
                <input value={addStorePin} onChange={e => setAddStorePin(e.target.value)} maxLength={4} inputMode="numeric" placeholder="1111"
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
                    <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="会社名"
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none" />
                    <input value={newGroupCode} onChange={e => setNewGroupCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="URLコード（英数字）"
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none" />
                    <input value={newGroupPin} onChange={e => setNewGroupPin(e.target.value)} maxLength={4} inputMode="numeric" placeholder="会社PIN"
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none" />
                  </div>
                )}
              </div>

              {/* 業種 */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">業種</label>
                <div className="flex gap-2">
                  {([
                    { key: 'uniform', label: '🏫 制服販売' },
                    { key: 'takeout', label: '🥡 テイクアウト' },
                  ] as { key: BusinessType; label: string }[]).map(t => (
                    <button key={t.key} onClick={() => setAddBizType(t.key)}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${addBizType === t.key ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {addMsg && (
                <div className={`text-sm px-3 py-2 rounded-xl ${addMsg.ok ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700/50' : 'bg-red-900/40 text-red-300 border border-red-700/50'}`}>
                  {addMsg.text}
                </div>
              )}
              <button disabled={adding || !addStoreName.trim()}
                onClick={async () => {
                  setAdding(true); setAddMsg(null)
                  const body: Record<string, string> = { storeName: addStoreName, storePin: addStorePin, businessType: addBizType }
                  if (addGroupMode === 'existing' && addGroupId) body.groupId = addGroupId
                  else if (addGroupMode === 'new') { body.newGroupName = newGroupName; body.newGroupCode = newGroupCode; body.newGroupPin = newGroupPin }
                  const res = await fetch('/api/super-admin/stores', {
                    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
                  })
                  const json = await res.json()
                  setAdding(false)
                  if (!res.ok) { setAddMsg({ ok: false, text: json.error ?? '追加失敗' }); return }
                  setAddMsg({ ok: true, text: `✅ 「${addStoreName}」を追加しました` })
                  setAddStoreName(''); setAddStorePin('1111'); setAddBizType('uniform')
                  setNewGroupName(''); setNewGroupCode(''); setNewGroupPin('1111'); setAddGroupId('')
                  fetchAll()
                }}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all">
                {adding ? <><Loader2 size={14} className="animate-spin" />追加中...</> : <><Plus size={14} />追加する</>}
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">30秒ごとに自動更新</p>
      </div>
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
    return <div className="min-h-screen bg-gray-900 flex items-center justify-center"><Loader2 size={40} className="animate-spin text-gray-400" /></div>
  }
  if (!authed) return <PinScreen onAuth={() => setAuthed(true)} />
  return <SuperDashboard />
}
