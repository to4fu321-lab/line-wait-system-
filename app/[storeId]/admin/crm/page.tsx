'use client'

import { useState, useEffect, useCallback, useRef, Fragment } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { BottomNav } from '../_components/BottomNav'
import { QrRegistrationModal } from '../_components/QrRegistrationModal'
import {
  ArrowLeft, Search, Plus, User, Phone,
  CheckCheck, Package, Loader2, X, MessageCircle,
  CalendarDays, Pencil, AlertCircle, ChevronDown, ChevronUp,
  RotateCcw, ShoppingBag, Bell, Scissors, GraduationCap,
  Trash2, ArchiveRestore, Eye, EyeOff, QrCode, ScanLine,
} from 'lucide-react'
import { supabase, getTodayStart } from '@/lib/supabase'
import type {
  Customer, Child, RepairHistory, PurchaseOrder,
  RepairStatus, PurchaseStatus,
} from '@/types/crm'
import {
  REPAIR_STATUS_LABELS, REPAIR_STATUS_COLORS,
  PURCHASE_STATUS_LABELS, PURCHASE_STATUS_COLORS,
  GRADE_OPTIONS, SCHOOL_OPTIONS,
} from '@/types/crm'

import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { SchoolInfoCard } from '@/app/_components/SchoolInfoCard'

// ── 分割コンポーネント ────────────────────────────────────────
import type { RepairWithCustomer, PurchaseWithCustomer, IntakeFormType, KanaRow } from './_components/types'
import { INTAKE_OPTIONS, KANA_ROWS } from './_components/types'
import { fmtDate, getKanaRow } from './_components/utils'
import { RepairItem } from './_components/RepairItem'
import { PurchaseItem } from './_components/PurchaseItem'
import { NewIntakeForm } from './_components/NewIntakeForm'
import { ChildCard } from './_components/ChildCard'
import { CustomerInfoPanel, EditCustomerForm, EditChildForm, AddChildFormCRM } from './_components/CustomerForms'

