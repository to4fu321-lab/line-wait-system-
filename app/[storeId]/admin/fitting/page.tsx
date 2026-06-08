'use client'

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react'
import { useParams } from 'next/navigation'
import {
  Search, User, GraduationCap, Ruler, ChevronLeft, ChevronRight,
  Plus, Minus, Check, Loader2, X, AlertCircle, ChevronDown, ChevronUp,
  Phone, RotateCcw, CalendarClock, Send, Bell,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { BottomNav } from '../_components/BottomNav'
import { GRADE_OPTIONS } from '@/types/crm'

// ── 型定義 ───────────────────────────────────────────────────
type FittingStep = 'customer' | 'measure' | 'confirm' | 'done'

interface SchoolRow   { id: string; name: string; short_name: string | null; sort_order: number }
interface CustomerRow { id: string; name: string; kana: string | null; tel: string | null }
interface ChildRow {
  id: string; customer_id: string; store_id: string
  name: string; kana: string | null
  school_id: string | null; school_name: string | null
  grade: string | null; gender: string | null
}
interface ProductRow {
  id: string; item_name: string; category: string | null
  gender: string | null; maker_code: string | null; sort_order: number
}
interface VariantRow {
  id: string; product_id: string; size_label: string
  price: number; sort_order: number
}
interface ConfirmedSize {
  variant_id: string; size_label: string; qty: number; memo: string
}
type ConfirmedSizes = Record<string, ConfirmedSize>

interface ReservationRow {
  id:          string
  reserved_at: string
  status:      string
  purpose:     string | null
  line_user_id: string | null
  customer_id: string | null
  child_id:    string | null
  customers:   { id: string; name: string; kana: string | null; tel: string | null; line_user_id: string | null } | null
  children:    { id: string; name: string; school_id: string | null; school_name: string | null; gender: string | null; grade: string | null } | null
}

// ── サイズ自動推奨 ────────────────────────────────────────────
function recommendVariant(heightCm: number, variants: VariantRow[]): VariantRow | null {
  if (!variants.length || !heightCm) return null
  const withNum = variants
    .map(v => ({ v, n: parseInt(v.size_label.replace(/[^0-9]/g, '')) || 0 }))
    .filter(x => x.n > 0)
  if (!withNum.length) return null
  const above = withNum.filter(x => x.n >= heightCm).sort((a, b) => a.n - b.n)
  return above[0]?.v ?? withNum[withNum.length - 1].v
}

// ── 小コンポーネント ─────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: 'ok' | 'err'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl max-w-sm text-center ${
      type === 'err' ? 'bg-red-600' : 'bg-gray-900'
    }`}>{msg}</div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1.5">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm bg-white focus:outline-none focus:border-indigo-500'
const SELECT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm bg-white focus:outline-none focus:border-indigo-500'

// ── ステップインジケーター ────────────────────────────────────
function StepBar({ step }: { step: FittingStep }) {
  const steps = [
    { key: 'customer', label: 'お客様' },
    { key: 'measure',  label: '採寸'  },
    { key: 'confirm',  label: '確認'  },
  ]
  const idx = step === 'done' ? 3 : steps.findIndex(s => s.key === step)
  return (
    <div className="flex items-center gap-1">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center gap-1">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-colors ${
            i < idx ? 'bg-indigo-600 text-white' :
            i === idx ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-600' :
            'bg-gray-100 text-gray-400'
          }`}>
            {i < idx ? <Check size={12} /> : i + 1}
          </div>
          <span className={`text-xs font-medium hidden sm:inline ${i === idx ? 'text-indigo-700' : 'text-gray-400'}`}>{s.label}</span>
          {i < steps.length - 1 && <div className={`w-6 h-px mx-0.5 ${i < idx ? 'bg-indigo-400' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}

// ============================================================
// メインコンポーネント
// ============================================================
function FittingPageInner() {
  const params  = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''

  const [step, setStep] = useState<FittingStep>('customer')
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const showToast = useCallback((type: 'ok' | 'err', msg: string) =>
    setToast({ type, msg }), [])

  // ── 予約連動 ──────────────────────────────────────────────
  const [reservations,    setReservations]    = useState<ReservationRow[]>([])
  const [loadingRes,      setLoadingRes]      = useState(true)
  const [showResPanel,    setShowResPanel]    = useState(true)
  const [linkedResId,     setLinkedResId]     = useState<string | null>(null)
  const [linkedLineUserId, setLinkedLineUserId] = useState<string | null>(null)
  const [notifySending,   setNotifySending]   = useState(false)

  // ── ステップ1+2: お客様・お子様 ──────────────────────────
  const [schools,        setSchools]        = useState<SchoolRow[]>([])
  const [query,          setQuery]          = useState('')
  const [searching,      setSearching]      = useState(false)
  const [results,        setResults]        = useState<CustomerRow[]>([])
  const [customer,       setCustomer]       = useState<CustomerRow | null>(null)
  const [children,       setChildren]       = useState<ChildRow[]>([])
  const [child,          setChild]          = useState<ChildRow | null>(null)
  const [showAddChild,   setShowAddChild]   = useState(false)
  const [loadingChild,   setLoadingChild]   = useState(false)

  // 新規お子様フォーム
  const [ncName,     setNcName]     = useState('')
  const [ncKana,     setNcKana]     = useState('')
  const [ncSchoolId, setNcSchoolId] = useState('')
  const [ncGrade,    setNcGrade]    = useState('')
  const [ncGender,   setNcGender]   = useState('')
  const [ncSaving,   setNcSaving]   = useState(false)

  // ── ステップ3: 採寸 ──────────────────────────────────────
  const [heightCm,    setHeightCm]    = useState('')
  const [weightKg,    setWeightKg]    = useState('')
  const [chestCm,     setChestCm]     = useState('')
  const [waistCm,     setWaistCm]     = useState('')
  const [inseamCm,    setInseamCm]    = useState('')
  const [showDetails, setShowDetails] = useState(false)
  const [products,    setProducts]    = useState<ProductRow[]>([])
  const [variantMap,  setVariantMap]  = useState<Record<string, VariantRow[]>>({})
  const [confirmed,   setConfirmed]   = useState<ConfirmedSizes>({})
  const [staffMemo,   setStaffMemo]   = useState('')
  const [loadingProd, setLoadingProd] = useState(false)

  // ── ステップ4: 確定後 ────────────────────────────────────
  const [saving,    setSaving]    = useState(false)
  const [savedId,   setSavedId]   = useState<string | null>(null)
  const [withOrder, setWithOrder] = useState(false)

  // 学校マスター読み込み
  useEffect(() => {
    if (!storeId) return
    supabase.from('schools').select('id, name, short_name, sort_order')
      .eq('store_id', storeId).eq('active', true).order('sort_order')
      .then(({ data }) => setSchools(data ?? []))
  }, [storeId])

  // 今日の予約を読み込む
  const loadReservations = useCallback(async () => {
    if (!storeId) return
    setLoadingRes(true)
    const jstNow  = new Date(Date.now() + 9 * 3600000)
    const today   = jstNow.toISOString().slice(0, 10)
    const { data } = await (supabase as any)
      .from('reservations')
      .select('id, reserved_at, status, purpose, line_user_id, customer_id, child_id, customers(id, name, kana, tel, line_user_id), children(id, name, school_id, school_name, gender, grade)')
      .eq('store_id', storeId)
      .gte('reserved_at', `${today}T00:00:00+09:00`)
      .lte('reserved_at', `${today}T23:59:59+09:00`)
      .in('status', ['confirmed', 'arrived'])
      .order('reserved_at')
    setReservations(data ?? [])
    setLoadingRes(false)
  }, [storeId])

  useEffect(() => { loadReservations() }, [loadReservations])

  // お客様検索
  const searchCustomers = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return }
    setSearching(true)
    const { data } = await supabase.from('customers')
      .select('id, name, kana, tel')
      .eq('store_id', storeId)
      .or(`name.ilike.%${q}%,kana.ilike.%${q}%,tel.ilike.%${q.replace(/-/g, '')}%`)
      .limit(6)
    setSearching(false)
    setResults(data ?? [])
  }, [storeId])

  useEffect(() => {
    const t = setTimeout(() => searchCustomers(query), 300)
    return () => clearTimeout(t)
  }, [query, searchCustomers])

  // お客様選択
  const selectCustomer = useCallback(async (c: CustomerRow) => {
    setCustomer(c); setChild(null); setShowAddChild(false); setLoadingChild(true)
    const { data } = await supabase.from('children').select('*')
      .eq('customer_id', c.id).order('created_at')
    setChildren(data ?? [])
    setLoadingChild(false)
  }, [])

  // お子様追加
  const addChild = async () => {
    if (!ncName.trim() || !customer) return
    setNcSaving(true)
    const schoolName = schools.find(s => s.id === ncSchoolId)?.name ?? null
    const { data, error } = await supabase.from('children').insert({
      customer_id: customer.id, store_id: storeId,
      name: ncName.trim(), kana: ncKana.trim() || null,
      school_id: ncSchoolId || null, school_name: schoolName,
      grade: ncGrade || null, gender: ncGender || null,
    }).select().single()
    setNcSaving(false)
    if (error) { showToast('err', `登録失敗: ${error.message}`); return }
    const newChild = data as ChildRow
    setChildren(prev => [...prev, newChild])
    setChild(newChild)
    setShowAddChild(false)
    setNcName(''); setNcKana(''); setNcSchoolId(''); setNcGrade(''); setNcGender('')
  }

  // 予約カードから採寸を開始
  const startFromReservation = useCallback(async (r: ReservationRow) => {
    const c = r.customers
    if (!c) { showToast('err', '顧客情報が紐付いていません'); return }

    // 顧客・LINE ID を設定
    setCustomer({ id: c.id, name: c.name, kana: c.kana, tel: c.tel })
    const lineId = c.line_user_id ?? r.line_user_id ?? null
    setLinkedLineUserId(lineId)
    setLinkedResId(r.id)

    // お子様を設定
    const resChild = r.children
    const { data: kids } = await supabase.from('children').select('*').eq('customer_id', c.id)
    setChildren((kids ?? []) as ChildRow[])

    const targetChild = resChild
      ? ((kids ?? []) as ChildRow[]).find(k => k.id === resChild.id) ?? (resChild as ChildRow)
      : (kids?.[0] as ChildRow | undefined) ?? null

    setChild(targetChild ?? null)

    // 予約ステータスを「来店済み」に更新
    await (supabase as any).from('reservations').update({ status: 'arrived' }).eq('id', r.id)
    setReservations(prev => prev.map(rv => rv.id === r.id ? { ...rv, status: 'arrived' } : rv))

    if (targetChild) {
      await goToMeasureWithChild(targetChild)
    } else {
      showToast('err', 'お子様情報が取得できませんでした。手動で選択してください')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToast])

  // 採寸ステップへ移行（child直接渡し版）
  const goToMeasureWithChild = useCallback(async (c: ChildRow) => {
    const schoolId = c.school_id
    if (!schoolId) { showToast('err', '学校が設定されていません'); return }

    setLoadingProd(true)
    const { data: prods } = await supabase.from('school_products')
      .select('id, item_name, category, gender, maker_code, sort_order')
      .eq('school_id', schoolId).eq('active', true)
      .order('sort_order').order('item_name')

    const filteredProds = (prods ?? []).filter((p: ProductRow) => {
      if (!p.gender || p.gender === '男女共通') return true
      if (c.gender === 'male'   && p.gender === '男子用') return true
      if (c.gender === 'female' && p.gender === '女子用') return true
      return !c.gender
    })

    if (filteredProds.length) {
      const ids = filteredProds.map((p: ProductRow) => p.id)
      const { data: vars } = await supabase.from('school_product_variants')
        .select('id, product_id, size_label, price, sort_order')
        .in('product_id', ids).eq('active', true).order('sort_order')
      const map: Record<string, VariantRow[]> = {}
      for (const v of (vars ?? []) as VariantRow[]) {
        if (!map[v.product_id]) map[v.product_id] = []
        map[v.product_id].push(v)
      }
      setVariantMap(map)
      const init: ConfirmedSizes = {}
      for (const p of filteredProds) init[p.id] = { variant_id: '', size_label: '', qty: 1, memo: '' }
      setConfirmed(init)
    }

    setProducts(filteredProds)
    setLoadingProd(false)
    setStep('measure')
  }, [showToast])

  // 採寸ステップへ移行
  const goToMeasure = useCallback(async () => {
    if (!child) return
    const schoolId = child.school_id
    if (!schoolId) { showToast('err', '学校が設定されていません。お子様情報を編集してください'); return }

    setLoadingProd(true)
    const { data: prods } = await supabase.from('school_products')
      .select('id, item_name, category, gender, maker_code, sort_order')
      .eq('school_id', schoolId).eq('active', true)
      .order('sort_order').order('item_name')

    const filteredProds = (prods ?? []).filter((p: ProductRow) => {
      if (!p.gender || p.gender === '男女共通') return true
      if (child.gender === 'male'   && p.gender === '男子用') return true
      if (child.gender === 'female' && p.gender === '女子用') return true
      return !child.gender
    })

    if (filteredProds.length) {
      const ids = filteredProds.map((p: ProductRow) => p.id)
      const { data: vars } = await supabase.from('school_product_variants')
        .select('id, product_id, size_label, price, sort_order')
        .in('product_id', ids).eq('active', true).order('sort_order')
      const map: Record<string, VariantRow[]> = {}
      for (const v of (vars ?? []) as VariantRow[]) {
        if (!map[v.product_id]) map[v.product_id] = []
        map[v.product_id].push(v)
      }
      setVariantMap(map)
      const init: ConfirmedSizes = {}
      for (const p of filteredProds) {
        init[p.id] = { variant_id: '', size_label: '', qty: 1, memo: '' }
      }
      setConfirmed(init)
    }

    setProducts(filteredProds)
    setLoadingProd(false)
    setStep('measure')
  }, [child, showToast])

  // 身長変更でサイズ自動推奨
  useEffect(() => {
    const h = parseFloat(heightCm)
    if (!h || !products.length) return
    setConfirmed(prev => {
      const next = { ...prev }
      for (const p of products) {
        const vars = variantMap[p.id] ?? []
        if (!vars.length) continue
        if (next[p.id]?.variant_id) continue  // 手動選択済みは上書きしない
        const rec = recommendVariant(h, vars)
        if (rec) next[p.id] = { ...next[p.id], variant_id: rec.id, size_label: rec.size_label }
      }
      return next
    })
  }, [heightCm, products, variantMap])

  // サイズ・数量・メモ操作
  const setSize = (pid: string, v: VariantRow) =>
    setConfirmed(prev => ({ ...prev, [pid]: { ...prev[pid], variant_id: v.id, size_label: v.size_label } }))
  const setQty = (pid: string, d: number) =>
    setConfirmed(prev => ({ ...prev, [pid]: { ...prev[pid], qty: Math.max(0, (prev[pid]?.qty ?? 1) + d) } }))
  const setMemo = (pid: string, m: string) =>
    setConfirmed(prev => ({ ...prev, [pid]: { ...prev[pid], memo: m } }))

  // 合計金額
  const total = useMemo(() => {
    let sum = 0
    for (const [pid, cs] of Object.entries(confirmed)) {
      if (!cs.variant_id || !cs.qty) continue
      const v = variantMap[pid]?.find(vv => vv.id === cs.variant_id)
      if (v) sum += v.price * cs.qty
    }
    return sum
  }, [confirmed, variantMap])

  // 注文アイテム（合計0件でないもの）
  const orderItems = useMemo(() =>
    Object.entries(confirmed)
      .filter(([, cs]) => cs.variant_id && cs.qty > 0)
      .map(([pid, cs]) => ({
        pid,
        product: products.find(p => p.id === pid),
        variant: variantMap[pid]?.find(v => v.id === cs.variant_id),
        cs,
      })),
    [confirmed, products, variantMap]
  )

  // 保存
  const handleSave = async (createOrder: boolean) => {
    if (!child) return
    setSaving(true); setWithOrder(createOrder)

    const { data: meas, error: measErr } = await supabase.from('measurements').insert({
      store_id: storeId,
      child_id: child.id,
      measured_date: new Date().toISOString().split('T')[0],
      height_cm:  heightCm  ? parseFloat(heightCm)  : null,
      weight_kg:  weightKg  ? parseFloat(weightKg)  : null,
      chest_cm:   chestCm   ? parseFloat(chestCm)   : null,
      waist_cm:   waistCm   ? parseFloat(waistCm)   : null,
      inseam_cm:  inseamCm  ? parseFloat(inseamCm)  : null,
      confirmed_sizes: confirmed,
      staff_memo: staffMemo || null,
      status: createOrder ? 'ordered' : 'measured',
    }).select().single()

    if (measErr || !meas) {
      setSaving(false)
      showToast('err', `保存失敗: ${measErr?.message}`)
      return
    }

    if (!createOrder) {
      if (linkedResId) {
        await (supabase as any).from('reservations').update({ status: 'completed' }).eq('id', linkedResId)
        setReservations(prev => prev.map(rv => rv.id === linkedResId ? { ...rv, status: 'completed' } : rv))
      }
      setSaving(false)
      setSavedId(meas.id)
      setStep('done')
      return
    }

    // 注文作成
    const { data: order, error: orderErr } = await (supabase as any).from('uniform_orders').insert({
      store_id: storeId,
      customer_id: customer?.id ?? null,
      child_id: child.id,
      status: 'confirmed',
      payment_status: 'unpaid',
      total_amount: total,
    }).select().single()

    if (orderErr || !order) {
      setSaving(false)
      showToast('err', `注文作成失敗: ${orderErr?.message}`)
      return
    }

    const items = orderItems.map(({ pid, product, variant, cs }) => ({
      order_id: order.id,
      store_id: storeId,
      school_product_id: pid,
      item_name: product?.item_name ?? '',
      size_label: cs.size_label,
      quantity: cs.qty,
      unit_price: variant?.price ?? null,
      notes: cs.memo || null,
      status: 'ordered',
    }))

    const { error: itemsErr } = await (supabase as any).from('uniform_order_items').insert(items)

    // measurement に order_id を紐付け
    await supabase.from('measurements').update({ order_id: order.id }).eq('id', meas.id)

    if (itemsErr) { setSaving(false); showToast('err', `明細保存失敗: ${itemsErr.message}`); return }

    if (linkedResId) {
      await (supabase as any).from('reservations').update({ status: 'completed' }).eq('id', linkedResId)
      setReservations(prev => prev.map(rv => rv.id === linkedResId ? { ...rv, status: 'completed' } : rv))
    }
    setSaving(false)
    setSavedId(meas.id)
    setStep('done')
  }

  // リセット（次のお客様）
  const reset = () => {
    setStep('customer')
    setQuery(''); setResults([]); setCustomer(null); setChildren([]); setChild(null)
    setShowAddChild(false)
    setHeightCm(''); setWeightKg(''); setChestCm(''); setWaistCm(''); setInseamCm('')
    setShowDetails(false); setProducts([]); setVariantMap({}); setConfirmed({})
    setStaffMemo(''); setSavedId(null)
    setLinkedResId(null); setLinkedLineUserId(null)
  }

  // ── カテゴリ別グループ ────────────────────────────────────
  const productsByCategory = useMemo(() => {
    const map: Record<string, ProductRow[]> = {}
    for (const p of products) {
      const cat = p.category ?? 'その他'
      if (!map[cat]) map[cat] = []
      map[cat].push(p)
    }
    return Object.entries(map)
  }, [products])

  // ============================================================
  // レンダリング
  // ============================================================
  const schoolName = child?.school_id
    ? (schools.find(s => s.id === child.school_id)?.short_name ?? schools.find(s => s.id === child.school_id)?.name ?? '')
    : (child?.school_name ?? '')

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ヘッダー */}
      <div className="bg-gradient-to-r from-teal-600 to-cyan-600 text-white px-4 py-4 sticky top-0 z-40 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <Ruler size={16} className="text-white" />
            </div>
            <div>
              <p className="text-[10px] text-teal-200 leading-none">採寸受付</p>
              <p className="text-sm font-black leading-tight">
                {step === 'customer' && 'お客様を検索'}
                {step === 'measure'  && `${child?.name} さん`}
                {step === 'confirm'  && '採寸の確認'}
                {step === 'done'     && '完了'}
              </p>
            </div>
          </div>
          <StepBar step={step} />
        </div>
      </div>

      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-5 pb-28 space-y-4">

        {/* ══════════════════════════════════════
            STEP: customer
        ══════════════════════════════════════ */}
        {step === 'customer' && (
          <>
            {/* 今日の予約パネル */}
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <button
                onClick={() => setShowResPanel(p => !p)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <CalendarClock size={16} className="text-indigo-500" />
                  <span className="text-sm font-black text-gray-800">今日の予約</span>
                  {!loadingRes && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      reservations.filter(r => r.status === 'confirmed').length > 0
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-500'
                    }`}>
                      {reservations.filter(r => r.status === 'confirmed').length}件待ち
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); loadReservations() }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-100"
                  >
                    更新
                  </button>
                  {showResPanel ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </button>

              {showResPanel && (
                <div className="border-t border-gray-100">
                  {loadingRes ? (
                    <div className="flex justify-center py-5">
                      <Loader2 size={18} className="animate-spin text-indigo-400" />
                    </div>
                  ) : reservations.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-5">今日の予約はありません</p>
                  ) : (
                    <div className="divide-y divide-gray-50">
                      {reservations.map(r => {
                        const timeStr = r.reserved_at
                          ? new Date(r.reserved_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' })
                          : ''
                        const resChild = r.children
                        const resCust  = r.customers
                        const isArrived = r.status === 'arrived'
                        return (
                          <button
                            key={r.id}
                            onClick={() => startFromReservation(r)}
                            disabled={isArrived}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                              isArrived
                                ? 'opacity-50 cursor-not-allowed bg-gray-50'
                                : 'hover:bg-indigo-50 active:bg-indigo-100'
                            }`}
                          >
                            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
                              <span className="text-xs font-black text-indigo-700">{timeStr}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">
                                {resCust?.name ?? '(顧客未紐付け)'}
                              </p>
                              {resChild && (
                                <p className="text-xs text-gray-500 truncate">
                                  {resChild.name}
                                  {resChild.school_name && ` · ${resChild.school_name}`}
                                  {resChild.grade && ` · ${resChild.grade}`}
                                </p>
                              )}
                            </div>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                              isArrived
                                ? 'bg-teal-100 text-teal-700'
                                : 'bg-indigo-100 text-indigo-700'
                            }`}>
                              {isArrived ? '来店済' : '予約済'}
                            </span>
                            {!isArrived && <ChevronRight size={14} className="text-gray-400 shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 検索 */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">お客様検索</p>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text" value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="氏名・フリガナ・電話番号"
                  className="w-full pl-9 pr-4 py-3 border border-gray-200 rounded-xl text-gray-900 text-sm bg-white focus:outline-none focus:border-teal-500"
                />
                {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
              </div>

              {results.length > 0 && !customer && (
                <div className="space-y-1">
                  {results.map(c => (
                    <button key={c.id} onClick={() => selectCustomer(c)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-teal-50 active:bg-teal-100 text-left transition-colors">
                      <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
                        <User size={15} className="text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">{c.name}</p>
                        <p className="text-xs text-gray-500">{[c.kana, c.tel].filter(Boolean).join(' · ')}</p>
                      </div>
                      <ChevronRight size={16} className="text-gray-400 shrink-0" />
                    </button>
                  ))}
                </div>
              )}

              {query.trim() && results.length === 0 && !searching && (
                <p className="text-sm text-gray-400 text-center py-2">見つかりませんでした</p>
              )}
            </div>

            {/* お客様選択済み */}
            {customer && (
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
                {/* お客様カード */}
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center shrink-0">
                    <User size={18} className="text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-gray-900">{customer.name}</p>
                    {customer.tel && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone size={11} />{customer.tel}
                      </p>
                    )}
                  </div>
                  <button onClick={() => { setCustomer(null); setChild(null); setChildren([]) }}
                    className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                    <X size={15} />
                  </button>
                </div>

                <div className="border-t border-gray-100 pt-3 space-y-2">
                  <p className="text-xs font-bold text-gray-500">お子様を選択</p>

                  {loadingChild && (
                    <div className="flex justify-center py-3">
                      <Loader2 size={18} className="animate-spin text-teal-500" />
                    </div>
                  )}

                  {!loadingChild && children.map(c => {
                    const sName = c.school_id
                      ? (schools.find(s => s.id === c.school_id)?.short_name ?? schools.find(s => s.id === c.school_id)?.name ?? c.school_name ?? '')
                      : (c.school_name ?? '')
                    const isSelected = child?.id === c.id
                    return (
                      <button key={c.id} onClick={() => setChild(isSelected ? null : c)}
                        className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 transition-colors text-left ${
                          isSelected ? 'border-teal-500 bg-teal-50' : 'border-gray-200 hover:border-teal-300 hover:bg-gray-50'
                        }`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-teal-500' : 'bg-amber-100'
                        }`}>
                          {isSelected
                            ? <Check size={15} className="text-white" />
                            : <GraduationCap size={15} className="text-amber-600" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900">{c.name}</p>
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {sName && <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-lg">{sName}</span>}
                            {c.grade && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-lg">{c.grade}</span>}
                            {c.gender && <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-lg">{c.gender === 'male' ? '男子' : '女子'}</span>}
                          </div>
                          {!c.school_id && (
                            <p className="text-[10px] text-amber-600 mt-0.5">学校未設定（採寸前に設定が必要）</p>
                          )}
                        </div>
                      </button>
                    )
                  })}

                  {/* お子様追加フォーム */}
                  {showAddChild ? (
                    <div className="border-2 border-dashed border-indigo-300 rounded-xl p-3 space-y-3 bg-indigo-50/30">
                      <p className="text-xs font-bold text-indigo-700 flex items-center gap-1.5">
                        <GraduationCap size={13} />お子様を追加
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="お名前" required>
                          <input type="text" value={ncName} onChange={e => setNcName(e.target.value)}
                            placeholder="山田 太郎" className={INPUT} />
                        </Field>
                        <Field label="フリガナ">
                          <input type="text" value={ncKana} onChange={e => setNcKana(e.target.value)}
                            placeholder="ヤマダ タロウ" className={INPUT} />
                        </Field>
                      </div>
                      <Field label="学校" required>
                        <select value={ncSchoolId} onChange={e => setNcSchoolId(e.target.value)} className={SELECT}>
                          <option value="">選択してください</option>
                          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </Field>
                      <div className="grid grid-cols-2 gap-2">
                        <Field label="学年">
                          <select value={ncGrade} onChange={e => setNcGrade(e.target.value)} className={SELECT}>
                            <option value="">選択</option>
                            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </Field>
                        <Field label="性別">
                          <select value={ncGender} onChange={e => setNcGender(e.target.value)} className={SELECT}>
                            <option value="">選択</option>
                            <option value="male">男子</option>
                            <option value="female">女子</option>
                          </select>
                        </Field>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowAddChild(false)}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold border border-gray-300 text-gray-600 hover:bg-gray-50">
                          キャンセル
                        </button>
                        <button onClick={addChild} disabled={!ncName.trim() || !ncSchoolId || ncSaving}
                          className="flex-1 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white disabled:opacity-40 flex items-center justify-center gap-1.5">
                          {ncSaving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                          追加する
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setShowAddChild(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
                      <Plus size={14} />別のお子様を追加
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 採寸へ進む */}
            {child && (
              <button
                onClick={goToMeasure}
                disabled={!child.school_id || loadingProd}
                className="w-full py-4 rounded-2xl font-black text-base bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-2"
              >
                {loadingProd
                  ? <><Loader2 size={18} className="animate-spin" />読み込み中...</>
                  : <><Ruler size={18} />{child.name} さんの採寸へ<ChevronRight size={18} /></>
                }
              </button>
            )}
          </>
        )}

        {/* ══════════════════════════════════════
            STEP: measure
        ══════════════════════════════════════ */}
        {step === 'measure' && child && (
          <>
            {/* お子様サマリー */}
            <div className="bg-teal-50 border border-teal-200 rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 bg-teal-500 rounded-full flex items-center justify-center shrink-0">
                <GraduationCap size={16} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="font-black text-teal-900 text-sm">{child.name}</p>
                <div className="flex flex-wrap gap-1 mt-0.5">
                  {schoolName && <span className="text-[10px] bg-white text-teal-700 border border-teal-300 px-1.5 py-0.5 rounded-lg">{schoolName}</span>}
                  {child.grade && <span className="text-[10px] bg-white text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded-lg">{child.grade}</span>}
                  {child.gender && <span className="text-[10px] bg-white text-blue-600 border border-blue-200 px-1.5 py-0.5 rounded-lg">{child.gender === 'male' ? '男子' : '女子'}</span>}
                </div>
              </div>
              <button onClick={() => setStep('customer')}
                className="text-xs text-teal-600 hover:text-teal-800 font-bold flex items-center gap-1">
                <ChevronLeft size={13} />戻る
              </button>
            </div>

            {/* 体型入力 */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">体型入力</p>

              {/* 身長・体重（大きめ） */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="身長 (cm)">
                  <input
                    type="number" inputMode="decimal" value={heightCm}
                    onChange={e => setHeightCm(e.target.value)}
                    placeholder="165"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-4 text-gray-900 text-2xl font-black text-center bg-white focus:outline-none focus:border-teal-500"
                  />
                </Field>
                <Field label="体重 (kg)">
                  <input
                    type="number" inputMode="decimal" value={weightKg}
                    onChange={e => setWeightKg(e.target.value)}
                    placeholder="55"
                    className="w-full border-2 border-gray-200 rounded-xl px-3 py-4 text-gray-900 text-2xl font-black text-center bg-white focus:outline-none focus:border-teal-500"
                  />
                </Field>
              </div>

              {/* 詳細寸法（展開式） */}
              <button onClick={() => setShowDetails(!showDetails)}
                className="flex items-center gap-2 text-xs font-bold text-gray-500 hover:text-gray-700">
                {showDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                詳細寸法（胸囲・胴囲・股下）
              </button>
              {showDetails && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: '胸囲 (cm)', val: chestCm,  set: setChestCm  },
                    { label: '胴囲 (cm)', val: waistCm,  set: setWaistCm  },
                    { label: '股下 (cm)', val: inseamCm, set: setInseamCm },
                  ].map(({ label, val, set }) => (
                    <Field key={label} label={label}>
                      <input type="number" inputMode="decimal" value={val}
                        onChange={e => set(e.target.value)}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm text-center bg-white focus:outline-none focus:border-teal-500" />
                    </Field>
                  ))}
                </div>
              )}
            </div>

            {/* 商品ごとのサイズ選択 */}
            {products.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
                <AlertCircle size={24} className="text-amber-400 mx-auto mb-2" />
                <p className="text-sm text-gray-500">この学校の商品が登録されていません</p>
                <p className="text-xs text-gray-400 mt-1">マスター管理から商品を追加してください</p>
              </div>
            ) : (
              productsByCategory.map(([cat, catProds]) => (
                <div key={cat} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                    <p className="text-xs font-black text-gray-600 uppercase tracking-wide">{cat}</p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {catProds.map(p => {
                      const pvars    = variantMap[p.id] ?? []
                      const cs       = confirmed[p.id]
                      const recVar   = heightCm ? recommendVariant(parseFloat(heightCm), pvars) : null
                      const skipItem = cs?.qty === 0

                      return (
                        <div key={p.id} className={`px-4 py-3 space-y-2.5 ${skipItem ? 'opacity-40' : ''}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{p.item_name}</p>
                              <div className="flex gap-1 mt-0.5">
                                {p.maker_code && <span className="text-[10px] font-mono text-gray-400">品番: {p.maker_code}</span>}
                              </div>
                            </div>
                            <button
                              onClick={() => setQty(p.id, skipItem ? 1 : -(cs?.qty ?? 1))}
                              className={`text-[10px] font-bold px-2 py-1 rounded-lg border transition-colors ${
                                skipItem
                                  ? 'border-teal-400 text-teal-600 bg-teal-50'
                                  : 'border-gray-300 text-gray-500 hover:border-red-300 hover:text-red-500'
                              }`}
                            >
                              {skipItem ? '+ 含める' : 'スキップ'}
                            </button>
                          </div>

                          {/* サイズボタン */}
                          {pvars.length > 0 ? (
                            <div className="flex flex-wrap gap-1.5">
                              {pvars.map(v => {
                                const isSelected = cs?.variant_id === v.id
                                const isRec      = recVar?.id === v.id && !cs?.variant_id
                                return (
                                  <button
                                    key={v.id}
                                    onClick={() => setSize(p.id, v)}
                                    disabled={skipItem}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 transition-all disabled:cursor-not-allowed ${
                                      isSelected
                                        ? 'bg-teal-500 border-teal-500 text-white shadow-sm'
                                        : isRec
                                          ? 'bg-teal-50 border-teal-400 text-teal-700 animate-pulse'
                                          : 'bg-white border-gray-200 text-gray-700 hover:border-teal-300'
                                    }`}
                                  >
                                    {v.size_label}
                                    {v.price > 0 && <span className="ml-1 text-[9px] opacity-70">¥{v.price.toLocaleString()}</span>}
                                  </button>
                                )
                              })}
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">サイズが登録されていません</p>
                          )}

                          {/* 数量・メモ */}
                          {!skipItem && (
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-2 py-1">
                                <button onClick={() => setQty(p.id, -1)} disabled={(cs?.qty ?? 1) <= 1}
                                  className="w-7 h-7 rounded-lg bg-white shadow-sm border border-gray-200 flex items-center justify-center text-gray-600 disabled:opacity-30">
                                  <Minus size={13} />
                                </button>
                                <span className="w-6 text-center text-sm font-black text-gray-900">{cs?.qty ?? 1}</span>
                                <button onClick={() => setQty(p.id, 1)}
                                  className="w-7 h-7 rounded-lg bg-white shadow-sm border border-gray-200 flex items-center justify-center text-gray-600">
                                  <Plus size={13} />
                                </button>
                                <span className="text-xs text-gray-500 ml-1">枚</span>
                              </div>
                              <input
                                type="text" value={cs?.memo ?? ''} onChange={e => setMemo(p.id, e.target.value)}
                                placeholder="備考（丈詰め予定など）"
                                className="flex-1 border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-gray-700 bg-white focus:outline-none focus:border-teal-400"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}

            {/* スタッフメモ */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <Field label="スタッフメモ">
                <textarea value={staffMemo} onChange={e => setStaffMemo(e.target.value)}
                  placeholder="試着時の気づき、お直し予定など"
                  rows={2}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm bg-white focus:outline-none focus:border-teal-500 resize-none" />
              </Field>
            </div>

            {/* 合計・保存ボタン */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3 sticky bottom-20 sm:static border border-gray-200">
              {total > 0 && (
                <div className="flex justify-between items-center py-1">
                  <span className="text-sm font-bold text-gray-600">合計（{orderItems.length}点）</span>
                  <span className="text-xl font-black text-gray-900">¥{total.toLocaleString()}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => handleSave(false)} disabled={saving}
                  className="py-3.5 rounded-xl font-bold text-sm border-2 border-gray-300 text-gray-700 hover:bg-gray-50 active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5">
                  {saving && !withOrder ? <Loader2 size={14} className="animate-spin" /> : null}
                  採寸記録のみ保存
                </button>
                <button onClick={() => handleSave(true)} disabled={saving || orderItems.length === 0}
                  className="py-3.5 rounded-xl font-black text-sm bg-gradient-to-r from-teal-500 to-cyan-500 text-white active:scale-95 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5 shadow-md">
                  {saving && withOrder ? <Loader2 size={14} className="animate-spin" /> : <Check size={16} />}
                  注文も確定する
                </button>
              </div>
            </div>
          </>
        )}

        {/* ══════════════════════════════════════
            STEP: done
        ══════════════════════════════════════ */}
        {step === 'done' && child && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl shadow-sm p-6 text-center space-y-3">
              <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto">
                <Check size={32} className="text-teal-600" />
              </div>
              <div>
                <p className="text-lg font-black text-gray-900">採寸完了</p>
                <p className="text-sm text-gray-600 mt-1">
                  {child.name} さん ({schoolName})
                </p>
                {withOrder && <p className="text-xs text-teal-600 font-bold mt-1">注文も作成しました</p>}
              </div>
              {total > 0 && withOrder && (
                <div className="bg-gray-50 rounded-xl px-4 py-3">
                  <p className="text-xs text-gray-500 mb-2">注文内容</p>
                  {orderItems.map(({ product, cs }) => (
                    <div key={cs.variant_id} className="flex justify-between text-xs text-gray-700 py-0.5">
                      <span>{product?.item_name} {cs.size_label} × {cs.qty}</span>
                      <span className="font-bold">
                        ¥{((variantMap[product?.id ?? '']?.find(v => v.id === cs.variant_id)?.price ?? 0) * cs.qty).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  <div className="border-t border-gray-200 mt-2 pt-2 flex justify-between font-black text-gray-900 text-sm">
                    <span>合計</span>
                    <span>¥{total.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            {linkedLineUserId && (
              <button
                onClick={async () => {
                  setNotifySending(true)
                  try {
                    const fullSchoolName = child.school_id
                      ? (schools.find(s => s.id === child.school_id)?.name ?? child.school_name ?? '')
                      : (child.school_name ?? '')
                    await fetch('/api/notify-fitting', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        storeId,
                        lineUserId: linkedLineUserId,
                        childName:  child.name,
                        schoolName: fullSchoolName,
                        items: orderItems.map(({ product, cs, variant }) => ({
                          item_name:  product?.item_name ?? '',
                          size_label: cs.size_label,
                          qty:        cs.qty,
                          price:      variant?.price ?? 0,
                        })),
                        totalAmount: total,
                      }),
                    })
                    showToast('ok', 'LINE通知を送りました')
                  } catch {
                    showToast('err', 'LINE通知の送信に失敗しました')
                  } finally {
                    setNotifySending(false)
                  }
                }}
                disabled={notifySending}
                className="w-full py-3.5 rounded-2xl font-black text-base bg-green-500 text-white shadow active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {notifySending
                  ? <Loader2 size={18} className="animate-spin" />
                  : <Send size={18} />
                }
                LINE通知を送る
              </button>
            )}

            <button onClick={reset}
              className="w-full py-4 rounded-2xl font-black text-base bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
              <RotateCcw size={18} />次のお客様へ
            </button>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

export default function FittingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 size={24} className="animate-spin text-teal-500" /></div>}>
      <FittingPageInner />
    </Suspense>
  )
}
