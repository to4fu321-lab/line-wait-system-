'use client'

// ============================================================
// 保護者マイページ
// LINEログイン済みの保護者が自分の注文・お直し状況を確認できる
// ============================================================

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Package, Scissors, User, School, ChevronRight,
  Loader2, AlertCircle, Clock, CheckCircle2, ShoppingBag,
  RefreshCw, GraduationCap, Ruler, Edit2, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { initLiff } from '@/lib/liff'
import { fetchMypage, saveCustomer } from '@/lib/customerApi'
import type { Customer, Child, PurchaseOrder, RepairHistory } from '@/types/crm'
import {
  PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS,
  REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS,
  GRADE_OPTIONS,
} from '@/types/crm'

interface StoreInfo {
  name: string
  logo_emoji: string | null
  primary_color: string | null
}

function formatDate(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}

function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {label}
    </span>
  )
}

export default function MyPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()

  const [loading, setLoading]           = useState(true)
  const [customer, setCustomer]         = useState<Customer | null>(null)
  const [children, setChildren]         = useState<Child[]>([])
  const [purchases, setPurchases]       = useState<PurchaseOrder[]>([])
  const [repairs, setRepairs]           = useState<RepairHistory[]>([])
  const [store, setStore]               = useState<StoreInfo | null>(null)
  const [error, setError]               = useState<string | null>(null)
  const [refreshing, setRefreshing]     = useState(false)
  const [measurementsByChild, setMeasurementsByChild] = useState<Record<string, { height: string; weight?: string; date: string }[]>>({})
  const [editingChild, setEditingChild]   = useState<Child | null>(null)
  const [editForm, setEditForm]           = useState({ school_name: '', grade: '', admission_year: '' })
  const [editSaving, setEditSaving]       = useState(false)
  const [editError, setEditError]         = useState<string | null>(null)

  const loadData = useCallback(async (silent = false) => {
    if (!storeId) return
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setError(null)
    try {
      // ストア情報
      const { data: storeData } = await (supabase as any)
        .from('stores')
        .select('name, logo_emoji, primary_color')
        .eq('id', storeId)
        .single()
      if (storeData) setStore(storeData)

      // LIFF初期化 + マイページデータ一式(本人確認はサーバー側)
      await initLiff()
      let payload
      try {
        payload = await fetchMypage(storeId)
      } catch {
        router.replace(`/${storeId}`)
        return
      }
      if (!payload.customer) {
        router.replace(`/${storeId}`)
        return
      }
      setCustomer(payload.customer)

      const kids: Child[] = (payload.children ?? []) as Child[]
      setChildren(kids)
      setPurchases((payload.purchases ?? []) as PurchaseOrder[])
      setRepairs((payload.repairs ?? []) as RepairHistory[])

      // 採寸記録: 各お子様の身長・体重履歴(queues details 由来)
      const byChild: Record<string, { height: string; weight?: string; date: string }[]> = {}
      for (const q of (payload.queueMeasurements ?? [])) {
        if (!q.child_id || !q.details?.height) continue
        if (!byChild[q.child_id]) byChild[q.child_id] = []
        if (byChild[q.child_id].length < 5) {
          byChild[q.child_id].push({
            height: q.details.height,
            weight: q.details.weight,
            date: q.created_at,
          })
        }
      }
      setMeasurementsByChild(byChild)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データの取得に失敗しました')
    }
    if (!silent) setLoading(false)
    else setRefreshing(false)
  }, [storeId, router])

  useEffect(() => { loadData() }, [loadData])

  const openEdit = (child: Child) => {
    setEditingChild(child)
    setEditForm({
      school_name: child.school_name ?? '',
      grade: child.grade ?? '',
      admission_year: child.admission_year?.toString() ?? '',
    })
    setEditError(null)
  }

  const saveChild = async () => {
    if (!editingChild || !customer) return
    setEditSaving(true)
    setEditError(null)
    try {
      const updates = {
        school_name:    editForm.school_name || null,
        grade:          editForm.grade || null,
        admission_year: editForm.admission_year ? parseInt(editForm.admission_year) : null,
      }
      await saveCustomer(storeId, { childUpdate: { id: editingChild.id, ...updates } })
      setChildren(prev => prev.map(c => c.id === editingChild.id ? { ...c, ...updates } : c))
      setEditingChild(null)
    } catch (e) {
      setEditError(e instanceof Error ? e.message : '保存に失敗しました')
    }
    setEditSaving(false)
  }

  const activePurchases  = purchases.filter(p => p.status !== 'delivered')
  const deliveredPurchases = purchases.filter(p => p.status === 'delivered').slice(0, 5)
  const activeRepairs    = repairs.filter(r => r.status !== 'delivered')
  const deliveredRepairs = repairs.filter(r => r.status === 'delivered').slice(0, 5)

  const primaryColor = store?.primary_color ?? '#4F46E5'

  if (loading) return (
    <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
      <Loader2 className="animate-spin text-indigo-400" size={32} />
    </div>
  )

  if (error) return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <AlertCircle size={36} className="text-red-400" />
      <p className="text-sm text-gray-600">{error}</p>
      <button onClick={() => loadData()} className="text-sm text-indigo-600 underline">再試行</button>
    </div>
  )

  return (
    <div className="min-h-[100dvh] bg-gray-50 pb-12">
      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-10"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="flex items-center gap-3 max-w-md mx-auto">
          <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100">
            <ArrowLeft size={18} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-gray-900">マイページ</h1>
            <p className="text-[11px] text-gray-500">{store?.name}</p>
          </div>
          <button onClick={() => loadData(true)} className="p-2 rounded-xl hover:bg-gray-100" disabled={refreshing}>
            <RefreshCw size={15} className={`text-gray-400 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <div className="p-4 space-y-4 max-w-md mx-auto">

        {/* 保護者情報 */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white text-lg font-black"
              style={{ background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}cc)` }}>
              <User size={18} />
            </div>
            <div>
              <p className="text-sm font-black text-gray-900">{customer?.name}</p>
              {customer?.tel && <p className="text-[11px] text-gray-500">{customer.tel}</p>}
            </div>
          </div>
        </div>

        {/* お子様情報 */}
        {children.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <GraduationCap size={14} className="text-gray-400" />
              <span className="text-sm font-bold text-gray-700">お子様情報</span>
            </div>
            {children.map(child => {
              const measurements = measurementsByChild[child.id] ?? []
              return (
                <div key={child.id} className="bg-gray-50 rounded-xl px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-xl flex items-center justify-center text-white text-xs font-black shrink-0"
                      style={{ background: primaryColor }}>
                      {child.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-800">{child.name}</p>
                      <p className="text-[10px] text-gray-500">
                        {child.school_name ?? '学校未設定'}
                        {child.grade && ` · ${child.grade}`}
                      </p>
                    </div>
                    {child.gender === 'male' && <span className="text-[10px] text-blue-500 font-bold">男子</span>}
                    {child.gender === 'female' && <span className="text-[10px] text-pink-500 font-bold">女子</span>}
                    <button
                      onClick={() => openEdit(child)}
                      className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-500 shrink-0">
                      <Edit2 size={12} />
                    </button>
                  </div>
                  {/* 採寸記録 */}
                  {measurements.length > 0 && (
                    <div className="pl-10">
                      <div className="flex items-center gap-1 mb-1">
                        <Ruler size={10} className="text-gray-400" />
                        <span className="text-[10px] font-bold text-gray-400">採寸記録</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {measurements.map((m, i) => (
                          <div key={i} className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-2 py-1">
                            <span className="text-[10px] font-black text-indigo-700">{m.height}cm</span>
                            {m.weight && <span className="text-[10px] text-gray-500">{m.weight}kg</span>}
                            <span className="text-[9px] text-gray-400 ml-0.5">{formatDate(m.date)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* 手配中の注文 */}
        {activePurchases.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Package size={14} className="text-indigo-500" />
              <span className="text-sm font-bold text-gray-700">手配中の注文</span>
              <span className="ml-auto text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{activePurchases.length}件</span>
            </div>
            {activePurchases.map(p => (
              <div key={p.id} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                <ShoppingBag size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{p.item_name}</p>
                  {p.notes && <p className="text-[10px] text-gray-500 truncate">{p.notes}</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {formatDate(p.ordered_date)} 受付
                    {p.arrived_date && ` → ${formatDate(p.arrived_date)} 入荷`}
                  </p>
                </div>
                <StatusBadge label={PURCHASE_STATUS_LABELS[p.status]} color={PURCHASE_STATUS_COLORS[p.status]} />
              </div>
            ))}
          </div>
        )}

        {/* お直し進捗 */}
        {activeRepairs.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Scissors size={14} className="text-amber-500" />
              <span className="text-sm font-bold text-gray-700">お直し進捗</span>
              <span className="ml-auto text-xs font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{activeRepairs.length}件</span>
            </div>
            {activeRepairs.map(r => (
              <div key={r.id} className="flex items-start gap-3 bg-gray-50 rounded-xl px-3 py-2.5">
                <Scissors size={14} className="text-gray-400 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{r.item_name}</p>
                  <p className="text-[10px] text-gray-500 truncate">{r.content}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {formatDate(r.received_date)} 預かり
                    {r.completed_date && ` → ${formatDate(r.completed_date)} 完了`}
                  </p>
                </div>
                <StatusBadge label={REPAIR_STATUS_LABELS[r.status]} color={REPAIR_STATUS_COLORS[r.status]} />
              </div>
            ))}
          </div>
        )}

        {/* 何もなければ案内 */}
        {activePurchases.length === 0 && activeRepairs.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6 text-center">
            <CheckCircle2 size={28} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">手配中の注文・お直しはありません</p>
          </div>
        )}

        {/* 過去の履歴 */}
        {(deliveredPurchases.length > 0 || deliveredRepairs.length > 0) && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={14} className="text-gray-400" />
              <span className="text-sm font-bold text-gray-700">過去の履歴</span>
            </div>
            {deliveredPurchases.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2 opacity-60">
                <ShoppingBag size={12} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-600 truncate">{p.item_name}</p>
                  <p className="text-[10px] text-gray-400">{formatDate(p.delivered_date)} お渡し済み</p>
                </div>
              </div>
            ))}
            {deliveredRepairs.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2 opacity-60">
                <Scissors size={12} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-gray-600 truncate">{r.item_name}</p>
                  <p className="text-[10px] text-gray-400">{formatDate(r.delivered_date)} お渡し済み</p>
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-[10px] text-gray-400 pt-2">
          ご不明な点はお気軽に店舗スタッフまでお声がけください
        </p>

      </div>

      {/* お子様情報編集モーダル */}
      {editingChild && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end"
          onClick={e => { if (e.target === e.currentTarget) setEditingChild(null) }}>
          <div className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-5 space-y-4"
            style={{ paddingBottom: 'max(32px, env(safe-area-inset-bottom))' }}>

            <div className="flex items-center gap-3">
              <GraduationCap size={16} className="text-indigo-500" />
              <h2 className="text-sm font-black text-gray-900 flex-1">{editingChild.name}さんの情報</h2>
              <button onClick={() => setEditingChild(null)} className="p-1.5 rounded-lg hover:bg-gray-100">
                <X size={16} className="text-gray-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block">学校名</label>
                <input
                  value={editForm.school_name}
                  onChange={e => setEditForm(prev => ({ ...prev, school_name: e.target.value }))}
                  placeholder="○○中学校"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block">学年</label>
                <select
                  value={editForm.grade}
                  onChange={e => setEditForm(prev => ({ ...prev, grade: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 bg-white">
                  <option value="">選択してください</option>
                  {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-600 mb-1.5 block">入学年度</label>
                <select
                  value={editForm.admission_year}
                  onChange={e => setEditForm(prev => ({ ...prev, admission_year: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-400 bg-white">
                  <option value="">選択してください</option>
                  {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map(y => (
                    <option key={y} value={y}>{y}年度入学</option>
                  ))}
                </select>
              </div>
            </div>

            {editError && <p className="text-xs text-red-600 bg-red-50 rounded-xl px-3 py-2">{editError}</p>}

            <button
              onClick={saveChild}
              disabled={editSaving}
              className="w-full py-3 bg-indigo-600 text-white text-sm font-black rounded-2xl active:opacity-70 disabled:opacity-50 flex items-center justify-center gap-2">
              {editSaving && <Loader2 size={14} className="animate-spin" />}
              {editSaving ? '保存中...' : '保存する'}
            </button>

          </div>
        </div>
      )}

    </div>
  )
}
