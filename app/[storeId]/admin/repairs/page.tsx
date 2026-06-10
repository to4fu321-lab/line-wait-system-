'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'
import {
  Scissors, ShoppingBag, Loader2,
  Check, Package, Plus, AlertCircle, CheckCheck,
  History, Search, Database, ShoppingCart, PackageCheck,
  MessageSquarePlus,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '../_components/BottomNav'
import { InquiryModal, type InquiryRow, type InquiryType, type InquiryStatus } from '../_components/InquiryModal'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import { useDeviceMode } from '@/lib/useDeviceMode'
import { rawToItem, todayJst } from './_components/utils'
import { useSimpleMode } from '@/lib/useSimpleMode'
import type { RepairRow, PurchaseRow, UniformOrderRow, DeliveryItem } from './_components/types'
import { Toast } from './_components/Toast'
import { NewRepairModal } from './_components/NewRepairModal'
import { NewOrderModal } from './_components/NewOrderModal'
import { RepairCard } from './_components/RepairCard'
import { MakerOrderPanel, UniformMakerOrderPanel } from './_components/PurchaseOrderPanel'
import { WaitingCard, CompletedCard } from './_components/DeliveryCards'
import { EditModal } from './_components/EditModal'
import { ArrivalCard } from './_components/ArrivalCard'
import { InquiryTabCard } from './_components/InquiryTabCard'
import { INQ_TYPE_LABELS } from './_components/constants'

// ── Main Page ─────────────────────────────────────────────────
type ActiveTab = 'repair' | 'purchase' | 'arrival' | 'delivery' | 'inquiries'
type DeliverySubTab = 'waiting' | 'history'
type SortOrder = 'priority' | 'received_asc' | 'deadline_asc' | 'school' | 'name' | 'unpaid_first'
type RepairSubTab = 'unstarted' | 'inprogress' | 'outsourced' | 'other'

export default function RepairsPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const { hasFeature } = useStoreFeatures(storeId)
  const { isTablet } = useDeviceMode()
  const { isSimpleMode } = useSimpleMode(storeId)

  const [tab,            setTab]            = useState<ActiveTab>('repair')
  const [deliverySubTab, setDeliverySubTab] = useState<DeliverySubTab>('waiting')
  const [repairSubTab,   setRepairSubTab]   = useState<RepairSubTab>('unstarted')
  const [repairs,        setRepairs]        = useState<RepairRow[]>([])
  const [purchases,      setPurchases]      = useState<PurchaseRow[]>([])
  const [uniformOrders,  setUniformOrders]  = useState<UniformOrderRow[]>([])
  const [waiting,        setWaiting]        = useState<DeliveryItem[]>([])
  const [history,        setHistory]        = useState<DeliveryItem[]>([])
  const [inquiries,      setInquiries]      = useState<InquiryRow[]>([])
  const [loading,        setLoading]        = useState(true)
  const [histLoading,    setHistLoading]    = useState(false)
  const [histFetched,    setHistFetched]    = useState(false)
  const [alertDays,      setAlertDays]      = useState(7)
  const [fetchError,     setFetchError]     = useState<string | null>(null)
  const [toast,          setToast]          = useState<{ type: 'ok' | 'err'; msg: string; onUndo?: () => Promise<void> } | null>(null)
  const [sortOrder,      setSortOrder]      = useState<SortOrder>('priority')
  const [editItem,       setEditItem]       = useState<RepairRow | PurchaseRow | null>(null)
  const [editKind,       setEditKind]       = useState<'repair' | 'purchase' | null>(null)
  const [searchText,     setSearchText]     = useState('')
  const [dummyLoading,   setDummyLoading]   = useState(false)
  const [showNewRepair,   setShowNewRepair]   = useState(false)
  const [showNewOrder,    setShowNewOrder]    = useState(false)
  const [batchSelected,  setBatchSelected]  = useState<Set<string>>(new Set())
  const [batchUpdating,  setBatchUpdating]  = useState(false)
  const [pendingFilter,  setPendingFilter]  = useState(false)

  const [inqStatusFilter, setInqStatusFilter] = useState<InquiryStatus | 'all'>('all')
  const [inqTypeFilter,   setInqTypeFilter]   = useState<InquiryType | 'all'>('all')
  const [showInqModal, setShowInqModal] = useState(false)
  const [editInquiry,  setEditInquiry]  = useState<InquiryRow | null>(null)

  // 開店/閉店
  const [isOpen,          setIsOpen]          = useState<boolean | null>(null)
  const [openCloseModal,  setOpenCloseModal]  = useState<'opening' | 'closing' | null>(null)
  const [briefing,        setBriefing]        = useState<string | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [closingChecklist,setClosingChecklist]= useState<{ label: string; checked: boolean }[]>([])
  const [closingSummary,  setClosingSummary]  = useState<string | null>(null)
  const [closingLoading,  setClosingLoading]  = useState(false)
  const [handoverNote,    setHandoverNote]    = useState('')
  const [confirmingOC,    setConfirmingOC]    = useState(false)

  const showToast = useCallback((type: 'ok' | 'err', msg: string, onUndo?: () => Promise<void>) => {
    setToast({ type, msg, onUndo })
  }, [])

  // is_open 取得
  useEffect(() => {
    if (!storeId) return
    ;(supabase as any).from('stores').select('is_open').eq('id', storeId).single()
      .then(({ data }: { data: { is_open: boolean } | null }) => {
        if (data) setIsOpen(data.is_open)
      })
  }, [storeId])

  const handleToggleOpen = async () => {
    if (isOpen === null) return
    const next = !isOpen
    setIsOpen(next)
    try {
      const res = await fetch('/api/stores/open', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, isOpen: next }),
      })
      const json = await res.json()
      if (!res.ok) { setIsOpen(!next); showToast('err', '受付切替失敗: ' + (json.error ?? 'エラー')); return }
      if (typeof json.is_open === 'boolean') setIsOpen(json.is_open)
    } catch { setIsOpen(!next); showToast('err', '受付切替失敗: 通信エラー') }
  }

  const callBriefingApi = async (mode: 'open' | 'close', note?: string) => {
    const res = await fetch('/api/stores/briefing', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, mode, handoverNote: note ?? '' }),
    })
    return res.ok ? res.json() : null
  }

  const openOpenModal = async () => {
    setOpenCloseModal('opening'); setBriefing(null); setBriefingLoading(true)
    const savedNote = typeof window !== 'undefined' ? (localStorage.getItem(`handover-${storeId}`) ?? '') : ''
    const data = await callBriefingApi('open', savedNote).catch(() => null)
    if (data?.ok) setBriefing(data.briefing)
    setBriefingLoading(false)
  }

  const openClosingModal = async () => {
    setOpenCloseModal('closing'); setClosingSummary(null); setClosingLoading(true)
    setHandoverNote(''); setClosingChecklist([])
    const data = await callBriefingApi('close').catch(() => null)
    if (data?.ok) {
      setClosingSummary(data.summary)
      setClosingChecklist((data.checklist ?? []).map((c: { label: string }) => ({ label: c.label, checked: false })))
    }
    setClosingLoading(false)
  }

  const confirmOpen = async () => {
    setConfirmingOC(true)
    await handleToggleOpen()
    setOpenCloseModal(null); setConfirmingOC(false)
  }

  const confirmClose = async () => {
    setConfirmingOC(true)
    if (typeof window !== 'undefined') {
      handoverNote.trim()
        ? localStorage.setItem(`handover-${storeId}`, handoverNote.trim())
        : localStorage.removeItem(`handover-${storeId}`)
    }
    await handleToggleOpen()
    setOpenCloseModal(null); setConfirmingOC(false)
  }

  useEffect(() => {
    if (!storeId) return
    ;(supabase as any).from('stores').select('alert_days_repair')
      .eq('id', storeId).single()
      .then(({ data }: { data: { alert_days_repair: number } | null }) => {
        if (data?.alert_days_repair) setAlertDays(data.alert_days_repair)
      })
  }, [storeId])

  const fetchAll = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    setFetchError(null)
    const [
      { data: repairData,   error: repairErr   },
      { data: purchaseData, error: purchaseErr  },
      { data: waitRepairs  },
      { data: waitPurchases },
      { data: uniformData  },
      { data: inquiryData  },
    ] = await Promise.all([
      (supabase as any).from('repair_histories')
        .select('*, desired_completion_date, work_started, customer:customers(id,name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'received')
        .order('received_date', { ascending: true }),
      (supabase as any).from('purchase_orders')
        .select('*, customer:customers(id,name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).not('status', 'in', '("arrived","delivered")')
        .order('ordered_date', { ascending: true }),
      supabase.from('repair_histories')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'completed')
        .order('completed_date', { ascending: true }),
      supabase.from('purchase_orders')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'arrived')
        .order('arrived_date', { ascending: true }),
      (supabase as any).from('uniform_orders')
        .select('id,store_id,customer_id,child_id,maker,priority,status,payment_status,total_amount,notes,expected_delivery_date,created_at,updated_at,customer:customers(id,name,tel),child:children(name,school_name),items:uniform_order_items(item_name,size_label,quantity,unit_price)')
        .eq('store_id', storeId).not('status', 'in', '("delivered")')
        .order('created_at', { ascending: true }),
      (supabase as any).from('inquiries')
        .select('id,customer_name,content,type,is_urgent,due_date,status,response_method,response_notes,responded_at,received_by,handled_by,created_at')
        .eq('store_id', storeId)
        .order('created_at', { ascending: true }),
    ])
    if (repairErr)    setFetchError(repairErr.message)
    else if (purchaseErr) setFetchError(purchaseErr.message)
    setRepairs(repairData ?? [])
    setPurchases(purchaseData ?? [])
    setUniformOrders(uniformData ?? [])
    setInquiries(inquiryData ?? [])
    const waitingItems: DeliveryItem[] = [
      ...(waitRepairs   ?? []).map((r: Record<string, unknown>) => rawToItem(r, 'repair')),
      ...(waitPurchases ?? []).map((p: Record<string, unknown>) => rawToItem(p, 'purchase')),
    ].sort((a, b) => (a.ready_date ?? a.received_date).localeCompare(b.ready_date ?? b.received_date))
    setWaiting(waitingItems)
    setLoading(false)
  }, [storeId])

  const fetchHistory = useCallback(async () => {
    if (!storeId || histFetched) return
    setHistLoading(true)
    const [{ data: hRepairs }, { data: hPurchases }] = await Promise.all([
      supabase.from('repair_histories')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'delivered')
        .order('delivered_date', { ascending: false }).limit(100),
      supabase.from('purchase_orders')
        .select('*, customer:customers(name,tel), child:children(name,school_name)')
        .eq('store_id', storeId).eq('status', 'delivered')
        .order('delivered_date', { ascending: false }).limit(100),
    ])
    const histItems: DeliveryItem[] = [
      ...(hRepairs   ?? []).map((r: Record<string, unknown>) => rawToItem(r, 'repair')),
      ...(hPurchases ?? []).map((p: Record<string, unknown>) => rawToItem(p, 'purchase')),
    ].sort((a, b) => (b.delivered_date ?? '').localeCompare(a.delivered_date ?? ''))
    setHistory(histItems)
    setHistLoading(false)
    setHistFetched(true)
  }, [storeId, histFetched])

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => {
    if (tab === 'delivery' && deliverySubTab === 'history' && !histFetched) fetchHistory()
  }, [tab, deliverySubTab, histFetched, fetchHistory])

  // ── Delivery actions ───────────────────────────────────────
  const handleDeliver = useCallback(async (item: DeliveryItem, paid: boolean, deliveredBy: string) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const update: Record<string, unknown> = { status: 'delivered', delivered_date: todayJst() }
    if (paid) update.payment_status = 'paid'
    if (deliveredBy.trim()) update.delivered_by = deliveredBy.trim()
    const { error } = await (supabase as any).from(table).update(update).eq('id', item.id)
    if (error) { showToast('err', `受渡処理失敗: ${error.message}`); return }
    setWaiting(prev => prev.filter(i => i.id !== item.id))
    const snapshot = { ...item }
    showToast('ok', '📦 お渡し済みにしました', async () => {
      const revert: Record<string, unknown> = {
        status: snapshot.prev_status, delivered_date: null, payment_status: snapshot.payment_status,
      }
      if (item.kind === 'repair') revert.completed_date = snapshot.ready_date
      else                        revert.arrived_date   = snapshot.ready_date
      await (supabase as any).from(table).update(revert).eq('id', snapshot.id)
      await fetchAll()
    })
    setHistFetched(false)
  }, [showToast, fetchAll])

  const handleRevert = useCallback(async (item: DeliveryItem) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const update: Record<string, unknown> = { status: item.prev_status, delivered_date: null, payment_status: 'unpaid' }
    if (item.kind === 'repair') update.completed_date = item.ready_date
    else                        update.arrived_date   = item.ready_date
    const { error } = await (supabase as any).from(table).update(update).eq('id', item.id)
    if (error) { showToast('err', `取り消し失敗: ${error.message}`); return }
    setHistory(prev => prev.filter(i => i.id !== item.id))
    await fetchAll()
    showToast('ok', '🔄 お渡し前の状態に戻しました')
  }, [showToast, fetchAll])

  const handlePaymentToggle = useCallback(async (item: DeliveryItem) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const newStatus  = item.payment_status === 'paid' ? 'unpaid' : 'paid'
    const prevStatus = item.payment_status
    const { error } = await (supabase as any).from(table).update({ payment_status: newStatus }).eq('id', item.id)
    if (error) { showToast('err', '支払状態の更新に失敗しました'); return }
    const updater = (prev: DeliveryItem[]) =>
      prev.map(i => i.id === item.id ? { ...i, payment_status: newStatus } : i)
    setWaiting(updater)
    setHistory(updater)
    if (newStatus === 'unpaid') {
      showToast('ok', '未払いに戻しました', async () => {
        await (supabase as any).from(table).update({ payment_status: prevStatus }).eq('id', item.id)
        setWaiting(p => p.map(i => i.id === item.id ? { ...i, payment_status: prevStatus } : i))
        setHistory(p => p.map(i => i.id === item.id ? { ...i, payment_status: prevStatus } : i))
      })
    }
  }, [showToast])

  // ── Revert waiting item to previous state ─────────────────
  const handleRevertWaiting = useCallback(async (item: DeliveryItem) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const update: Record<string, unknown> = { status: item.kind === 'repair' ? 'received' : 'on_order', delivered_date: null }
    if (item.kind === 'repair') { update.completed_date = null; update.work_started = true }
    else update.arrived_date = null
    const { error } = await (supabase as any).from(table).update(update).eq('id', item.id)
    if (error) { showToast('err', `戻し失敗: ${error.message}`); return }
    setWaiting(prev => prev.filter(i => i.id !== item.id))
    await fetchAll()
    showToast('ok', '前の状態に戻しました')
  }, [showToast, fetchAll])

  const handleDeleteWaiting = useCallback(async (item: DeliveryItem) => {
    const table = item.kind === 'repair' ? 'repair_histories' : 'purchase_orders'
    const { error } = await (supabase as any).from(table).delete().eq('id', item.id)
    if (error) { showToast('err', `削除失敗: ${error.message}`); return }
    setWaiting(prev => prev.filter(i => i.id !== item.id))
    showToast('ok', '削除しました')
  }, [showToast])

  // ── Dummy data generator ───────────────────────────────────
  const generateDummy = useCallback(async () => {
    if (!storeId) return
    setDummyLoading(true)
    try {
      const res = await fetch(`/api/admin/seed-test-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeId, dryRun: false, count: 15 }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) {
        showToast('err', json.error ?? 'テストデータ追加に失敗しました')
      } else {
        await fetchAll()
        showToast('ok', `テストデータを追加しました（お直し${json.inserted?.repairs ?? 0}件・発注${json.inserted?.purchases ?? 0}件）`)
      }
    } catch {
      showToast('err', '通信エラーが発生しました')
    } finally {
      setDummyLoading(false)
    }
  }, [storeId, fetchAll, showToast])

  // ── Sort + derived ─────────────────────────────────────────
  const todayDate = new Date(); todayDate.setHours(0, 0, 0, 0)

  function priorityScore(r: RepairRow): number {
    if (!r.desired_completion_date) return 500
    const d = new Date(r.desired_completion_date); d.setHours(0, 0, 0, 0)
    const diff = Math.floor((d.getTime() - todayDate.getTime()) / 86400000)
    if (diff < 0) return diff - 1000
    if (diff === 0) return -100
    if (diff === 1) return -50
    return diff
  }

  const sortFn = (a: RepairRow, b: RepairRow): number => {
    switch (sortOrder) {
      case 'priority':     return priorityScore(a) - priorityScore(b)
      case 'received_asc': return a.received_date.localeCompare(b.received_date)
      case 'deadline_asc': {
        const da = a.desired_completion_date ?? '9999-12-31'
        const db = b.desired_completion_date ?? '9999-12-31'
        return da.localeCompare(db)
      }
      case 'school':       return (a.child?.school_name ?? '').localeCompare(b.child?.school_name ?? '', 'ja')
      case 'name': {
        const na = a.child?.name ?? a.customer?.name ?? ''
        const nb = b.child?.name ?? b.customer?.name ?? ''
        return na.localeCompare(nb, 'ja')
      }
      case 'unpaid_first': {
        const pa = a.prepaid ? 1 : 0; const pb = b.prepaid ? 1 : 0
        return pa !== pb ? pa - pb : priorityScore(a) - priorityScore(b)
      }
      default: return 0
    }
  }

  // 発注タブ: arrived は お渡し待ちに移動済みなので除外済み
  const purchaseUnordered = purchases.filter(p => ['received', 'ordered'].includes(p.status))
  const purchaseOnOrder   = purchases.filter(p => p.status === 'on_order')
  const purchaseStocked   = purchases.filter(p => p.status === 'stocked')

  // Search filter helpers
  function matchSearch(fields: (string | null | undefined)[]): boolean {
    if (!searchText.trim()) return true
    const q = searchText.toLowerCase()
    return fields.some(f => f?.toLowerCase().includes(q))
  }

  // サブタブ用グループ (request_type === 'repair' のみ分類)
  const subUnstarted  = repairs.filter(r => r.request_type === 'repair' && !r.work_started && !r.sent_to_vendor_at)
  const subInProgress = repairs.filter(r => r.request_type === 'repair' && r.work_started)
  const subOutsourced = repairs.filter(r => r.request_type === 'repair' && !!r.sent_to_vendor_at && !r.work_started)
  const subOther      = repairs.filter(r => r.request_type !== 'repair')

  const subTabRepairs =
    repairSubTab === 'unstarted'  ? subUnstarted  :
    repairSubTab === 'inprogress' ? subInProgress :
    repairSubTab === 'outsourced' ? subOutsourced :
    subOther

  const sortedSubTab: RepairRow[] = [...subTabRepairs].sort(sortFn)

  const pendingRepairIds = new Set(
    repairs.filter(r =>
      (r.request_type === 'repair' && !r.work_started) ||
      r.request_type === 'repair_consult' ||
      r.request_type === 'inquiry' ||
      r.request_type === 'payment_pending'
    ).map(r => r.id)
  )
  const filteredRepairs = (pendingFilter
    ? repairs.filter(r => pendingRepairIds.has(r.id))
    : sortedSubTab
  ).filter(r =>
    matchSearch([r.content, r.item_name, r.child?.name, r.customer?.name, r.child?.school_name, r.slip_number])
  )
  const filteredPurchases = purchases.filter(p =>
    matchSearch([p.item_name, p.maker, p.notes, p.child?.name, p.customer?.name, p.child?.school_name])
  )
  const filteredPurchaseUnordered = filteredPurchases.filter(p => ['received', 'ordered'].includes(p.status))
  const filteredPurchaseOnOrder   = filteredPurchases.filter(p => p.status === 'on_order')
  const filteredPurchaseStocked   = filteredPurchases.filter(p => p.status === 'stocked')

  const batchAdvanceRepairs = useCallback(async () => {
    const selected = filteredRepairs.filter(r => batchSelected.has(r.id))
    if (selected.length === 0) return
    const toStart    = selected.filter(r => r.request_type === 'repair' && !r.work_started)
    const toComplete = selected.filter(r => r.request_type !== 'repair' || r.work_started)
    setBatchUpdating(true)
    const today = new Date().toISOString().slice(0, 10)
    const now   = new Date().toISOString()
    const ops: Promise<unknown>[] = []
    if (toStart.length > 0) {
      ops.push((supabase as any).from('repair_histories')
        .update({ work_started: true, updated_at: now })
        .in('id', toStart.map(r => r.id)))
    }
    if (toComplete.length > 0) {
      ops.push((supabase as any).from('repair_histories')
        .update({ status: 'completed', completed_date: today, notified: true, updated_at: now })
        .in('id', toComplete.map(r => r.id)))
    }
    await Promise.all(ops)
    setBatchUpdating(false)
    setBatchSelected(new Set())
    fetchAll()
    const startMsg = toStart.length > 0 ? `作業開始${toStart.length}件` : ''
    const compMsg  = toComplete.length > 0 ? `完了${toComplete.length}件` : ''
    showToast('ok', [startMsg, compMsg].filter(Boolean).join(' / '))
  }, [filteredRepairs, batchSelected, fetchAll, showToast])

  const filteredArrival = [...filteredPurchaseOnOrder, ...filteredPurchaseStocked]

  const batchArriveOrders = useCallback(async () => {
    const selected = filteredArrival.filter(p => batchSelected.has(p.id))
    if (selected.length === 0) return
    setBatchUpdating(true)
    const today = new Date().toISOString().slice(0, 10)
    const now   = new Date().toISOString()
    const { error } = await (supabase as any).from('purchase_orders')
      .update({ status: 'arrived', arrived_date: today, notified: true, updated_at: now })
      .in('id', selected.map(p => p.id))
    setBatchUpdating(false)
    setBatchSelected(new Set())
    if (error) { showToast('err', '入荷完了に失敗しました'); return }
    fetchAll()
    showToast('ok', `入荷完了 ${selected.length}件 → お渡し待ちへ移動しました`)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredArrival, batchSelected, fetchAll, showToast])

  // ダッシュボード counts
  const repairNotStarted  = repairs.filter(r => r.request_type === 'repair' && !r.work_started)
  const repairInProgress  = repairs.filter(r => r.request_type === 'repair' && r.work_started)
  const repairConsult     = repairs.filter(r => r.request_type === 'repair_consult')
  const pendingInquiry    = repairs.filter(r => r.request_type === 'inquiry')
  const pendingPayment    = repairs.filter(r => r.request_type === 'payment_pending')
  const repairOther       = repairs.filter(r => r.request_type !== 'repair' && r.request_type !== 'inquiry')
  const overdueRepairs    = repairs.filter(r => {
    if (!r.desired_completion_date) return false
    const d = new Date(r.desired_completion_date); d.setHours(0, 0, 0, 0)
    return d < todayDate
  })
  const waitingUnpaid = waiting.filter(i => i.payment_status !== 'paid')
  const waitingPaid   = waiting.filter(i => i.payment_status === 'paid')
  const waitingAlert  = waiting.filter(i =>
    i.ready_date && (Date.now() - new Date(i.ready_date).getTime()) / 86400000 > alertDays
  )

  const pendingInquiriesCount = inquiries.filter(i => i.status === 'pending').length
  const urgentInquiriesCount  = inquiries.filter(i => i.is_urgent && i.status !== 'completed').length

  // 未着手数（未着手お直し + 相談 + 未対応問合せ + 入金待ち + お渡しアラート + 問合せ未対応）
  const pendingCount =
    repairNotStarted.length +
    repairConsult.length +
    pendingInquiry.length +
    pendingPayment.length +
    waitingAlert.length +
    pendingInquiriesCount

  // 全案件合計（進行中含む）
  const totalActive =
    repairs.length +
    purchases.length +
    uniformOrders.length +
    waiting.length

  const filteredWaiting = [...waitingUnpaid, ...waitingPaid].filter(i =>
    matchSearch([i.item_name, i.sub_label, i.child?.name, i.customer?.name, i.child?.school_name, i.slip_number])
  )

  const filteredUniformOrders = uniformOrders
    .filter(o => o.status === 'confirmed')
    .filter(o => matchSearch([o.maker, o.customer?.name, o.child?.name, o.child?.school_name, ...(o.items?.map(i => i.item_name) ?? [])]))

  const pendingInqAll = inquiries
    .filter(i => i.status === 'pending')
    .sort((a, b) => Number(b.is_urgent) - Number(a.is_urgent))


  return (
    <div className="min-h-[100dvh] bg-gray-50 text-gray-900">
      {/* ── Header / Dashboard ────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-100" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className={`${isTablet ? 'px-6' : 'max-w-2xl mx-auto px-4'} pt-3 pb-3`}>

          {/* Title row */}
          <div className="flex items-center gap-2 mb-3">
            <h1 className="text-sm font-black text-gray-800 tracking-tight whitespace-nowrap">業務ダッシュボード</h1>
            {/* 開店/閉店ボタン */}
            <button
              onClick={() => { if (isOpen === null) return; isOpen ? openClosingModal() : openOpenModal() }}
              style={{ touchAction: 'manipulation' }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-black text-xs active:opacity-60 transition-all ${
                isOpen === null ? 'bg-gray-200 text-gray-500 opacity-60' :
                isOpen ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-900/50' :
                'bg-indigo-600 text-white shadow-sm shadow-indigo-900/50'
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                isOpen === null ? 'bg-gray-400' : isOpen ? 'bg-white animate-pulse' : 'bg-indigo-200'
              }`} />
              {isOpen === null ? '...' : isOpen ? '営業中' : '開店する'}
            </button>
            <div className="flex-1" />
            {hasFeature('repairs_dummy') && (
              <button onClick={generateDummy} disabled={dummyLoading}
                className="flex items-center gap-1 px-2 py-1.5 bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-400 text-[10px] font-bold rounded-lg transition-all disabled:opacity-50"
                title="テスト用ダミーデータを追加">
                {dummyLoading ? <Loader2 size={11} className="animate-spin" /> : <Database size={11} />}
              </button>
            )}
            <button onClick={() => { setEditInquiry(null); setShowInqModal(true) }}
              className={`flex items-center justify-center gap-1.5 py-2 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-sm shadow-violet-600/20 ${isTablet ? 'px-3' : 'px-2.5'}`}>
              <MessageSquarePlus size={13} />
              {isTablet && '問合せ'}
            </button>
            <button onClick={() => setShowNewOrder(true)}
              className={`flex items-center justify-center gap-1.5 py-2 bg-teal-600 hover:bg-teal-500 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-sm shadow-teal-600/20 ${isTablet ? 'px-3' : 'px-2.5'}`}>
              <ShoppingCart size={13} />
              {isTablet && '制服注文'}
            </button>
            <button onClick={() => setShowNewRepair(true)}
              className={`flex items-center justify-center gap-1.5 py-2 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white text-xs font-black rounded-xl transition-all shadow-sm shadow-indigo-600/20 ${isTablet ? 'px-3' : 'px-2.5'}`}>
              <Scissors size={13} />
              {isTablet && 'お直し'}
            </button>
          </div>

          {/* Dashboard card */}
          <div className="bg-gradient-to-br from-indigo-700 via-indigo-600 to-violet-600 rounded-2xl px-4 pt-3 pb-0 text-white shadow-lg shadow-indigo-600/25">
            {(() => {
              const pendingInquiries = pendingInquiriesCount
              const urgentInquiries  = urgentInquiriesCount
              const dashTabs = [
                { id: 'repair'    as const, emoji: '✂️', label: 'お直し',   count: repairs.length,                                     urgent: 0 },
                { id: 'purchase'  as const, emoji: '📦', label: '発注',     count: purchaseUnordered.length + uniformOrders.length,    urgent: 0 },
                { id: 'arrival'   as const, emoji: '🚚', label: '入荷待ち', count: purchaseOnOrder.length + purchaseStocked.length,     urgent: 0 },
                { id: 'delivery'  as const, emoji: '🎁', label: 'お渡し',   count: waiting.length,                                     urgent: 0 },
                { id: 'inquiries' as const, emoji: '💬', label: '問合せ',   count: pendingInquiries,                                   urgent: urgentInquiries },
              ]
              const togglePending = () => setPendingFilter(prev => !prev)
              if (!isTablet) {
                return (
                  <div className="flex items-stretch gap-2 pb-2">
                    {/* 要対応 tappable area */}
                    <button className="flex-1 text-left active:opacity-80 transition-opacity" onClick={togglePending}>
                      <p className="text-[9px] font-bold opacity-60 uppercase tracking-widest mb-0.5">
                        {pendingFilter ? '▶ 要対応' : '要対応'}
                      </p>
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-4xl font-black leading-none tabular-nums ${pendingFilter ? 'text-amber-300' : ''}`}>{pendingCount}</span>
                        <span className="text-sm font-bold opacity-60">件</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] opacity-40">全{totalActive}</span>
                        {overdueRepairs.length > 0 && <span className="text-[9px] text-red-300 font-black">🚨 {overdueRepairs.length}</span>}
                        {pendingFilter && <span className="text-[9px] text-amber-300 font-black">絞込中</span>}
                      </div>
                    </button>
                    {/* Tab list — horizontal scroll */}
                    <div className="flex gap-1 shrink-0 self-center overflow-x-auto no-scrollbar">
                      {dashTabs.map(t => {
                        const isInq = t.id === 'inquiries'
                        const hasAlert = isInq && (t.urgent > 0 || t.count > 0)
                        return (
                          <button key={t.id}
                            onClick={() => { setTab(t.id); setSearchText(''); setBatchSelected(new Set()); setPendingFilter(false) }}
                            className={`rounded-xl px-2 py-1.5 text-center transition-all active:scale-[0.97] min-w-[48px] shrink-0 relative ${
                              tab === t.id
                                ? hasAlert ? 'bg-red-500/30 ring-1 ring-red-300/50' : 'bg-white/20 ring-1 ring-white/30'
                                : hasAlert ? 'bg-red-500/20 opacity-90' : 'hover:bg-white/10 opacity-60'
                            }`}>
                            <p className={`text-lg font-black leading-none tabular-nums ${hasAlert ? 'text-red-200' : ''}`}>
                              {t.count > 0 ? t.count : <span className="opacity-30">0</span>}
                            </p>
                            <p className="text-[9px] font-bold mt-0.5 opacity-80">{t.emoji} {t.label}</p>
                            {t.urgent > 0 && (
                              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
                                {t.urgent}
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              }
              // Tablet mode: original two-row layout
              return (
                <>
                  <div className="flex items-start gap-4 mb-3">
                    <button className="flex-1 text-left active:opacity-80 transition-opacity" onClick={togglePending}>
                      <p className="text-[10px] font-bold opacity-60 uppercase tracking-widest mb-0.5">
                        {pendingFilter ? '▶ 要対応（絞込中）' : '要対応'}
                      </p>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-5xl font-black leading-none tabular-nums ${pendingFilter ? 'text-amber-300' : ''}`}>{pendingCount}</span>
                        <span className="text-base font-bold opacity-60">件</span>
                        <span className="text-[10px] opacity-40 font-medium">/ 全{totalActive}</span>
                      </div>
                    </button>
                    {overdueRepairs.length > 0 && (
                      <div className="bg-red-500/25 border border-red-400/40 rounded-2xl px-3 py-2 text-center min-w-[52px]">
                        <p className="text-2xl font-black text-red-100 leading-none">{overdueRepairs.length}</p>
                        <p className="text-[9px] font-bold text-red-200 mt-0.5">🚨 期限超過</p>
                      </div>
                    )}
                  </div>
                  <div className="grid gap-1 border-t border-white/15 pt-2 -mx-4 px-4"
                    style={{ gridTemplateColumns: `repeat(${dashTabs.length}, 1fr)` }}>
                    {dashTabs.map(t => {
                      const isInq = t.id === 'inquiries'
                      const hasAlert = isInq && (t.urgent > 0 || t.count > 0)
                      return (
                        <button key={t.id} onClick={() => { setTab(t.id); setSearchText(''); setBatchSelected(new Set()); setPendingFilter(false) }}
                          className={`rounded-t-xl py-2.5 text-center transition-all active:scale-[0.97] relative ${
                            tab === t.id
                              ? hasAlert ? 'bg-red-500/30 ring-1 ring-red-300/50' : 'bg-white/20 ring-1 ring-white/30'
                              : hasAlert ? 'bg-red-500/20 opacity-90' : 'hover:bg-white/10 opacity-70'
                          }`}>
                          <p className={`text-xl font-black leading-none tabular-nums ${hasAlert ? 'text-red-200' : ''}`}>
                            {t.count > 0 ? t.count : <span className="opacity-30">0</span>}
                          </p>
                          <p className="text-[10px] font-bold mt-0.5 opacity-80">{t.emoji} {t.label}</p>
                          {t.urgent > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center leading-none">
                              {t.urgent}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className={`${isTablet ? 'px-6 pb-8' : 'max-w-2xl mx-auto px-4 pb-32'} pt-4 space-y-3`}>
        {fetchError && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-xs text-red-600 flex items-center gap-2">
            <AlertCircle size={13} />DBエラー: {fetchError}
          </div>
        )}

        {/* お渡し — sub-tabs */}
        {tab === 'delivery' && (
          <div className="flex bg-white border border-gray-200 rounded-2xl p-1 gap-1 shadow-sm">
            {([
              { id: 'waiting' as const, label: 'お渡し待ち', count: waiting.length },
              { id: 'history' as const, label: '完了履歴',   count: null },
            ]).map(t => (
              <button key={t.id} onClick={() => setDeliverySubTab(t.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-bold text-sm transition-all ${
                  deliverySubTab === t.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}>
                {t.id === 'waiting' ? <Package size={13} /> : <History size={13} />}
                {t.label}
                {t.count !== null && t.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-black ${
                    deliverySubTab === t.id ? 'bg-white/25 text-white' : 'bg-indigo-100 text-indigo-600'
                  }`}>{t.count}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-indigo-400">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-xs font-bold text-gray-400">読み込み中...</p>
          </div>

        ) : pendingFilter ? (
          /* ── 要対応まとめビュー ──────────────────────────── */
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-300 rounded-xl">
              <span className="text-xs font-black text-amber-700 flex-1">
                要対応のみ表示中（{filteredRepairs.length + pendingInqAll.length}件）
              </span>
              <button onClick={() => setPendingFilter(false)}
                className="text-[10px] font-black text-amber-600 hover:text-amber-800 px-2 py-0.5 bg-amber-100 hover:bg-amber-200 rounded-full transition-colors">
                解除
              </button>
            </div>

            {filteredRepairs.length === 0 && pendingInqAll.length === 0 && (
              <div className="text-center py-20 text-gray-400">
                <p className="text-sm font-bold">要対応の案件はありません</p>
              </div>
            )}

            {filteredRepairs.length > 0 && (
              <>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">✂️ お直し・案件 ({filteredRepairs.length})</p>
                <div className={isTablet ? 'grid grid-cols-2 gap-2' : 'space-y-1.5'}>
                  {filteredRepairs.map(r => (
                    <RepairCard key={r.id} item={r} storeId={storeId} onRefresh={fetchAll} onToast={showToast}
                      onEdit={item => { setEditItem(item); setEditKind('repair') }}
                      selected={false} onToggle={() => {}} isSimpleMode={isSimpleMode} />
                  ))}
                </div>
              </>
            )}

            {pendingInqAll.length > 0 && (
              <>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">💬 問合せ未対応 ({pendingInqAll.length})</p>
                <div className="space-y-1.5">
                  {pendingInqAll.map(i => (
                    <InquiryTabCard key={i.id} item={i}
                      onEdit={item => { setEditInquiry(item); setShowInqModal(true) }}
                      onStatusChange={(id, s) => setInquiries(prev => prev.map(x => x.id === id ? { ...x, status: s } : x))}
                      isSimpleMode={isSimpleMode} />
                  ))}
                </div>
              </>
            )}
          </div>

        ) : tab === 'repair' ? (
          /* ── ①お直しタブ ─────────────────────────────────── */
          <div className="space-y-2">
            {/* Search + Sort row */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                  placeholder="名前・品名・学校で絞り込み"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:outline-none shadow-sm"
                />
              </div>
              <select value={sortOrder} onChange={e => setSortOrder(e.target.value as SortOrder)}
                className="bg-white border border-gray-200 rounded-xl px-2.5 py-2.5 text-xs text-gray-700 font-bold focus:border-indigo-500 focus:outline-none shrink-0 shadow-sm">
                <option value="priority">優先順</option>
                <option value="received_asc">受付日順</option>
                <option value="deadline_asc">期限順</option>
                <option value="school">学校順</option>
                <option value="name">顧客名順</option>
                <option value="unpaid_first">未払い優先</option>
              </select>
            </div>

            {/* サブタブ */}
            {!pendingFilter && (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 no-scrollbar">
              {([
                { id: 'unstarted'  as const, label: '加工未',   count: subUnstarted.length,  color: 'bg-orange-500' },
                { id: 'inprogress' as const, label: '加工中',   count: subInProgress.length, color: 'bg-amber-500'  },
                { id: 'outsourced' as const, label: '外注待ち',  count: subOutsourced.length, color: 'bg-purple-500' },
                { id: 'other'      as const, label: '問合せ等', count: subOther.length,      color: 'bg-gray-400'   },
              ]).map(st => (
                <button key={st.id}
                  onClick={() => { setRepairSubTab(st.id); setBatchSelected(new Set()) }}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap ${
                    repairSubTab === st.id
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                  }`}>
                  {st.label}
                  {st.count > 0 && (
                    <span className={`text-[10px] font-black min-w-[16px] text-center ${repairSubTab === st.id ? 'text-indigo-200' : 'text-gray-400'}`}>
                      {st.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
            )}

            {filteredRepairs.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Scissors size={28} className="opacity-40" />
                </div>
                <p className="text-sm font-bold">{searchText ? '該当するお直しがありません' : '対応中のお直し・依頼はありません'}</p>
              </div>
            ) : (
              <>
                {/* Select-all row */}
                <div className="flex items-center justify-between px-1 py-0.5">
                  <button
                    onClick={() => setBatchSelected(
                      batchSelected.size === filteredRepairs.length
                        ? new Set()
                        : new Set(filteredRepairs.map(r => r.id))
                    )}
                    className="flex items-center gap-2 text-xs font-black text-gray-500 hover:text-indigo-600 transition-colors">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      batchSelected.size === filteredRepairs.length && filteredRepairs.length > 0
                        ? 'border-indigo-600 bg-indigo-600 scale-110' : 'border-gray-300'
                    }`}>
                      {batchSelected.size === filteredRepairs.length && filteredRepairs.length > 0 &&
                        <Check size={9} className="text-white" />}
                    </div>
                    {batchSelected.size > 0 ? `${batchSelected.size}件選択中` : 'まとめて選択'}
                  </button>
                  {batchSelected.size > 0 && (
                    <button onClick={() => setBatchSelected(new Set())}
                      className="text-xs text-gray-400 hover:text-gray-600 font-medium px-2 py-1 rounded-lg hover:bg-gray-100 transition-all">
                      選択解除
                    </button>
                  )}
                </div>
                <div className={isTablet ? 'grid grid-cols-2 gap-2' : 'space-y-1.5'}>
                  {filteredRepairs.map(r => (
                    <RepairCard key={r.id} item={r} storeId={storeId} onRefresh={fetchAll} onToast={showToast}
                      onEdit={item => { setEditItem(item); setEditKind('repair') }}
                      selected={batchSelected.has(r.id)}
                      isSimpleMode={isSimpleMode}
                      onToggle={() => setBatchSelected(prev => {
                        const n = new Set(prev); n.has(r.id) ? n.delete(r.id) : n.add(r.id); return n
                      })}
                    />
                  ))}
                </div>
                {/* Floating batch action bar */}
                {batchSelected.size > 0 && (
                  <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
                    <div className="max-w-lg w-full bg-indigo-700 text-white rounded-2xl shadow-2xl shadow-indigo-900/30 p-3.5 flex items-center gap-3 pointer-events-auto border border-indigo-500/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-wider">選択中</p>
                        <p className="text-base font-black">{batchSelected.size}件</p>
                      </div>
                      <button onClick={() => setBatchSelected(new Set())}
                        className="text-xs text-white/60 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/10 transition-all">
                        解除
                      </button>
                      <button onClick={batchAdvanceRepairs} disabled={batchUpdating}
                        className="shrink-0 px-5 py-2.5 bg-white text-indigo-700 font-black text-sm rounded-xl flex items-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow-md">
                        {batchUpdating ? <Loader2 size={14} className="animate-spin" /> : <CheckCheck size={14} />}
                        まとめて次へ
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        ) : tab === 'purchase' ? (
          /* ── ②発注タブ ───────────────────────────────────── */
          <div className="space-y-4">
            {/* Search + 注文管理リンク */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                  placeholder="名前・品名・メーカーで絞り込み"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:outline-none shadow-sm"
                />
              </div>
              <a href={`/${storeId}/admin/orders`}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2.5 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-100 transition-colors whitespace-nowrap">
                <Database size={12} />注文管理
              </a>
            </div>

            {filteredPurchaseUnordered.length === 0 && filteredUniformOrders.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <ShoppingBag size={28} className="opacity-40" />
                </div>
                <p className="text-sm font-bold">{searchText ? '該当する発注がありません' : '未発注の依頼はありません'}</p>
              </div>
            ) : (
              <>
                {/* 制服注文: メーカー別発注パネル */}
                {filteredUniformOrders.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2.5 mb-3 px-1">
                      <div className="w-2 h-6 rounded-full bg-indigo-500 shrink-0" />
                      <p className="text-sm font-black text-gray-800 flex-1">制服注文（未発注）</p>
                      <span className="text-xs font-black bg-indigo-100 text-indigo-700 px-2.5 py-1 rounded-full">{filteredUniformOrders.length}件</span>
                    </div>
                    <UniformMakerOrderPanel
                      orders={filteredUniformOrders}
                      onRefresh={fetchAll}
                      onToast={showToast}
                    />
                  </section>
                )}

                {/* 未発注: メーカー別発注パネル */}
                {filteredPurchaseUnordered.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2.5 mb-3 px-1">
                      <div className="w-2 h-6 rounded-full bg-orange-500 shrink-0" />
                      <p className="text-sm font-black text-gray-800 flex-1">追加購入（未発注）</p>
                      <span className="text-xs font-black bg-orange-100 text-orange-700 px-2.5 py-1 rounded-full">{filteredPurchaseUnordered.length}件</span>
                    </div>
                    <MakerOrderPanel
                      orders={filteredPurchaseUnordered}
                      onRefresh={fetchAll} onToast={showToast}
                      onEdit={item => { setEditItem(item); setEditKind('purchase') }}
                    />
                  </section>
                )}
              </>
            )}
          </div>

        ) : tab === 'arrival' ? (
          /* ── ③入荷待ちタブ ────────────────────────────────── */
          <div className="space-y-2">
            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                placeholder="名前・品名・メーカーで絞り込み"
                className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:outline-none shadow-sm"
              />
            </div>

            {filteredArrival.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <PackageCheck size={28} className="opacity-40" />
                </div>
                <p className="text-sm font-bold">{searchText ? '該当する入荷待ちがありません' : '入荷待ちの商品はありません'}</p>
              </div>
            ) : (
              <>
                {/* Select-all row */}
                <div className="flex items-center justify-between px-1 py-0.5">
                  <button
                    onClick={() => setBatchSelected(
                      batchSelected.size === filteredArrival.length
                        ? new Set()
                        : new Set(filteredArrival.map(p => p.id))
                    )}
                    className="flex items-center gap-2 text-xs font-black text-gray-500 hover:text-blue-600 transition-colors">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                      batchSelected.size === filteredArrival.length && filteredArrival.length > 0
                        ? 'border-blue-600 bg-blue-600 scale-110' : 'border-gray-300'
                    }`}>
                      {batchSelected.size === filteredArrival.length && filteredArrival.length > 0 &&
                        <Check size={9} className="text-white" />}
                    </div>
                    {batchSelected.size > 0 ? `${batchSelected.size}件選択中` : 'まとめて選択'}
                  </button>
                  {batchSelected.size > 0 && (
                    <button onClick={() => setBatchSelected(new Set())}
                      className="text-xs text-gray-400 hover:text-gray-600 font-medium px-2 py-1 rounded-lg hover:bg-gray-100 transition-all">
                      選択解除
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {filteredArrival.map(p => (
                    <ArrivalCard key={p.id} item={p} storeId={storeId} onRefresh={fetchAll} onToast={showToast}
                      onEdit={item => { setEditItem(item); setEditKind('purchase') }}
                      selected={batchSelected.has(p.id)}
                      onToggle={() => setBatchSelected(prev => {
                        const n = new Set(prev); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n
                      })}
                    />
                  ))}
                </div>

                {/* Floating batch action bar */}
                {batchSelected.size > 0 && (
                  <div className="fixed bottom-20 left-0 right-0 z-30 flex justify-center px-4 pointer-events-none">
                    <div className="max-w-lg w-full bg-blue-700 text-white rounded-2xl shadow-2xl shadow-blue-900/30 p-3.5 flex items-center gap-3 pointer-events-auto border border-blue-500/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold opacity-60 uppercase tracking-wider">選択中</p>
                        <p className="text-base font-black">{batchSelected.size}件</p>
                      </div>
                      <button onClick={() => setBatchSelected(new Set())}
                        className="text-xs text-white/60 hover:text-white px-2 py-1.5 rounded-lg hover:bg-white/10 transition-all">
                        解除
                      </button>
                      <button onClick={batchArriveOrders} disabled={batchUpdating}
                        className="shrink-0 px-5 py-2.5 bg-white text-blue-700 font-black text-sm rounded-xl flex items-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow-md">
                        {batchUpdating ? <Loader2 size={14} className="animate-spin" /> : <PackageCheck size={14} />}
                        まとめて入荷完了
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

        ) : tab === 'delivery' ? (
          /* ── ④お渡しタブ ─────────────────────────────────── */
          deliverySubTab === 'waiting' ? (
            <>
              {/* Search */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={searchText} onChange={e => setSearchText(e.target.value)}
                  placeholder="名前・品名で絞り込み"
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:border-indigo-500 focus:outline-none shadow-sm"
                />
              </div>
              {filteredWaiting.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Package size={28} className="opacity-40" />
                  </div>
                  <p className="text-sm font-bold">{searchText ? '該当するアイテムがありません' : 'お渡し待ちのアイテムはありません'}</p>
                  {!searchText && <p className="text-xs mt-2 text-gray-400">お直し完了・入荷済みの商品がここに表示されます</p>}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredWaiting.map(item => (
                    <WaitingCard key={item.id} item={item} alertDays={alertDays}
                      onDeliver={handleDeliver} onPaymentToggle={handlePaymentToggle}
                      onRevertWaiting={handleRevertWaiting} onDelete={handleDeleteWaiting} />
                  ))}
                </div>
              )}
            </>
          ) : (
            histLoading ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-indigo-400">
                <Loader2 size={28} className="animate-spin" />
                <p className="text-xs font-bold text-gray-400">読み込み中...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <History size={28} className="opacity-40" />
                </div>
                <p className="text-sm font-bold">お渡し完了履歴はありません</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {history.map(item => (
                  <CompletedCard key={item.id} item={item} onRevert={handleRevert} onPaymentToggle={handlePaymentToggle} />
                ))}
              </div>
            )
          )
        ) : tab === 'inquiries' ? (
          /* ── ⑤問合せ管理（インライン） ──────────────────────── */
          <div className="space-y-1.5">
            {/* 進捗フィルター: 4等分グリッド */}
            {(() => {
              const counts: Record<string, number> = {
                all: inquiries.length,
                pending:     inquiries.filter(i => i.status === 'pending').length,
                in_progress: inquiries.filter(i => i.status === 'in_progress').length,
                completed:   inquiries.filter(i => i.status === 'completed').length,
              }
              return (
                <div className="grid grid-cols-4 gap-1">
                  {([
                    { key: 'all',         label: '全て',  color: 'text-gray-800', activeBg: 'bg-gray-700 border-gray-700', inactiveBg: 'bg-gray-50 border-gray-200' },
                    { key: 'pending',     label: '未対応', color: 'text-red-700',  activeBg: 'bg-red-500 border-red-500',   inactiveBg: 'bg-red-50 border-red-200'   },
                    { key: 'in_progress', label: '対応中', color: 'text-amber-700',activeBg: 'bg-amber-500 border-amber-500',inactiveBg: 'bg-amber-50 border-amber-200'},
                    { key: 'completed',   label: '完了',  color: 'text-green-700',activeBg: 'bg-green-600 border-green-600',inactiveBg: 'bg-green-50 border-green-200'},
                  ] as const).map(s => {
                    const isActive = inqStatusFilter === s.key
                    return (
                      <button key={s.key} type="button"
                        onClick={() => { setInqStatusFilter(s.key); setInqTypeFilter('all') }}
                        className={`flex flex-col items-center py-1.5 rounded-xl text-center border transition-colors active:scale-95 ${isActive ? s.activeBg : s.inactiveBg}`}>
                        <span className={`text-sm font-black tabular-nums leading-none ${isActive ? 'text-white' : counts[s.key] > 0 ? s.color : 'text-gray-300'}`}>
                          {counts[s.key]}
                        </span>
                        <span className={`text-[9px] font-bold mt-0.5 ${isActive ? 'text-white' : counts[s.key] > 0 ? s.color : 'text-gray-300'}`}>
                          {s.label}
                        </span>
                      </button>
                    )
                  })}
                </div>
              )
            })()}
            {/* 種別フィルター: コンパクトピル */}
            <div className="flex gap-1 overflow-x-auto no-scrollbar">
              {(['all', 'inquiry', 'complaint', 'request', 'other'] as const).map(t => (
                <button key={t} onClick={() => setInqTypeFilter(t)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap flex-shrink-0 transition-colors border ${
                    inqTypeFilter === t
                      ? t === 'all' ? 'bg-gray-700 text-white border-gray-700'
                        : t === 'complaint' ? 'bg-red-500 text-white border-red-500'
                        : t === 'request'   ? 'bg-purple-500 text-white border-purple-500'
                        : 'bg-blue-500 text-white border-blue-500'
                      : 'bg-white text-gray-400 border-gray-200'
                  }`}>
                  {t === 'all' ? '全種別' : INQ_TYPE_LABELS[t as InquiryType]}
                </button>
              ))}
            </div>
            {/* リスト: 種別フィルターのみ。進捗は常に全件表示しバッジで確認 */}
            {(() => {
              const statusOrder: Record<InquiryStatus, number> = { pending: 0, in_progress: 1, completed: 2 }
              const filtered = inquiries
                .filter(i => inqStatusFilter === 'all' || i.status === inqStatusFilter)
                .filter(i => inqTypeFilter   === 'all' || i.type   === inqTypeFilter)
                .sort((a, b) => {
                  if (a.is_urgent !== b.is_urgent) return a.is_urgent ? -1 : 1
                  return statusOrder[a.status] - statusOrder[b.status]
                })
              if (filtered.length === 0) return (
                <div className="text-center py-16 text-gray-400">
                  <MessageSquarePlus size={28} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">問合せはありません</p>
                </div>
              )
              return (
                <div className="space-y-2">
                  {filtered.map(inq => (
                    <InquiryTabCard key={inq.id} item={inq}
                      onEdit={item => { setEditInquiry(item); setShowInqModal(true) }}
                      onStatusChange={(id, s) => setInquiries(prev => prev.map(i => i.id === id ? { ...i, status: s } : i))}
                      isSimpleMode={isSimpleMode}
                    />
                  ))}
                </div>
              )
            })()}
          </div>
        ) : null}

      </div>

      {toast && <Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo} onClose={() => setToast(null)} />}
      {editItem && editKind && (
        <EditModal kind={editKind} item={editItem}
          onClose={() => setEditItem(null)}
          onSave={() => { setEditItem(null); fetchAll() }}
          onToast={(t, m) => showToast(t, m)} />
      )}
      {showNewRepair && (
        <NewRepairModal
          storeId={storeId}
          onClose={() => setShowNewRepair(false)}
          onSave={fetchAll}
          onToast={showToast}
          showOcr={true}
        />
      )}
      {showNewOrder && (
        <NewOrderModal
          storeId={storeId}
          onClose={() => setShowNewOrder(false)}
          onSave={() => { setShowNewOrder(false); fetchAll() }}
          onToast={showToast}
        />
      )}
      {showInqModal && (
        <InquiryModal
          key={editInquiry?.id ?? 'new'}
          storeId={storeId}
          item={editInquiry}
          onClose={() => setShowInqModal(false)}
          onSave={fetchAll}
          isSimpleMode={isSimpleMode}
        />
      )}

      {/* 開店ブリーフィングモーダル */}
      {openCloseModal === 'opening' && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pt-4"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-5">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌅</span>
                <div>
                  <h2 className="text-white font-black text-lg">開店ブリーフィング</h2>
                  <p className="text-amber-100 text-xs">今日のポイントをお伝えします</p>
                </div>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              {briefingLoading ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 size={32} className="animate-spin text-amber-400" />
                  <p className="text-gray-400 text-sm">AIが今日の情報を確認しています…</p>
                </div>
              ) : briefing ? (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4">
                  <p className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap">{briefing}</p>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center text-gray-400 text-sm">
                  情報を取得できませんでした
                </div>
              )}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setOpenCloseModal(null)}
                  className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm active:opacity-70"
                  style={{ touchAction: 'manipulation' }}>
                  キャンセル
                </button>
                <button onClick={confirmOpen} disabled={confirmingOC}
                  className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 text-white font-black text-sm shadow-lg active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{ touchAction: 'manipulation' }}>
                  {confirmingOC ? <Loader2 size={16} className="animate-spin" /> : <span>🌅</span>}
                  開店する
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 閉店チェックモーダル */}
      {openCloseModal === 'closing' && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pt-4"
          style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden max-h-[88dvh] flex flex-col">
            <div className="bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-5 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🌙</span>
                <div>
                  <h2 className="text-white font-black text-lg">閉店チェック</h2>
                  <p className="text-indigo-100 text-xs">今日の締めをしっかり確認</p>
                </div>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              {closingLoading ? (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 size={32} className="animate-spin text-indigo-400" />
                  <p className="text-gray-400 text-sm">AIが今日のサマリーを生成しています…</p>
                </div>
              ) : (
                <>
                  {closingSummary && (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-4 py-3">
                      <p className="text-gray-800 text-sm leading-relaxed">{closingSummary}</p>
                    </div>
                  )}
                  {closingChecklist.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">チェックリスト</p>
                      {closingChecklist.map((item, i) => (
                        <button key={i}
                          onClick={() => setClosingChecklist(prev => prev.map((c, j) => j === i ? { ...c, checked: !c.checked } : c))}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all active:opacity-70 ${
                            item.checked ? 'bg-emerald-50 border-emerald-300' : 'bg-white border-gray-200'
                          }`}
                          style={{ touchAction: 'manipulation' }}>
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                            item.checked ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300'
                          }`}>
                            {item.checked && (
                              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                                <path d="M1 4L4 7L9 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </div>
                          <span className={`text-sm font-medium ${item.checked ? 'text-emerald-700 line-through' : 'text-gray-700'}`}>
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider block">明日への引継ぎメモ</label>
                    <textarea value={handoverNote} onChange={e => setHandoverNote(e.target.value)}
                      placeholder="明日のスタッフへ伝えることがあれば…（任意）"
                      rows={3}
                      className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-sm text-gray-800 placeholder-gray-300 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                  </div>
                </>
              )}
            </div>
            <div className="px-6 pb-6 pt-2 flex gap-3 shrink-0 border-t border-gray-100">
              <button onClick={() => setOpenCloseModal(null)}
                className="flex-1 py-3.5 rounded-2xl border border-gray-200 text-gray-500 font-bold text-sm active:opacity-70"
                style={{ touchAction: 'manipulation' }}>
                キャンセル
              </button>
              <button onClick={confirmClose} disabled={confirmingOC}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-black text-sm shadow-lg active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
                style={{ touchAction: 'manipulation' }}>
                {confirmingOC ? <Loader2 size={16} className="animate-spin" /> : <span>🌙</span>}
                閉店する
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