// ============================================================
// Toast
// ============================================================
function Toast({ msg, type, onUndo, onClose }: {
  msg: string; type: 'ok' | 'err'; onUndo?: () => Promise<void>; onClose: () => void
}) {
  const [undoing, setUndoing] = useState(false)
  useEffect(() => {
    const t = setTimeout(onClose, onUndo ? 5000 : 3000)
    return () => clearTimeout(t)
  }, [onClose, onUndo])
  const handleUndo = async () => {
    if (!onUndo || undoing) return
    setUndoing(true)
    await onUndo()
    onClose()
  }
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl max-w-xs ${
      type === 'err' ? 'bg-red-600' : 'bg-gray-100 border border-gray-300'
    }`}>
      <span className="flex-1">{msg}</span>
      {onUndo && (
        <button onClick={handleUndo} disabled={undoing}
          className="shrink-0 px-3 py-1 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-xs font-black active:scale-95 transition-all disabled:opacity-50">
          {undoing ? '…' : '取消し'}
        </button>
      )}
    </div>
  )
}

// ============================================================
// メインページ
// ============================================================
export default function CRMPage() {
  const { storeId }  = useParams<{ storeId: string }>()
  const router       = useRouter()
  const searchParams = useSearchParams()
  const { hasFeature } = useStoreFeatures(storeId)
  const defaultIntakeType = (searchParams?.get('type') ?? 'repair') as IntakeFormType

  const [storeName,        setStoreName]        = useState('')
  const [customers,        setCustomers]        = useState<Customer[]>([])
  const [searchQuery,      setSearchQuery]      = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [editingCustomer,    setEditingCustomer]    = useState(false)
  const [editingStaffNotes,  setEditingStaffNotes]  = useState(false)
  const [staffNotesInput,    setStaffNotesInput]    = useState('')
  const [customerChildren,   setCustomerChildren]   = useState<Child[]>([])
  const [editingChild,       setEditingChild]       = useState<Child | null>(null)
  const [showAddChild,     setShowAddChild]     = useState(false)
  const [customerLoading,  setCustomerLoading]  = useState(false)
  const [childMatchMap,    setChildMatchMap]    = useState<Record<string, string>>({}) // customerId -> matched child name
  const [showDeleted,      setShowDeleted]      = useState(false)
  const [deleteTarget,     setDeleteTarget]     = useState<Customer | null>(null)
  const [deleteMode,       setDeleteMode]       = useState<'soft' | 'hard' | null>(null)
  const [deleteLoading,    setDeleteLoading]    = useState(false)
  const [deleteChildTarget, setDeleteChildTarget] = useState<Child | null>(null)
  const [deleteChildLoading, setDeleteChildLoading] = useState(false)
  const [showQrModal,      setShowQrModal]      = useState(false)

  const [allCustomers,      setAllCustomers]      = useState<Customer[]>([])
  const [allLoading,        setAllLoading]        = useState(true)
  const [kanaFilter,        setKanaFilter]        = useState<KanaRow | null>(null)

  const [alertDaysRepair,   setAlertDaysRepair]   = useState(7)
  const [alertDaysPurchase, setAlertDaysPurchase] = useState(7)
  const [schoolOptions,     setSchoolOptions]     = useState<string[]>([])
  const [schoolFilter,      setSchoolFilter]      = useState<string | null>(null)
  const [groupStoreIds,     setGroupStoreIds]     = useState<string[]>([])
  const [storeNameMap,      setStoreNameMap]      = useState<Record<string, string>>({})
  const [reservationUrl,    setReservationUrl]    = useState<string | null>(null)

  // 未対応統計
  const [stats, setStats] = useState({ repairReceived: 0, repairCompleted: 0, purchaseReceived: 0, purchaseInProgress: 0, purchaseArrived: 0 })

  // 未対応リスト
  const [showRepairReceived,  setShowRepairReceived]  = useState(false)
  const [repairReceivedList,  setRepairReceivedList]  = useState<RepairWithCustomer[]>([])
  const [repairReceivedLoading, setRepairReceivedLoading] = useState(false)

  const [showRepairCompleted,  setShowRepairCompleted]  = useState(false)
  const [repairCompletedList,  setRepairCompletedList]  = useState<RepairWithCustomer[]>([])
  const [repairCompletedLoading, setRepairCompletedLoading] = useState(false)

  const [showPurchaseReceived,  setShowPurchaseReceived]  = useState(false)
  const [purchaseReceivedList,  setPurchaseReceivedList]  = useState<PurchaseWithCustomer[]>([])
  const [purchaseReceivedLoading, setPurchaseReceivedLoading] = useState(false)

  const [showPurchaseInProgress,  setShowPurchaseInProgress]  = useState(false)
  const [purchaseInProgressList,  setPurchaseInProgressList]  = useState<PurchaseWithCustomer[]>([])
  const [purchaseInProgressLoading, setPurchaseInProgressLoading] = useState(false)

  const [showPurchaseArrived,  setShowPurchaseArrived]  = useState(false)
  const [purchaseArrivedList,  setPurchaseArrivedList]  = useState<PurchaseWithCustomer[]>([])
  const [purchaseArrivedLoading, setPurchaseArrivedLoading] = useState(false)

  const [showDelivered,       setShowDelivered]       = useState(false)
  const [deliveredRepairs,    setDeliveredRepairs]    = useState<RepairWithCustomer[]>([])
  const [deliveredPurchases,  setDeliveredPurchases]  = useState<PurchaseWithCustomer[]>([])
  const [deliveredLoading,    setDeliveredLoading]    = useState(false)

  const [toast,   setToast]   = useState<{ type: 'ok' | 'err'; msg: string; onUndo?: () => Promise<void> } | null>(null)
  const timerRef        = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inlineDetailRef = useRef<HTMLDivElement>(null)

  // ── Quick intake (order-first flow) ──────────────────────
  const [showQuickIntake,    setShowQuickIntake]    = useState(false)
  const [qiStep,             setQiStep]             = useState<1 | 2 | 3>(1)
  const [qiIntakeType,       setQiIntakeType]       = useState<IntakeFormType>('repair')
  const [qiItemName,         setQiItemName]         = useState('')
  const [qiContent,          setQiContent]          = useState('')
  const [qiPrice,            setQiPrice]            = useState('')
  const [qiNotes,            setQiNotes]            = useState('')
  const [qiDesiredDate,      setQiDesiredDate]      = useState('')
  const [qiMaker,            setQiMaker]            = useState('')
  const [qiCustomerId,       setQiCustomerId]       = useState<string | null>(null)
  const [qiCustomerName,     setQiCustomerName]     = useState<string | null>(null)
  const [qiChildId,          setQiChildId]          = useState<string | null>(null)
  const [qiCustomerSearch,   setQiCustomerSearch]   = useState('')
  const [qiFoundCustomers,   setQiFoundCustomers]   = useState<Customer[]>([])
  const [qiSearching,        setQiSearching]        = useState(false)
  const [qiChildren,         setQiChildren]         = useState<Child[]>([])
  const [qiSaving,           setQiSaving]           = useState(false)

  const resetQi = useCallback(() => {
    setQiStep(1); setQiIntakeType('repair')
    setQiItemName(''); setQiContent(''); setQiPrice(''); setQiNotes('')
    setQiDesiredDate(''); setQiMaker('')
    setQiCustomerId(null); setQiCustomerName(null); setQiChildId(null)
    setQiCustomerSearch(''); setQiFoundCustomers([]); setQiChildren([])
  }, [])

  useEffect(() => {
    if (!qiCustomerSearch.trim()) { setQiFoundCustomers([]); return }
    const t = setTimeout(async () => {
      setQiSearching(true)
      const term = qiCustomerSearch.trim()
      // 数字のみ（1〜4桁）は当日の受付番号として検索
      if (/^\d{1,4}$/.test(term)) {
        const { data: qs } = await supabase.from('queues')
          .select('customer_id')
          .eq('store_id', storeId)
          .eq('ticket_number', parseInt(term, 10))
          .gte('created_at', getTodayStart())
          .not('customer_id', 'is', null)
        const ids = [...new Set((qs ?? []).map(q => q.customer_id as string))]
        if (ids.length > 0) {
          const { data } = await supabase.from('customers').select('*')
            .in('id', ids).is('deleted_at', null)
          setQiFoundCustomers(data ?? [])
          setQiSearching(false)
          return
        }
        // 番号でヒットしなければ通常検索にフォールバック（電話番号の数字など）
      }
      const { data } = await supabase.from('customers').select('*')
        .eq('store_id', storeId).is('deleted_at', null)
        .or(`name.ilike.%${term}%,kana.ilike.%${term}%,tel.ilike.%${term}%`)
        .order('updated_at', { ascending: false }).limit(10)
      setQiFoundCustomers(data ?? [])
      setQiSearching(false)
    }, 300)
    return () => clearTimeout(t)
  }, [qiCustomerSearch, storeId])

  const handleQiSelectCustomer = useCallback(async (customer: Customer) => {
    setQiCustomerId(customer.id)
    setQiCustomerName(customer.name)
    const { data: kids } = await supabase.from('children').select('*')
      .eq('customer_id', customer.id).order('name')
    const childArr = kids ?? []
    setQiChildren(childArr)
    if (childArr.length === 0) {
      setQiChildId(null)
      setQiStep(3)
    } else {
      setQiStep(3)
    }
  }, [])

  // 整理券カード等からの遷移（?customer=）: 顧客を選択済みでクイック受付を開く
  useEffect(() => {
    const cid = searchParams?.get('customer')
    if (!cid || !storeId) return
    ;(async () => {
      const { data: cust } = await supabase.from('customers').select('*')
        .eq('id', cid).eq('store_id', storeId).is('deleted_at', null).single()
      if (!cust) return
      resetQi()
      setQiCustomerId(cust.id)
      setQiCustomerName(cust.name)
      const { data: kids } = await supabase.from('children').select('*')
        .eq('customer_id', cust.id).order('name')
      setQiChildren(kids ?? [])
      setShowQuickIntake(true)
    })()
  }, [searchParams, storeId, resetQi])

  const showToast = useCallback((type: 'ok' | 'err', msg: string, onUndo?: () => Promise<void>) => {
    setToast({ type, msg, onUndo })
  }, [])

  // 選択顧客インライン展開時のスクロール調整
  useEffect(() => {
    if (!selectedCustomer || !inlineDetailRef.current) return
    const el = inlineDetailRef.current
    setTimeout(() => {
      const rect = el.getBoundingClientRect()
      if (rect.bottom > window.innerHeight - 72) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      }
    }, 60)
  }, [selectedCustomer?.id])

  // ── 初期ロード ──────────────────────────────────────────
  useEffect(() => {
    if (!storeId) return
    ;(supabase.from('stores') as any)
      .select('name, group_id, alert_days_repair, alert_days_purchase, school_names, reservation_url')
      .eq('id', storeId).single()
      .then(async ({ data }: { data: any }) => {
        if (data?.name) setStoreName(data.name ?? '')
        if (data?.alert_days_repair   != null) setAlertDaysRepair(data.alert_days_repair)
        if (data?.alert_days_purchase != null) setAlertDaysPurchase(data.alert_days_purchase)
        if (Array.isArray(data?.school_names) && data.school_names.length > 0)
          setSchoolOptions(data.school_names)
        if (data?.reservation_url) setReservationUrl(data.reservation_url)
        if (data?.group_id) {
          const { data: gStores } = await (supabase.from('stores') as any)
            .select('id, name').eq('group_id', data.group_id)
          if (gStores && gStores.length > 1) {
            setGroupStoreIds(gStores.map((s: any) => s.id))
            const nameMap: Record<string, string> = {}
            gStores.forEach((s: any) => { nameMap[s.id] = s.name })
            setStoreNameMap(nameMap)
          } else {
            setGroupStoreIds([storeId])
          }
        } else {
          setGroupStoreIds([storeId])
        }
      })
  }, [storeId])

  const fetchStats = useCallback(async () => {
    if (!storeId) return
    const [{ data: rData }, { data: pData }] = await Promise.all([
      supabase.from('repair_histories').select('status').eq('store_id', storeId).in('status', ['received', 'completed']),
      supabase.from('purchase_orders').select('status').eq('store_id', storeId).in('status', ['ordered', 'received', 'stocked', 'on_order', 'arrived']),
    ])
    setStats({
      repairReceived:     (rData ?? []).filter(r => r.status === 'received').length,
      repairCompleted:    (rData ?? []).filter(r => r.status === 'completed').length,
      purchaseReceived:   (pData ?? []).filter(r => r.status === 'received' || r.status === 'ordered').length,
      purchaseInProgress: (pData ?? []).filter(r => r.status === 'stocked' || r.status === 'on_order').length,
      purchaseArrived:    (pData ?? []).filter(r => r.status === 'arrived').length,
    })
  }, [storeId])

  useEffect(() => { fetchStats() }, [fetchStats])

  const handleQiSave = useCallback(async () => {
    if (!qiCustomerId || !qiItemName.trim()) return
    setQiSaving(true)
    let err: { message: string } | null = null
    if (qiIntakeType === 'purchase') {
      const res = await supabase.from('purchase_orders').insert({
        store_id: storeId, customer_id: qiCustomerId,
        child_id: qiChildId ?? null,
        item_name: qiItemName.trim(), maker: qiMaker.trim() || null,
        notes: qiNotes.trim() || null,
        price: qiPrice ? parseInt(qiPrice) : null,
        status: 'ordered', ordered_date: new Date().toISOString().slice(0, 10),
      })
      err = res.error
    } else {
      const res = await (supabase as any).from('repair_histories').insert({
        store_id: storeId, customer_id: qiCustomerId,
        child_id: qiChildId ?? null,
        item_name: qiItemName.trim(), content: qiContent.trim(),
        price: qiPrice ? parseInt(qiPrice) : null,
        notes: qiNotes.trim() || null,
        status: 'received', received_date: new Date().toISOString().slice(0, 10),
        request_type: qiIntakeType, prepaid: false,
        desired_completion_date: qiDesiredDate || null,
      })
      err = res.error
    }
    setQiSaving(false)
    if (err) { showToast('err', `保存失敗: ${err.message}`); return }
    showToast('ok', '依頼を受け付けました')
    setShowQuickIntake(false)
    resetQi()
    fetchStats()
  }, [qiCustomerId, qiChildId, qiItemName, qiContent, qiPrice, qiNotes, qiDesiredDate, qiMaker, qiIntakeType, storeId, showToast, resetQi, fetchStats])

  const fetchAllCustomers = useCallback(async () => {
    if (!storeId || groupStoreIds.length === 0) return
    setAllLoading(true)
    const q = supabase.from('customers').select('*, children(school_name)').in('store_id', groupStoreIds)
    const { data } = await (showDeleted ? q.not('deleted_at', 'is', null) : q.is('deleted_at', null))
      .order('kana', { ascending: true }).limit(500)
    setAllCustomers(data ?? [])
    setAllLoading(false)
  }, [storeId, showDeleted, groupStoreIds])

  useEffect(() => { fetchAllCustomers() }, [fetchAllCustomers])

  // ── 顧客検索（お子様名でもヒット・削除済み切替対応）──
  const searchCustomers = useCallback(async (q: string, deleted = false) => {
    if (!storeId || !q.trim()) { setCustomers([]); setCustomerLoading(false); return }
    setCustomerLoading(true)

    const sIds = groupStoreIds.length > 0 ? groupStoreIds : [storeId]
    const baseQuery = () => {
      const q2 = supabase.from('customers').select('*').in('store_id', sIds)
      return deleted ? q2.not('deleted_at', 'is', null) : q2.is('deleted_at', null)
    }

    const { data: direct } = await baseQuery()
      .or(`name.ilike.%${q}%,kana.ilike.%${q}%,tel.ilike.%${q.replace(/-/g, '')}%,parent_name.ilike.%${q}%`)
      .order('updated_at', { ascending: false }).limit(20)

    const { data: childHits } = await supabase.from('children').select('customer_id, name').in('store_id', sIds)
      .or(`name.ilike.%${q}%,kana.ilike.%${q}%,school_name.ilike.%${q}%`)

    // お子様マッチマップ（customerId → 最初にマッチしたお子様名）
    const matchMap: Record<string, string> = {}
    let merged = direct ?? []
    if (childHits && childHits.length > 0) {
      childHits.forEach(ch => { if (!matchMap[ch.customer_id]) matchMap[ch.customer_id] = ch.name })
      const ids = [...new Set(childHits.map(c => c.customer_id))]
      const existingIds = new Set(merged.map(c => c.id))
      const newIds = ids.filter(id => !existingIds.has(id))
      if (newIds.length > 0) {
        const { data: fromChildren } = await baseQuery().in('id', newIds).order('updated_at', { ascending: false })
        merged = [...merged, ...(fromChildren ?? [])]
      }
    }

    setChildMatchMap(matchMap)
    setCustomers(merged); setCustomerLoading(false)
  }, [storeId])

  // ── 削除処理 ──────────────────────────────────────────
  const handleDelete = useCallback(async () => {
    if (!deleteTarget || !deleteMode) return
    setDeleteLoading(true)
    if (deleteMode === 'soft') {
      await supabase.from('customers').update({ deleted_at: new Date().toISOString() }).eq('id', deleteTarget.id)
    } else {
      // 1. すべての整理券から顧客・子供の参照を外す
      const { error: qErr } = await supabase.from('queues')
        .update({ customer_id: null, child_id: null })
        .eq('customer_id', deleteTarget.id)
      if (qErr) { showToast('err', `削除失敗: ${qErr.message}`); setDeleteLoading(false); return }
      // 2. お直し履歴・購入注文を削除
      await Promise.all([
        supabase.from('repair_histories').delete().eq('customer_id', deleteTarget.id),
        supabase.from('purchase_orders').delete().eq('customer_id', deleteTarget.id),
      ])
      // 3. お子様を削除
      await supabase.from('children').delete().eq('customer_id', deleteTarget.id)
      // 4. 顧客本体を削除
      const { error: custErr } = await supabase.from('customers').delete().eq('id', deleteTarget.id)
      if (custErr) { showToast('err', `削除失敗: ${custErr.message}`); setDeleteLoading(false); return }
    }
    setCustomers(prev => prev.filter(c => c.id !== deleteTarget.id))
    if (selectedCustomer?.id === deleteTarget.id) setSelectedCustomer(null)
    setDeleteTarget(null); setDeleteMode(null); setDeleteLoading(false)
    showToast('ok', deleteMode === 'soft' ? '非表示にしました' : '完全削除しました')
  }, [deleteTarget, deleteMode, selectedCustomer, showToast])

  // ── 復元処理 ──────────────────────────────────────────
  const handleRestore = useCallback(async (customer: Customer) => {
    await supabase.from('customers').update({ deleted_at: null }).eq('id', customer.id)
    setCustomers(prev => prev.filter(c => c.id !== customer.id))
    if (selectedCustomer?.id === customer.id) setSelectedCustomer(null)
  }, [selectedCustomer])

  // ── お子様削除 ────────────────────────────────────────
  const handleDeleteChild = useCallback(async () => {
    if (!deleteChildTarget) return
    setDeleteChildLoading(true)
    // 関連レコードの child_id を NULL に（FK制約対策）
    await Promise.all([
      supabase.from('repair_histories').update({ child_id: null }).eq('child_id', deleteChildTarget.id),
      supabase.from('purchase_orders').update({ child_id: null }).eq('child_id', deleteChildTarget.id),
      supabase.from('queues').update({ child_id: null }).eq('child_id', deleteChildTarget.id),
    ])
    await supabase.from('children').delete().eq('id', deleteChildTarget.id)
    setCustomerChildren(prev => prev.filter(c => c.id !== deleteChildTarget.id))
    setDeleteChildTarget(null); setDeleteChildLoading(false)
  }, [deleteChildTarget])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(searchQuery, showDeleted), 300)
    return () => clearTimeout(t)
  }, [searchQuery, showDeleted, searchCustomers])

  const fetchCustomerChildren = useCallback(async (customerId: string) => {
    const { data } = await supabase.from('children').select('*').eq('customer_id', customerId).order('created_at', { ascending: true })
    setCustomerChildren(data ?? [])
  }, [])

  useEffect(() => {
    if (selectedCustomer) fetchCustomerChildren(selectedCustomer.id)
    else setCustomerChildren([])
  }, [selectedCustomer, fetchCustomerChildren])

  // ── 未対応リスト fetch ──────────────────────────────
  const fetchRepairReceived = useCallback(async () => {
    if (!storeId) return; setRepairReceivedLoading(true)
    const { data } = await supabase.from('repair_histories')
      .select('*, customer:customers(name, tel), child:children(name)').eq('store_id', storeId).eq('status', 'received')
      .order('received_date', { ascending: false })
    setRepairReceivedList((data ?? []) as RepairWithCustomer[]); setRepairReceivedLoading(false)
  }, [storeId])

  const fetchRepairCompleted = useCallback(async () => {
    if (!storeId) return; setRepairCompletedLoading(true)
    const { data } = await supabase.from('repair_histories')
      .select('*, customer:customers(name, tel), child:children(name)').eq('store_id', storeId).eq('status', 'completed')
      .order('completed_date', { ascending: false })
    setRepairCompletedList((data ?? []) as RepairWithCustomer[]); setRepairCompletedLoading(false)
  }, [storeId])

  const fetchPurchaseReceived = useCallback(async () => {
    if (!storeId) return; setPurchaseReceivedLoading(true)
    const { data } = await supabase.from('purchase_orders')
      .select('*, customer:customers(name, tel), child:children(name)').eq('store_id', storeId).in('status', ['ordered', 'received'])
      .order('ordered_date', { ascending: false })
    setPurchaseReceivedList((data ?? []) as PurchaseWithCustomer[]); setPurchaseReceivedLoading(false)
  }, [storeId])

  const fetchPurchaseInProgress = useCallback(async () => {
    if (!storeId) return; setPurchaseInProgressLoading(true)
    const { data } = await supabase.from('purchase_orders')
      .select('*, customer:customers(name, tel), child:children(name)').eq('store_id', storeId).in('status', ['stocked', 'on_order'])
      .order('ordered_date', { ascending: false })
    setPurchaseInProgressList((data ?? []) as PurchaseWithCustomer[]); setPurchaseInProgressLoading(false)
  }, [storeId])

  const fetchPurchaseArrived = useCallback(async () => {
    if (!storeId) return; setPurchaseArrivedLoading(true)
    const { data } = await supabase.from('purchase_orders')
      .select('*, customer:customers(name, tel), child:children(name)').eq('store_id', storeId).eq('status', 'arrived')
      .order('arrived_date', { ascending: false })
    setPurchaseArrivedList((data ?? []) as PurchaseWithCustomer[]); setPurchaseArrivedLoading(false)
  }, [storeId])

  // ── お直しアクション ───────────────────────────────────
  const handleRepairComplete = useCallback(async (repairId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('repair_histories')
      .update({ status: 'completed', completed_date: today }).eq('id', repairId)
    if (error) { showToast('err', `完了処理失敗: ${error.message}`); return }
    setRepairReceivedList(prev => prev.filter(r => r.id !== repairId))
    fetchStats()
    if (showRepairCompleted) fetchRepairCompleted()
    let msg = '✅ 完了処理しました'
    try {
      const res = await fetch('/api/notify-repair', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repairId }),
      })
      const j = await res.json()
      if (j.ok && j.notified) msg = '✅ 完了処理 + LINE通知を送信しました'
      else if (!j.skipped)    msg = `完了済み・通知失敗: ${j.error ?? '不明'}`
    } catch { msg = '完了済み・通知APIエラー' }
    showToast('ok', msg, async () => {
      await supabase.from('repair_histories')
        .update({ status: 'received', completed_date: null, notified: false }).eq('id', repairId)
      fetchStats()
      if (showRepairReceived) fetchRepairReceived()
      if (showRepairCompleted) fetchRepairCompleted()
    })
  }, [showToast, fetchStats, showRepairReceived, showRepairCompleted, fetchRepairReceived, fetchRepairCompleted])

  const handleRepairDeliver = useCallback(async (repairId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('repair_histories')
      .update({ status: 'delivered', delivered_date: today }).eq('id', repairId)
    if (error) { showToast('err', `受渡処理失敗: ${error.message}`); return }
    setRepairCompletedList(prev => prev.filter(r => r.id !== repairId))
    fetchStats()
    showToast('ok', '📦 お渡し済みにしました', async () => {
      await supabase.from('repair_histories')
        .update({ status: 'completed', delivered_date: null }).eq('id', repairId)
      fetchStats()
      if (showRepairCompleted) fetchRepairCompleted()
    })
  }, [showToast, fetchStats, showRepairCompleted, fetchRepairCompleted])

  const handleRepairRevert = useCallback(async (repairId: string) => {
    const { error } = await supabase.from('repair_histories')
      .update({ status: 'received', completed_date: null, notified: false }).eq('id', repairId)
    if (error) { showToast('err', `戻し処理失敗: ${error.message}`); return }
    setRepairCompletedList(prev => prev.filter(r => r.id !== repairId))
    fetchStats()
    if (showRepairReceived) fetchRepairReceived()
    showToast('ok', '🔄 預かり中に戻しました', async () => {
      await supabase.from('repair_histories')
        .update({ status: 'completed' }).eq('id', repairId)
      fetchStats()
      if (showRepairCompleted) fetchRepairCompleted()
    })
  }, [showToast, fetchStats, showRepairReceived, showRepairCompleted, fetchRepairReceived, fetchRepairCompleted])

  // ── 追加購入アクション ─────────────────────────────────
  const handlePurchaseStock = useCallback(async (orderId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'arrived', arrived_date: today }).eq('id', orderId)
    if (error) { showToast('err', `更新失敗: ${error.message}`); return }
    setPurchaseReceivedList(prev => prev.filter(o => o.id !== orderId))
    fetchStats()
    if (showPurchaseArrived) fetchPurchaseArrived()
    let msg = '✅ 在庫確保済みにしました'
    try {
      const res = await fetch('/api/notify-purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseOrderId: orderId }),
      })
      const j = await res.json()
      if (j.ok && j.notified) msg = '✅ 在庫確保・入荷連絡を送信しました'
      else if (!j.skipped)    msg = `在庫確保済み・通知失敗: ${j.error ?? '不明'}`
    } catch { msg = '在庫確保済み・通知APIエラー' }
    showToast('ok', msg, async () => {
      await supabase.from('purchase_orders')
        .update({ status: 'received', arrived_date: null, notified: false }).eq('id', orderId)
      fetchStats()
      if (showPurchaseReceived) fetchPurchaseReceived()
    })
  }, [showToast, fetchStats, showPurchaseReceived, showPurchaseArrived, fetchPurchaseReceived, fetchPurchaseArrived])

  const handlePurchaseBackOrder = useCallback(async (orderId: string) => {
    const { error } = await supabase.from('purchase_orders').update({ status: 'on_order' }).eq('id', orderId)
    if (error) { showToast('err', `更新失敗: ${error.message}`); return }
    setPurchaseReceivedList(prev => prev.filter(o => o.id !== orderId))
    fetchStats()
    if (showPurchaseInProgress) fetchPurchaseInProgress()
    showToast('ok', '✅ メーカー発注済みにしました', async () => {
      await supabase.from('purchase_orders').update({ status: 'received' }).eq('id', orderId)
      fetchStats()
      if (showPurchaseReceived) fetchPurchaseReceived()
    })
  }, [showToast, fetchStats, showPurchaseReceived, showPurchaseInProgress, fetchPurchaseReceived, fetchPurchaseInProgress])

  const handlePurchaseArrive = useCallback(async (orderId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'arrived', arrived_date: today }).eq('id', orderId)
    if (error) { showToast('err', `入荷処理失敗: ${error.message}`); return }
    setPurchaseInProgressList(prev => prev.filter(o => o.id !== orderId))
    fetchStats()
    if (showPurchaseArrived) fetchPurchaseArrived()
    let msg = '✅ 入荷連絡済みにしました'
    try {
      const res = await fetch('/api/notify-purchase', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purchaseOrderId: orderId }),
      })
      const j = await res.json()
      if (j.ok && j.notified) msg = '✅ 入荷連絡済み + LINE通知を送信しました'
      else if (!j.skipped)    msg = `入荷連絡済み・通知失敗: ${j.error ?? '不明'}`
    } catch { msg = '入荷連絡済み・通知APIエラー' }
    showToast('ok', msg, async () => {
      await supabase.from('purchase_orders')
        .update({ status: 'on_order', arrived_date: null, notified: false }).eq('id', orderId)
      fetchStats()
      if (showPurchaseInProgress) fetchPurchaseInProgress()
    })
  }, [showToast, fetchStats, showPurchaseInProgress, showPurchaseArrived, fetchPurchaseInProgress, fetchPurchaseArrived])

  const handlePurchaseDeliver = useCallback(async (orderId: string) => {
    const today = new Date().toISOString().slice(0, 10)
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'delivered', delivered_date: today }).eq('id', orderId)
    if (error) { showToast('err', `受渡処理失敗: ${error.message}`); return }
    setPurchaseArrivedList(prev => prev.filter(o => o.id !== orderId))
    fetchStats()
    showToast('ok', '📦 お渡し済みにしました', async () => {
      await supabase.from('purchase_orders')
        .update({ status: 'arrived', delivered_date: null }).eq('id', orderId)
      fetchStats()
      if (showPurchaseArrived) fetchPurchaseArrived()
    })
  }, [showToast, fetchStats, showPurchaseArrived, fetchPurchaseArrived])

  const handlePurchaseRevert = useCallback(async (orderId: string) => {
    const { error } = await supabase.from('purchase_orders')
      .update({ status: 'ordered', arrived_date: null, notified: false }).eq('id', orderId)
    if (error) { showToast('err', `戻し処理失敗: ${error.message}`); return }
    setPurchaseInProgressList(prev => prev.filter(o => o.id !== orderId))
    fetchStats()
    if (showPurchaseReceived) fetchPurchaseReceived()
    showToast('ok', '🔄 依頼受付に戻しました', async () => {
      await supabase.from('purchase_orders').update({ status: 'on_order' }).eq('id', orderId)
      fetchStats()
      if (showPurchaseInProgress) fetchPurchaseInProgress()
    })
  }, [showToast, fetchStats, showPurchaseReceived, showPurchaseInProgress, fetchPurchaseReceived, fetchPurchaseInProgress])

  // ── トグル関数 ─────────────────────────────────────────
  const toggleRepairReceived = () => {
    if (!showRepairReceived) fetchRepairReceived()
    setShowRepairReceived(v => !v)
  }
  const toggleRepairCompleted = () => {
    if (!showRepairCompleted) fetchRepairCompleted()
    setShowRepairCompleted(v => !v)
  }
  const togglePurchaseReceived = () => {
    if (!showPurchaseReceived) fetchPurchaseReceived()
    setShowPurchaseReceived(v => !v)
  }
  const togglePurchaseInProgress = () => {
    if (!showPurchaseInProgress) fetchPurchaseInProgress()
    setShowPurchaseInProgress(v => !v)
  }
  const togglePurchaseArrived = () => {
    if (!showPurchaseArrived) fetchPurchaseArrived()
    setShowPurchaseArrived(v => !v)
  }

  const fetchDeliveredHistory = useCallback(async () => {
    if (!storeId) return; setDeliveredLoading(true)
    const [{ data: rData }, { data: pData }] = await Promise.all([
      supabase.from('repair_histories')
        .select('*, customer:customers(name, tel), child:children(name)')
        .eq('store_id', storeId).eq('status', 'delivered')
        .order('delivered_date', { ascending: false }).limit(50),
      supabase.from('purchase_orders')
        .select('*, customer:customers(name, tel), child:children(name)')
        .eq('store_id', storeId).eq('status', 'delivered')
        .order('delivered_date', { ascending: false }).limit(50),
    ])
    setDeliveredRepairs((rData ?? []) as RepairWithCustomer[])
    setDeliveredPurchases((pData ?? []) as PurchaseWithCustomer[])
    setDeliveredLoading(false)
  }, [storeId])

  const toggleDelivered = () => {
    if (!showDelivered) fetchDeliveredHistory()
    setShowDelivered(v => !v)
  }

  const pendingTotal = stats.repairReceived + stats.repairCompleted + stats.purchaseReceived + stats.purchaseInProgress + stats.purchaseArrived

  return (
    <div className="min-h-[100dvh] bg-gray-50 text-gray-900">
      {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} onClose={() => setToast(null)} />}

      {/* ヘッダー */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b border-gray-200 px-4 pb-3" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <div className="flex-1">
            <h1 className="font-black text-gray-900 text-base flex items-center gap-2">
              顧客管理（CRM）
            </h1>
            {storeName && <p className="text-gray-500 text-xs">{storeName}</p>}
          </div>
          <div className="flex items-center gap-2">
            <a href={`/${storeId}/admin/orders`}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-all">
              <Package size={13} />注文管理
            </a>
            <button onClick={() => { resetQi(); setShowQuickIntake(true) }}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all">
              <Plus size={13} />先に内容入力
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-6">

        {/* 業務進捗管理はお直し・注文管理タブに移行しました */}

        {/* ══════════════════════════════════════════════════
            顧客管理セクション
           ══════════════════════════════════════════════════ */}
        <section className="border-t border-gray-200 pt-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-gray-700">顧客管理</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setShowQrModal(true)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border bg-indigo-100 border-indigo-200 text-indigo-700">
                <QrCode size={12} />新規登録QR
              </button>
              <button onClick={() => { setShowDeleted(v => !v); setSearchQuery(''); setCustomers([]); setAllCustomers([]); setSelectedCustomer(null); setKanaFilter(null) }}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${showDeleted ? 'bg-red-100 border-red-300 text-red-600' : 'bg-gray-100 border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-200'}`}>
                {showDeleted ? <><EyeOff size={12} />削除済みを非表示</> : <><Eye size={12} />削除済みを表示</>}
              </button>
            </div>
          </div>

          {/* 検索 — sticky */}
          <div className="sticky top-[56px] z-20 bg-gray-50 -mx-4 px-4 pb-2 pt-1">
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input type="text" value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setKanaFilter(null) }}
                placeholder="保護者名・お子様名・フリガナ・電話番号"
                className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-9 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none transition-colors shadow-sm" />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setCustomers([]); setSelectedCustomer(null) }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900">
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* 学校フィルター — 常時表示 */}
          {schoolOptions.length > 0 && (
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {schoolOptions.map(s => {
                const active = schoolFilter === s
                const count = allCustomers.filter(c =>
                  (c as any).children?.some((ch: any) => ch.school_name === s)
                ).length
                return (
                  <button key={s}
                    onClick={() => { setSchoolFilter(active ? null : s); setKanaFilter(null) }}
                    className={`px-3 h-8 rounded-lg text-xs font-bold transition-all active:scale-90 ${
                      active
                        ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/40'
                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-900'
                    }`}>
                    {s}
                    {count > 0 && <span className={`ml-1 ${active ? 'text-amber-100' : 'text-gray-500'}`}>({count})</span>}
                  </button>
                )
              })}
            </div>
          )}

          {/* あいうえおインデックス */}
          {!searchQuery.trim() && !schoolFilter && (
            <div className="flex gap-1 mb-3 flex-wrap">
              {KANA_ROWS.map(row => {
                const count = allCustomers.filter(c => getKanaRow(c.kana) === row).length
                const active = kanaFilter === row
                return (
                  <button key={row}
                    onClick={() => setKanaFilter(active ? null : row)}
                    disabled={count === 0}
                    className={`min-w-[2.25rem] h-9 px-2 rounded-lg text-sm font-black transition-all active:scale-90 disabled:opacity-25 disabled:cursor-default ${
                      active
                        ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-900/40'
                        : 'bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-900'
                    }`}>
                    {row}
                    {count > 0 && !active && (
                      <span className="block text-[9px] text-gray-500 font-normal leading-none -mt-0.5">{count}</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {/* 顧客リスト */}
          {(() => {
            const isSearchMode = !!searchQuery.trim()
            // 検索結果 or 全顧客 をベースに、学校フィルターを重ねて適用
            const base = isSearchMode ? customers : kanaFilter
              ? allCustomers.filter(c => getKanaRow(c.kana) === kanaFilter)
              : allCustomers
            const list = schoolFilter
              ? base.filter(c => (c as any).children?.some((ch: any) => ch.school_name === schoolFilter))
              : base
            const loading = isSearchMode ? customerLoading : allLoading

            if (loading) return (
              <div className="flex justify-center py-6"><Loader2 size={24} className="animate-spin text-indigo-600" /></div>
            )
            if (list.length === 0) return (
              <div className="text-center py-6 text-gray-500">
                <User size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">{isSearchMode ? '該当する顧客が見つかりません' : '顧客がいません'}</p>
              </div>
            )
            return (
              <div className="space-y-1.5 mb-4 animate-fade-in">
                {list.map(c => {
                  const childrenArr = (c as any).children as { id: string; name: string; school_name: string | null }[] | undefined ?? []
                  const isOpen = selectedCustomer?.id === c.id
                  return (
                  <Fragment key={c.id}>
                    <button onClick={() => { setSelectedCustomer(prev => prev?.id === c.id ? null : c); setEditingCustomer(false); setEditingStaffNotes(false); setShowAddChild(false) }}
                      className={`w-full text-left px-4 py-3 rounded-xl border transition-all active:scale-[0.98] ${
                        isOpen
                          ? 'bg-indigo-50 border-indigo-400 text-gray-900 rounded-b-none border-b-0'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-400'
                      }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isOpen ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                          <User size={16} className={isOpen ? 'text-indigo-600' : 'text-gray-500'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          {childMatchMap[c.id] ? (
                            <>
                              <p className="font-black text-gray-900 text-base leading-tight truncate">{childMatchMap[c.id]}</p>
                              <p className="text-xs text-gray-500 truncate">保護者: {c.name}{c.kana ? ` (${c.kana})` : ''}</p>
                            </>
                          ) : (
                            <>
                              <p className="font-bold text-sm truncate">{c.name}</p>
                              <p className="text-xs text-gray-500 truncate">
                                {c.kana ?? c.tel ?? 'LINE未連携'}
                              </p>
                            </>
                          )}
                          {/* Children preview chips */}
                          {childrenArr.length > 0 && !isOpen && (
                            <div className="flex gap-1 mt-0.5 flex-wrap">
                              {childrenArr.slice(0, 3).map((ch) => (
                                <span key={ch.id} className="text-[10px] bg-amber-50 text-amber-600 border border-amber-200 px-1.5 py-0.5 rounded-full font-bold">
                                  {ch.name}
                                </span>
                              ))}
                              {childrenArr.length > 3 && (
                                <span className="text-[10px] text-gray-400 px-1 py-0.5">+{childrenArr.length - 3}人</span>
                              )}
                            </div>
                          )}
                          {Object.keys(storeNameMap).length > 1 && storeNameMap[(c as any).store_id] && (
                            <p className="text-[10px] text-gray-500">{storeNameMap[(c as any).store_id]}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {(c as any).staff_notes && (
                            <span className="text-[11px]" title="引き継ぎノートあり">📝</span>
                          )}
                          {c.line_user_id
                            ? <MessageCircle size={13} className="text-emerald-600" />
                            : <span className="text-[10px] text-gray-500">LINE未</span>
                          }
                          {isOpen
                            ? <ChevronUp size={14} className="text-indigo-500" />
                            : <ChevronDown size={14} className="text-gray-400" />
                          }
                        </div>
                      </div>
                    </button>

                    {/* 選択中顧客 — インライン展開 */}
                    {isOpen && (
                      <div ref={inlineDetailRef} className="space-y-4 border border-indigo-200 rounded-b-2xl p-4 bg-indigo-50/30 border-t-0 -mt-px">

                        {/* 保護者情報 */}
                        {editingCustomer ? (
                          <EditCustomerForm
                            customer={selectedCustomer}
                            onSaved={updated => {
                              setSelectedCustomer(updated)
                              setCustomers(prev => prev.map(cu => cu.id === updated.id ? updated : cu))
                              setEditingCustomer(false)
                              showToast('ok', '保護者情報を更新しました')
                            }}
                            onCancel={() => setEditingCustomer(false)}
                          />
                        ) : (
                          <div className="bg-white border border-gray-200 rounded-2xl p-4">
                            <div className="flex items-start gap-3">
                              <div className="w-11 h-11 rounded-xl bg-indigo-100 border border-indigo-200 flex items-center justify-center shrink-0">
                                <User size={20} className="text-indigo-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-black text-gray-900 text-base">{selectedCustomer.name}</p>
                                {selectedCustomer.kana && <p className="text-gray-500 text-xs">{selectedCustomer.kana}</p>}
                                <div className="flex items-center gap-3 mt-1 flex-wrap">
                                  {selectedCustomer.tel && (
                                    <span className="flex items-center gap-1 text-gray-600 text-xs"><Phone size={11} />{selectedCustomer.tel}</span>
                                  )}
                                  {selectedCustomer.line_user_id
                                    ? <span className="flex items-center gap-1 text-emerald-600 text-xs"><MessageCircle size={11} />LINE連携済み</span>
                                    : <span className="text-gray-400 text-xs">LINE未連携</span>
                                  }
                                </div>
                                {selectedCustomer.notes && (
                                  <p className="text-gray-500 text-xs mt-1 bg-gray-100 rounded-lg px-2 py-1">📝 {selectedCustomer.notes}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {showDeleted ? (
                                  <button onClick={() => handleRestore(selectedCustomer)}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-100 border border-emerald-200 text-emerald-600 hover:bg-emerald-200 active:scale-90 transition-all text-xs font-bold">
                                    <ArchiveRestore size={13} />復元
                                  </button>
                                ) : (
                                  <button onClick={() => setDeleteTarget(selectedCustomer)}
                                    className="p-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-300 active:scale-90 transition-all">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                                {!showDeleted && (
                                  <button onClick={() => setEditingCustomer(true)}
                                    className="p-2 rounded-xl bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-200 active:scale-90 transition-all">
                                    <Pencil size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* 引き継ぎノート */}
                        {!editingCustomer && selectedCustomer && (
                          <div className="bg-white border border-gray-200 rounded-2xl p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-xs font-bold text-gray-600 flex items-center gap-1">📝 引き継ぎノート</p>
                              {!editingStaffNotes && (
                                <button
                                  onClick={() => { setEditingStaffNotes(true); setStaffNotesInput((selectedCustomer as any).staff_notes ?? '') }}
                                  className="text-[10px] text-gray-400 hover:text-gray-700 px-2 py-0.5 rounded-lg border border-gray-200 hover:border-gray-400 transition-all">
                                  編集
                                </button>
                              )}
                            </div>
                            {editingStaffNotes ? (
                              <div className="space-y-2">
                                <textarea
                                  rows={3}
                                  value={staffNotesInput}
                                  onChange={e => setStaffNotesInput(e.target.value)}
                                  placeholder="スタッフ間の引き継ぎ事項・クレーム履歴・対応メモ等"
                                  className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-400 resize-none bg-gray-50"
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => setEditingStaffNotes(false)}
                                    className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-gray-100 text-gray-600">キャンセル</button>
                                  <button onClick={async () => {
                                    const { data, error: err } = await supabase.from('customers')
                                      .update({ staff_notes: staffNotesInput.trim() || null } as any)
                                      .eq('id', selectedCustomer.id).select().single()
                                    if (err) { showToast('err', '保存失敗'); return }
                                    const updated = { ...selectedCustomer, staff_notes: staffNotesInput.trim() || null } as any
                                    setSelectedCustomer(updated)
                                    setCustomers(prev => prev.map(cu => cu.id === updated.id ? updated : cu))
                                    setEditingStaffNotes(false)
                                    showToast('ok', '引き継ぎノートを保存しました')
                                  }}
                                    className="flex-1 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 text-white">保存</button>
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-600 whitespace-pre-wrap leading-relaxed">
                                {(selectedCustomer as any).staff_notes || <span className="text-gray-400">まだノートはありません</span>}
                              </p>
                            )}
                          </div>
                        )}

                        {/* 学校情報カード */}
                        {!editingCustomer && hasFeature('school_crm_card') && selectedCustomer?.school_id && (
                          <SchoolInfoCard schoolId={selectedCustomer.school_id} storeId={storeId} />
                        )}

                        {/* お子様一覧 */}
                        {!editingCustomer && (
                          <div className="space-y-2">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">お子様 ({customerChildren.length}人)</p>

                            {customerChildren.map(child => (
                              editingChild?.id === child.id ? (
                                <EditChildForm key={child.id} child={child}
                                  schoolOptions={schoolOptions}
                                  onSaved={updated => {
                                    setCustomerChildren(prev => prev.map(cu => cu.id === updated.id ? updated : cu))
                                    setEditingChild(null)
                                    showToast('ok', 'お子様情報を更新しました')
                                  }}
                                  onCancel={() => setEditingChild(null)}
                                />
                              ) : (
                                <div key={child.id} className="relative">
                                  <ChildCard
                                    child={child}
                                    customerId={selectedCustomer.id}
                                    storeId={storeId}
                                    defaultIntakeType={defaultIntakeType}
                                    reservationUrl={reservationUrl}
                                    onRepairComplete={handleRepairComplete}
                                    onRepairDeliver={handleRepairDeliver}
                                    onRepairRevert={handleRepairRevert}
                                    onPurchaseStock={handlePurchaseStock}
                                    onPurchaseBackOrder={handlePurchaseBackOrder}
                                    onPurchaseArrive={handlePurchaseArrive}
                                    onPurchaseDeliver={handlePurchaseDeliver}
                                    onPurchaseRevert={handlePurchaseRevert}
                                    onRefreshStats={fetchStats}
                                    showToast={showToast}
                                  />
                                  <div className="absolute top-3 right-2 flex items-center gap-1">
                                    <button onClick={() => setEditingChild(child)}
                                      className="p-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-500 hover:text-gray-900 hover:bg-gray-200 active:scale-90 transition-all">
                                      <Pencil size={12} />
                                    </button>
                                    <button onClick={() => setDeleteChildTarget(child)}
                                      className="p-1.5 rounded-lg bg-gray-100 border border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50 hover:border-red-300 active:scale-90 transition-all">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>
                              )
                            ))}

                            {showAddChild ? (
                              <AddChildFormCRM
                                customerId={selectedCustomer.id}
                                storeId={storeId}
                                schoolOptions={schoolOptions}
                                onSaved={newChild => {
                                  setCustomerChildren(prev => [...prev, newChild])
                                  setShowAddChild(false)
                                  showToast('ok', 'お子様を追加しました')
                                }}
                                onCancel={() => setShowAddChild(false)}
                              />
                            ) : (
                              <button onClick={() => setShowAddChild(true)}
                                className="w-full py-3 rounded-xl border border-dashed border-indigo-300 text-indigo-600 hover:text-indigo-700 hover:border-indigo-400 transition-colors text-sm font-bold flex items-center justify-center gap-2">
                                <Plus size={14} />お子様を追加
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Fragment>
                  )
                })}
              </div>
            )
          })()}
        </section>
      </div>

      {/* 削除確認モーダル */}
      {deleteTarget && !deleteMode && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-[100]">
          <div className="bg-white border border-gray-200 rounded-t-3xl p-6 w-full max-w-md">
            <h3 className="text-gray-900 font-black text-lg mb-1">顧客を削除しますか？</h3>
            <p className="text-gray-700 text-sm font-bold mb-2">{deleteTarget.name} 様</p>

            {/* お子様リスト警告 */}
            {customerChildren.length > 0 && (
              <div className="mb-4 px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl">
                <p className="text-red-600 text-xs font-bold mb-1.5">⚠️ 以下のお子様も一緒に削除されます</p>
                {customerChildren.map(ch => (
                  <p key={ch.id} className="text-gray-700 text-xs ml-2">・{ch.name}{ch.school_name ? `（${ch.school_name}）` : ''}</p>
                ))}
              </div>
            )}

            <div className="space-y-2.5">
              <button onClick={() => setDeleteMode('soft')}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-amber-50 border border-amber-300 text-left active:scale-[0.98] transition-all">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <EyeOff size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="font-bold text-amber-700 text-sm">通常削除（非表示）</p>
                  <p className="text-gray-500 text-xs mt-0.5">データは保持されます。「削除済みを表示」から復元可能です</p>
                </div>
              </button>
              <button onClick={() => setDeleteMode('hard')}
                className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl bg-red-50 border border-red-300 text-left active:scale-[0.98] transition-all">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                  <Trash2 size={16} className="text-red-600" />
                </div>
                <div>
                  <p className="font-bold text-red-600 text-sm">完全削除</p>
                  <p className="text-gray-500 text-xs mt-0.5">データベースから完全に削除されます。復元不可</p>
                </div>
              </button>
            </div>
            <button onClick={() => setDeleteTarget(null)} className="w-full mt-3 py-3 rounded-2xl bg-gray-100 text-gray-600 font-bold text-sm">キャンセル</button>
          </div>
        </div>
      )}

      {/* 削除最終確認 */}
      {deleteTarget && deleteMode && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-[100]">
          <div className="bg-white border border-gray-200 rounded-t-3xl p-6 w-full max-w-md">
            <h3 className="text-gray-900 font-black text-lg mb-1">
              {deleteMode === 'soft' ? '通常削除しますか？' : '完全削除しますか？'}
            </h3>
            <p className="text-gray-700 text-sm font-bold mb-1">{deleteTarget.name} 様</p>
            {customerChildren.length > 0 && (
              <p className="text-red-600 text-xs mb-1">お子様 {customerChildren.length}人（{customerChildren.map(c => c.name).join('・')}）も削除されます</p>
            )}
            <p className="text-gray-500 text-xs mb-5 mt-1">
              {deleteMode === 'soft'
                ? 'データは保持されます。「削除済みを表示」から復元できます'
                : '⚠️ お直し・購入履歴・整理券も全て削除されます。この操作は取り消せません'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteMode(null)} className="py-4 rounded-xl bg-gray-100 text-gray-600 font-bold">戻る</button>
              <button onClick={handleDelete} disabled={deleteLoading}
                className={`py-4 rounded-xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-all active:scale-95 ${deleteMode === 'soft' ? 'bg-amber-500' : 'bg-red-600'}`}>
                {deleteLoading && <Loader2 size={16} className="animate-spin" />}
                {deleteMode === 'soft' ? '非表示にする' : '完全削除する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新規登録QRモーダル */}
      {showQrModal && (
        <QrRegistrationModal
          storeId={storeId}
          onClose={() => setShowQrModal(false)}
        />
      )}

      {/* お子様削除確認モーダル */}
      {deleteChildTarget && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end justify-center z-[100]">
          <div className="bg-white border border-gray-200 rounded-t-3xl p-6 w-full max-w-md">
            <h3 className="text-gray-900 font-black text-lg mb-1">お子様を削除しますか？</h3>
            <p className="text-gray-600 text-sm mb-1">{deleteChildTarget.name} さん</p>
            <p className="text-gray-500 text-xs mb-5">お直し・追加購入履歴のお子様紐付けが外れます（履歴は保持されます）</p>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteChildTarget(null)} className="py-4 rounded-xl bg-gray-100 text-gray-600 font-bold">キャンセル</button>
              <button onClick={handleDeleteChild} disabled={deleteChildLoading}
                className="py-4 rounded-xl bg-red-600 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60 active:scale-95 transition-all">
                {deleteChildLoading && <Loader2 size={16} className="animate-spin" />}
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ── Quick Intake Modal (order-first flow) ───────── */}
      {showQuickIntake && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) { setShowQuickIntake(false); resetQi() } }}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: '90dvh' }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-2">
                {qiStep > 1 && (
                  <button
                    onClick={() => setQiStep(s =>
                      (s === 3 && qiCustomerId && !qiCustomerSearch.trim() ? 1 : s - 1) as 1 | 2 | 3)}
                    className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                    <ArrowLeft size={16} />
                  </button>
                )}
                <h2 className="text-base font-black text-gray-900">
                  {qiStep === 1 ? '①内容を入力' : qiStep === 2 ? '②顧客を選択' : '③お子様 & 確認'}
                </h2>
              </div>
              <button onClick={() => { setShowQuickIntake(false); resetQi() }}
                className="p-1.5 rounded-xl text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                <X size={18} />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">

              {/* ── Step 1: Form ─────────────────────────────── */}
              {qiStep === 1 && (
                <>
                  {/* 整理券・登録完了カードから遷移した場合は顧客選択済み */}
                  {qiCustomerId && qiCustomerName && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2">
                      <User size={14} className="text-emerald-600 shrink-0" />
                      <p className="flex-1 text-sm font-black text-emerald-700 truncate">{qiCustomerName} 様</p>
                      <span className="text-[10px] text-emerald-600 font-bold shrink-0">選択済み</span>
                      <button
                        onClick={() => { setQiCustomerId(null); setQiCustomerName(null); setQiChildId(null); setQiChildren([]) }}
                        className="p-1 rounded-lg text-emerald-500 hover:bg-emerald-100 shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                  )}

                  {/* Intake type buttons */}
                  <div className="grid grid-cols-2 gap-1.5">
                    {INTAKE_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setQiIntakeType(o.value)}
                        className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                          qiIntakeType === o.value ? 'bg-indigo-50 border-indigo-400 text-indigo-700' : 'bg-gray-100 border-gray-300 text-gray-500'
                        }`}>{o.label}</button>
                    ))}
                    {reservationUrl && (
                      <a href={reservationUrl} target="_blank" rel="noopener noreferrer"
                        onClick={() => { setShowQuickIntake(false); resetQi() }}
                        className="py-2 rounded-xl text-xs font-bold border border-sky-300 bg-sky-50 text-sky-700 flex items-center justify-center">
                        🗓️ 来店予約（外部）
                      </a>
                    )}
                  </div>

                  {(() => {
                    const qiOpt = INTAKE_OPTIONS.find(o => o.value === qiIntakeType) ?? INTAKE_OPTIONS[0]
                    return (
                      <>
                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">
                            {qiOpt.isPurchase ? '商品名' : '内容・商品名'} <span className="text-red-500">*</span>
                          </label>
                          <input type="text" value={qiItemName} onChange={e => setQiItemName(e.target.value)}
                            placeholder={qiOpt.ph_item}
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                        </div>

                        {qiOpt.isPurchase ? (
                          <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">メーカー</label>
                            <input type="text" value={qiMaker} onChange={e => setQiMaker(e.target.value)}
                              placeholder="例：カンコー"
                              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                          </div>
                        ) : qiOpt.showContent ? (
                          <div>
                            <label className="text-xs font-bold text-gray-600 block mb-1">
                              {qiIntakeType === 'repair' ? 'お直し内容' : qiIntakeType === 'repair_consult' ? '相談内容' : '詳細'}
                            </label>
                            <input type="text" value={qiContent} onChange={e => setQiContent(e.target.value)}
                              placeholder={qiOpt.ph_content}
                              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                          </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-2">
                          {qiOpt.showPrice && (
                            <div>
                              <label className="text-xs font-bold text-gray-600 block mb-1">金額（円）</label>
                              <input type="number" value={qiPrice} onChange={e => setQiPrice(e.target.value)}
                                placeholder="例：1200"
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                            </div>
                          )}
                          {qiOpt.showDate && (
                            <div>
                              <label className="text-xs font-bold text-gray-600 block mb-1">希望完了日</label>
                              <input type="date" value={qiDesiredDate} onChange={e => setQiDesiredDate(e.target.value)}
                                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-xs font-bold text-gray-600 block mb-1">メモ</label>
                          <input type="text" value={qiNotes} onChange={e => setQiNotes(e.target.value)}
                            placeholder="スタッフへの申し送り等"
                            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                        </div>
                      </>
                    )
                  })()}

                  <button
                    onClick={() => { if (qiItemName.trim()) setQiStep(qiCustomerId ? 3 : 2) }}
                    disabled={!qiItemName.trim()}
                    className="w-full py-3 rounded-xl font-black text-sm bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 flex items-center justify-center gap-2">
                    {qiCustomerId ? '次へ → 確認' : '次へ → 顧客を選ぶ'}
                  </button>
                </>
              )}

              {/* ── Step 2: Customer Search ───────────────────── */}
              {qiStep === 2 && (
                <>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-700 font-bold">
                    {INTAKE_OPTIONS.find(o => o.value === qiIntakeType)?.label ?? ''} — {qiItemName}
                    {qiContent && ` (${qiContent})`}
                    {qiPrice && ` ¥${parseInt(qiPrice).toLocaleString()}`}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">顧客を検索</label>
                    <div className="relative">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" value={qiCustomerSearch}
                        onChange={e => setQiCustomerSearch(e.target.value)}
                        placeholder="受付番号・名前・フリガナ・電話番号"
                        className="w-full pl-8 pr-3 border border-gray-300 rounded-xl py-2.5 text-sm focus:border-indigo-500 focus:outline-none" />
                    </div>
                  </div>

                  {qiSearching && <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-indigo-500" /></div>}
                  {!qiSearching && qiFoundCustomers.length > 0 && (
                    <div className="space-y-1.5">
                      {qiFoundCustomers.map(c => (
                        <button key={c.id} onClick={() => handleQiSelectCustomer(c)}
                          className="w-full text-left px-3 py-2.5 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 active:scale-[0.98] transition-all flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                            <User size={14} className="text-gray-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-gray-900 truncate">{c.name}</p>
                            <p className="text-xs text-gray-500 truncate">{c.kana ?? c.tel ?? 'LINE未連携'}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {!qiSearching && qiCustomerSearch.trim() && qiFoundCustomers.length === 0 && (
                    <p className="text-center text-gray-400 text-xs py-3">該当する顧客が見つかりません</p>
                  )}
                </>
              )}

              {/* ── Step 3: Child & Confirm ───────────────────── */}
              {qiStep === 3 && (
                <>
                  <div className="bg-indigo-50 border border-indigo-200 rounded-xl px-3 py-2 text-xs text-indigo-700 font-bold">
                    {INTAKE_OPTIONS.find(o => o.value === qiIntakeType)?.label ?? ''} — {qiItemName}
                    {qiContent && ` (${qiContent})`}
                    {qiPrice && ` ¥${parseInt(qiPrice).toLocaleString()}`}
                  </div>
                  {qiCustomerName && (
                    <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2">
                      <User size={14} className="text-emerald-600 shrink-0" />
                      <p className="text-sm font-black text-emerald-700 truncate">{qiCustomerName} 様</p>
                    </div>
                  )}

                  {qiChildren.length > 0 && (
                    <div>
                      <label className="text-xs font-bold text-gray-600 block mb-1.5">お子様を選択（任意）</label>
                      <div className="space-y-1.5">
                        <button onClick={() => setQiChildId(null)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all text-sm font-bold ${
                            qiChildId === null ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}>
                          保護者本人として登録
                        </button>
                        {qiChildren.map(ch => (
                          <button key={ch.id} onClick={() => setQiChildId(ch.id)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${
                              qiChildId === ch.id ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'
                            }`}>
                            <p className="font-bold text-sm text-gray-900">{ch.name}</p>
                            {ch.school_name && <p className="text-xs text-amber-600">{ch.school_name}{ch.grade ? ` ${ch.grade}` : ''}</p>}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={handleQiSave} disabled={qiSaving}
                    className="w-full py-3.5 rounded-xl font-black text-base bg-gradient-to-r from-indigo-600 to-violet-600 text-white disabled:opacity-50 flex items-center justify-center gap-2">
                    {qiSaving ? <><Loader2 size={16} className="animate-spin" />登録中...</> : '受付として登録する'}
                  </button>
                </>
              )}

            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
