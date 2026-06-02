'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, Plus, Pencil, Trash2,
  GraduationCap, Package, Tag, Loader2, X, AlertCircle, Users, UserCircle, Scissors, QrCode,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { School, SchoolProduct, SchoolProductVariant, Staff } from '@/types/master'
import {
  PRODUCT_CATEGORY_OPTIONS, PRODUCT_GENDER_OPTIONS,
  STAFF_ROLE_OPTIONS, STAFF_COLOR_OPTIONS,
} from '@/types/master'
import { REPAIR_TYPE_LABELS, REPAIR_TYPE_ICONS } from '@/types/crm'
import type { RepairType } from '@/types/crm'

// ── 型 ────────────────────────────────────────────────────────
type MasterTab  = 'schools' | 'staff' | 'presets'
type SchoolView = 'schools' | 'products' | 'variants'

interface RepairItemCategory {
  id: string; store_id: string; name: string; sort_order: number; is_active: boolean
}

interface RepairPreset {
  id: string; store_id: string; school_name: string | null
  item_name: string; repair_type: string; category_id: string | null
  default_price: number | null; notes: string | null
  sort_order: number; is_active: boolean
}

// ── Toast ─────────────────────────────────────────────────────
function Toast({ msg, type, onClose }: { msg: string; type: 'ok' | 'err'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-5 py-3 rounded-2xl text-white text-sm font-bold shadow-2xl max-w-xs text-center ${
      type === 'err' ? 'bg-red-600' : 'bg-gray-900 border border-gray-700'
    }`}>{msg}</div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

// ── 色サークル ────────────────────────────────────────────────
function ColorDot({ color, size = 16 }: { color: string; size?: number }) {
  return <div style={{ width: size, height: size, backgroundColor: color }} className="rounded-full shrink-0 border border-white shadow-sm" />
}

// ============================================================
// Inner component（useSearchParams を使うため Suspense 内で呼ぶ）
// ============================================================
function MasterPageInner() {
  const params       = useParams<{ storeId: string }>()
  const storeId      = params?.storeId ?? ''
  const router       = useRouter()
  const searchParams = useSearchParams()

  // ── Tab ──────────────────────────────────────────────────
  const initialTab = (searchParams?.get('tab') ?? 'schools') as MasterTab
  const [masterTab, setMasterTab] = useState<MasterTab>(initialTab)

  // ── School/Product/Variant state ──────────────────────────
  const [schoolView,      setSchoolView]      = useState<SchoolView>('schools')
  const [schools,         setSchools]         = useState<School[]>([])
  const [selectedSchool,  setSelectedSchool]  = useState<School | null>(null)
  const [products,        setProducts]        = useState<SchoolProduct[]>([])
  const [selectedProduct, setSelectedProduct] = useState<SchoolProduct | null>(null)
  const [variants,        setVariants]        = useState<SchoolProductVariant[]>([])

  // ── Staff state ───────────────────────────────────────────
  const [staffList,            setStaffList]            = useState<Staff[]>([])
  const [staffLoading,         setStaffLoading]         = useState(false)
  const [staffModal,           setStaffModal]           = useState(false)
  const [editingStaff,         setEditingStaff]         = useState<Staff | null>(null)
  const [sfName,               setSfName]               = useState('')
  const [sfKana,               setSfKana]               = useState('')
  const [sfRole,               setSfRole]               = useState('')
  const [sfColor,              setSfColor]              = useState(STAFF_COLOR_OPTIONS[0])
  const [sfPin,                setSfPin]                = useState('')
  const [sfSaving,             setSfSaving]             = useState(false)
  const [deleteStaffTarget,    setDeleteStaffTarget]    = useState<Staff | null>(null)
  const [deleteStaffLoading,   setDeleteStaffLoading]   = useState(false)

  // ── Repair item categories state ─────────────────────────
  const [categories,      setCategories]      = useState<RepairItemCategory[]>([])
  const [catModal,        setCatModal]        = useState(false)
  const [editingCat,      setEditingCat]      = useState<RepairItemCategory | null>(null)
  const [catName,         setCatName]         = useState('')
  const [catSaving,       setCatSaving]       = useState(false)

  // ── Repair presets state ─────────────────────────────────
  const [presets,         setPresets]         = useState<RepairPreset[]>([])
  const [presetsLoading,  setPresetsLoading]  = useState(false)
  const [presetModal,     setPresetModal]     = useState(false)
  const [editingPreset,   setEditingPreset]   = useState<RepairPreset | null>(null)
  const [ppItemName,      setPpItemName]      = useState('')
  const [ppRepairType,    setPpRepairType]    = useState<RepairType>('hem')
  const [ppSchoolName,    setPpSchoolName]    = useState('')
  const [ppPrice,         setPpPrice]        = useState('')
  const [ppNotes,         setPpNotes]        = useState('')
  const [ppCategoryId,    setPpCategoryId]   = useState<string | null>(null)
  const [ppSaving,        setPpSaving]       = useState(false)

  // ── LINE公式アカウント ────────────────────────────────────
  const [lineOfficialId,  setLineOfficialId]  = useState('')
  const [lineIdSaving,    setLineIdSaving]    = useState(false)

  // ── Shared loading / toast ────────────────────────────────
  const [loading,    setLoading]    = useState(true)
  const [subLoading, setSubLoading] = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // ── School form state ─────────────────────────────────────
  const [schoolModal,          setSchoolModal]          = useState(false)
  const [editingSchool,        setEditingSchool]        = useState<School | null>(null)
  const [sName,                setSName]                = useState('')
  const [sShort,               setSShort]               = useState('')
  const [schoolSaving,         setSchoolSaving]         = useState(false)
  const [deleteSchoolTarget,   setDeleteSchoolTarget]   = useState<School | null>(null)
  const [deleteSchoolLoading,  setDeleteSchoolLoading]  = useState(false)

  // ── Product form state ────────────────────────────────────
  const [productModal,         setProductModal]         = useState(false)
  const [editingProduct,       setEditingProduct]       = useState<SchoolProduct | null>(null)
  const [pName,                setPName]                = useState('')
  const [pMaker,               setPMaker]               = useState('')
  const [pColor,               setPColor]               = useState('')
  const [pCategory,            setPCategory]            = useState('')
  const [pGender,              setPGender]              = useState('')
  const [pNotes,               setPNotes]               = useState('')
  const [productSaving,        setProductSaving]        = useState(false)
  const [deleteProductTarget,  setDeleteProductTarget]  = useState<SchoolProduct | null>(null)
  const [deleteProductLoading, setDeleteProductLoading] = useState(false)

  // ── Variant form state ────────────────────────────────────
  const [variantModal,         setVariantModal]         = useState(false)
  const [editingVariant,       setEditingVariant]       = useState<SchoolProductVariant | null>(null)
  const [vSize,                setVSize]                = useState('')
  const [vPrice,               setVPrice]               = useState('')
  const [vCost,                setVCost]                = useState('')
  const [vStock,               setVStock]               = useState('0')
  const [variantSaving,        setVariantSaving]        = useState(false)
  const [deleteVariantTarget,  setDeleteVariantTarget]  = useState<SchoolProductVariant | null>(null)
  const [deleteVariantLoading, setDeleteVariantLoading] = useState(false)

  const showToast = useCallback((type: 'ok' | 'err', msg: string) => setToast({ type, msg }), [])

  // ── Fetch ─────────────────────────────────────────────────
  const fetchSchools = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const { data, error } = await (supabase as any)
      .from('schools').select('*').eq('store_id', storeId)
      .order('sort_order').order('name')
    setLoading(false)
    if (error) { showToast('err', `学校取得失敗: ${error.message}`); return }
    setSchools(data ?? [])
  }, [storeId, showToast])

  const fetchProducts = useCallback(async (schoolId: string) => {
    setSubLoading(true)
    const { data, error } = await (supabase as any)
      .from('school_products').select('*').eq('school_id', schoolId)
      .order('sort_order').order('item_name')
    setSubLoading(false)
    if (error) { showToast('err', `商品取得失敗: ${error.message}`); return }
    setProducts(data ?? [])
  }, [showToast])

  const fetchVariants = useCallback(async (productId: string) => {
    setSubLoading(true)
    const { data, error } = await (supabase as any)
      .from('school_product_variants').select('*').eq('product_id', productId)
      .order('sort_order').order('size_label')
    setSubLoading(false)
    if (error) { showToast('err', `バリエーション取得失敗: ${error.message}`); return }
    setVariants(data ?? [])
  }, [showToast])

  const fetchStaff = useCallback(async () => {
    if (!storeId) return
    setStaffLoading(true)
    const { data, error } = await (supabase as any)
      .from('staff').select('*').eq('store_id', storeId)
      .order('sort_order').order('name')
    setStaffLoading(false)
    if (error) { showToast('err', `スタッフ取得失敗: ${error.message}`); return }
    setStaffList(data ?? [])
  }, [storeId, showToast])

  useEffect(() => {
    fetchSchools()
    fetchStaff()
  }, [fetchSchools, fetchStaff])

  // stores.school_names と同期
  const syncSchoolNames = useCallback(async (list: School[]) => {
    const names = list.filter(s => s.active).map(s => s.name)
    await (supabase as any).from('stores').update({ school_names: names }).eq('id', storeId)
  }, [storeId])

  // ── Repair item categories ────────────────────────────────
  const fetchCategories = useCallback(async () => {
    const { data } = await (supabase as any).from('repair_item_categories')
      .select('*').eq('store_id', storeId).order('sort_order').order('name')
    setCategories(data ?? [])
  }, [storeId])

  const openCatModal = (cat?: RepairItemCategory) => {
    setEditingCat(cat ?? null); setCatName(cat?.name ?? ''); setCatModal(true)
  }
  const handleCatSave = async () => {
    if (!catName.trim()) return
    setCatSaving(true)
    if (editingCat) {
      await (supabase as any).from('repair_item_categories').update({ name: catName.trim(), updated_at: new Date().toISOString() }).eq('id', editingCat.id)
    } else {
      await (supabase as any).from('repair_item_categories').insert({ store_id: storeId, name: catName.trim(), sort_order: categories.length })
    }
    setCatSaving(false); setCatModal(false); fetchCategories()
  }
  const handleCatDelete = async (id: string) => {
    await (supabase as any).from('repair_item_categories').delete().eq('id', id)
    fetchCategories()
  }

  // ── LINE公式アカウントID ──────────────────────────────────
  const fetchLineOfficialId = useCallback(async () => {
    const { data } = await (supabase as any).from('stores').select('line_official_id').eq('id', storeId).single()
    setLineOfficialId(data?.line_official_id ?? '')
  }, [storeId])

  const saveLineOfficialId = async () => {
    setLineIdSaving(true)
    await (supabase as any).from('stores').update({ line_official_id: lineOfficialId.trim() || null }).eq('id', storeId)
    setLineIdSaving(false)
    setToast({ msg: 'LINE公式アカウントIDを保存しました', type: 'ok' })
  }

  // ── Repair presets ───────────────────────────────────────
  const fetchPresets = useCallback(async () => {
    setPresetsLoading(true)
    const { data } = await (supabase as any).from('repair_price_presets')
      .select('*').eq('store_id', storeId).order('repair_type').order('sort_order')
    setPresets(data ?? [])
    setPresetsLoading(false)
  }, [storeId])

  const openPresetModal = (preset?: RepairPreset) => {
    setEditingPreset(preset ?? null)
    setPpItemName(preset?.item_name ?? '')
    setPpRepairType((preset?.repair_type ?? 'hem') as RepairType)
    setPpSchoolName(preset?.school_name ?? '')
    setPpPrice(preset?.default_price != null ? String(preset.default_price) : '')
    setPpNotes(preset?.notes ?? '')
    setPpCategoryId(preset?.category_id ?? null)
    setPresetModal(true)
  }

  const handlePresetSave = async () => {
    if (!ppItemName.trim()) return
    setPpSaving(true)
    const payload = {
      store_id: storeId, item_name: ppItemName.trim(),
      repair_type: ppRepairType, school_name: ppSchoolName.trim() || null,
      default_price: ppPrice ? parseInt(ppPrice) : null,
      notes: ppNotes.trim() || null,
      category_id: ppCategoryId || null,
    }
    if (editingPreset) {
      await (supabase as any).from('repair_price_presets').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingPreset.id)
    } else {
      await (supabase as any).from('repair_price_presets').insert(payload)
    }
    setPpSaving(false); setPresetModal(false)
    fetchPresets()
    setToast({ msg: editingPreset ? 'プリセットを更新しました' : 'プリセットを追加しました', type: 'ok' })
  }

  const handlePresetDelete = async (id: string) => {
    await (supabase as any).from('repair_price_presets').delete().eq('id', id)
    fetchPresets()
    setToast({ msg: 'プリセットを削除しました', type: 'ok' })
  }

  // ── Tab 切替 ──────────────────────────────────────────────
  const switchTab = (tab: MasterTab) => {
    setMasterTab(tab)
    if (tab === 'schools') { setSchoolView('schools'); setSelectedSchool(null); setSelectedProduct(null) }
    if (tab === 'presets') { fetchPresets(); fetchCategories(); fetchLineOfficialId() }
  }

  // ── Navigation (school drill-down) ───────────────────────
  const goToProducts = async (school: School) => {
    setSelectedSchool(school); setProducts([]); setSchoolView('products')
    await fetchProducts(school.id)
  }
  const goToVariants = async (product: SchoolProduct) => {
    setSelectedProduct(product); setVariants([]); setSchoolView('variants')
    await fetchVariants(product.id)
  }
  const goBack = () => {
    if (masterTab === 'staff') { router.back() }
    else if (schoolView === 'variants') { setSchoolView('products'); setSelectedProduct(null) }
    else if (schoolView === 'products') { setSchoolView('schools'); setSelectedSchool(null) }
    else router.back()
  }

  // ── School CRUD ───────────────────────────────────────────
  const openSchoolAdd  = () => { setEditingSchool(null); setSName(''); setSShort(''); setSchoolModal(true) }
  const openSchoolEdit = (s: School) => { setEditingSchool(s); setSName(s.name); setSShort(s.short_name ?? ''); setSchoolModal(true) }

  const handleSchoolSave = async () => {
    if (!sName.trim()) return
    setSchoolSaving(true)
    const payload = { name: sName.trim(), short_name: sShort.trim() || null, updated_at: new Date().toISOString() }
    if (editingSchool) {
      const { data, error } = await (supabase as any).from('schools').update(payload).eq('id', editingSchool.id).select().single()
      setSchoolSaving(false)
      if (error) { showToast('err', '更新失敗'); return }
      const updated = schools.map(s => s.id === editingSchool.id ? data as School : s)
      setSchools(updated)
      if (selectedSchool?.id === editingSchool.id) setSelectedSchool(data as School)
      await syncSchoolNames(updated)
      showToast('ok', '学校を更新しました')
    } else {
      const { data, error } = await (supabase as any).from('schools')
        .insert({ ...payload, store_id: storeId, sort_order: schools.length }).select().single()
      setSchoolSaving(false)
      if (error) { showToast('err', '追加失敗'); return }
      const updated = [...schools, data as School]
      setSchools(updated)
      await syncSchoolNames(updated)
      showToast('ok', '学校を追加しました')
    }
    setSchoolModal(false)
  }

  const handleSchoolDelete = async () => {
    if (!deleteSchoolTarget) return
    setDeleteSchoolLoading(true)
    const { error } = await (supabase as any).from('schools').delete().eq('id', deleteSchoolTarget.id)
    setDeleteSchoolLoading(false)
    if (error) { showToast('err', '削除失敗'); return }
    const updated = schools.filter(s => s.id !== deleteSchoolTarget.id)
    setSchools(updated)
    if (selectedSchool?.id === deleteSchoolTarget.id) { setSelectedSchool(null); setSchoolView('schools') }
    await syncSchoolNames(updated)
    showToast('ok', '学校を削除しました')
    setDeleteSchoolTarget(null)
  }

  // ── Product CRUD ──────────────────────────────────────────
  const openProductAdd  = () => { setEditingProduct(null); setPName(''); setPMaker(''); setPColor(''); setPCategory(''); setPGender(''); setPNotes(''); setProductModal(true) }
  const openProductEdit = (p: SchoolProduct) => { setEditingProduct(p); setPName(p.item_name); setPMaker(p.maker_code ?? ''); setPColor(p.color_code ?? ''); setPCategory(p.category ?? ''); setPGender(p.gender ?? ''); setPNotes(p.notes ?? ''); setProductModal(true) }

  const handleProductSave = async () => {
    if (!pName.trim() || !selectedSchool) return
    setProductSaving(true)
    const payload = { item_name: pName.trim(), maker_code: pMaker.trim() || null, color_code: pColor.trim() || null, category: pCategory || null, gender: pGender || null, notes: pNotes.trim() || null, updated_at: new Date().toISOString() }
    if (editingProduct) {
      const { data, error } = await (supabase as any).from('school_products').update(payload).eq('id', editingProduct.id).select().single()
      setProductSaving(false)
      if (error) { showToast('err', '更新失敗'); return }
      setProducts(prev => prev.map(p => p.id === editingProduct.id ? data as SchoolProduct : p))
      if (selectedProduct?.id === editingProduct.id) setSelectedProduct(data as SchoolProduct)
      showToast('ok', '商品を更新しました')
    } else {
      const { data, error } = await (supabase as any).from('school_products')
        .insert({ ...payload, store_id: storeId, school_id: selectedSchool.id, sort_order: products.length }).select().single()
      setProductSaving(false)
      if (error) { showToast('err', '追加失敗'); return }
      setProducts(prev => [...prev, data as SchoolProduct])
      showToast('ok', '商品を追加しました')
    }
    setProductModal(false)
  }

  const handleProductDelete = async () => {
    if (!deleteProductTarget) return
    setDeleteProductLoading(true)
    const { error } = await (supabase as any).from('school_products').delete().eq('id', deleteProductTarget.id)
    setDeleteProductLoading(false)
    if (error) { showToast('err', '削除失敗'); return }
    setProducts(prev => prev.filter(p => p.id !== deleteProductTarget.id))
    if (selectedProduct?.id === deleteProductTarget.id) { setSelectedProduct(null); setSchoolView('products') }
    showToast('ok', '商品を削除しました')
    setDeleteProductTarget(null)
  }

  // ── Variant CRUD ──────────────────────────────────────────
  const openVariantAdd  = () => { setEditingVariant(null); setVSize(''); setVPrice(''); setVCost(''); setVStock('0'); setVariantModal(true) }
  const openVariantEdit = (v: SchoolProductVariant) => { setEditingVariant(v); setVSize(v.size_label); setVPrice(String(v.price)); setVCost(v.cost != null ? String(v.cost) : ''); setVStock(String(v.stock)); setVariantModal(true) }

  const handleVariantSave = async () => {
    if (!vSize.trim() || !selectedProduct) return
    setVariantSaving(true)
    const payload = { size_label: vSize.trim(), price: vPrice ? Number(vPrice) : 0, cost: vCost ? Number(vCost) : null, stock: vStock ? Number(vStock) : 0, updated_at: new Date().toISOString() }
    if (editingVariant) {
      const { data, error } = await (supabase as any).from('school_product_variants').update(payload).eq('id', editingVariant.id).select().single()
      setVariantSaving(false)
      if (error) { showToast('err', '更新失敗'); return }
      setVariants(prev => prev.map(v => v.id === editingVariant.id ? data as SchoolProductVariant : v))
      showToast('ok', 'バリエーションを更新しました')
    } else {
      const { data, error } = await (supabase as any).from('school_product_variants')
        .insert({ ...payload, product_id: selectedProduct.id, store_id: storeId, sort_order: variants.length }).select().single()
      setVariantSaving(false)
      if (error) { showToast('err', '追加失敗'); return }
      setVariants(prev => [...prev, data as SchoolProductVariant])
      showToast('ok', 'バリエーションを追加しました')
    }
    setVariantModal(false)
  }

  const handleVariantDelete = async () => {
    if (!deleteVariantTarget) return
    setDeleteVariantLoading(true)
    const { error } = await (supabase as any).from('school_product_variants').delete().eq('id', deleteVariantTarget.id)
    setDeleteVariantLoading(false)
    if (error) { showToast('err', '削除失敗'); return }
    setVariants(prev => prev.filter(v => v.id !== deleteVariantTarget.id))
    showToast('ok', '削除しました')
    setDeleteVariantTarget(null)
  }

  // ── Staff CRUD ────────────────────────────────────────────
  const openStaffAdd  = () => { setEditingStaff(null); setSfName(''); setSfKana(''); setSfRole(''); setSfColor(STAFF_COLOR_OPTIONS[0]); setSfPin(''); setStaffModal(true) }
  const openStaffEdit = (s: Staff) => { setEditingStaff(s); setSfName(s.name); setSfKana(s.kana ?? ''); setSfRole(s.role ?? ''); setSfColor(s.color ?? STAFF_COLOR_OPTIONS[0]); setSfPin(s.pin ?? ''); setStaffModal(true) }

  const handleStaffSave = async () => {
    if (!sfName.trim()) return
    setSfSaving(true)
    const payload = { name: sfName.trim(), kana: sfKana.trim() || null, role: sfRole || null, color: sfColor, pin: sfPin.trim() || null, updated_at: new Date().toISOString() }
    if (editingStaff) {
      const { data, error } = await (supabase as any).from('staff').update(payload).eq('id', editingStaff.id).select().single()
      setSfSaving(false)
      if (error) { showToast('err', '更新失敗'); return }
      setStaffList(prev => prev.map(s => s.id === editingStaff.id ? data as Staff : s))
      showToast('ok', 'スタッフを更新しました')
    } else {
      const { data, error } = await (supabase as any).from('staff')
        .insert({ ...payload, store_id: storeId, sort_order: staffList.length }).select().single()
      setSfSaving(false)
      if (error) { showToast('err', '追加失敗'); return }
      setStaffList(prev => [...prev, data as Staff])
      showToast('ok', 'スタッフを追加しました')
    }
    setStaffModal(false)
  }

  const handleStaffDelete = async () => {
    if (!deleteStaffTarget) return
    setDeleteStaffLoading(true)
    const { error } = await (supabase as any).from('staff').delete().eq('id', deleteStaffTarget.id)
    setDeleteStaffLoading(false)
    if (error) { showToast('err', '削除失敗'); return }
    setStaffList(prev => prev.filter(s => s.id !== deleteStaffTarget.id))
    showToast('ok', 'スタッフを削除しました')
    setDeleteStaffTarget(null)
  }

  // ── Header gradient ───────────────────────────────────────
  const headerGrad = masterTab === 'staff' ? 'from-emerald-700 to-teal-700'
    : masterTab === 'presets' ? 'from-amber-600 to-orange-600'
    : schoolView === 'products' ? 'from-teal-700 to-emerald-700'
    : schoolView === 'variants' ? 'from-amber-600 to-orange-600'
    : 'from-indigo-700 to-violet-700'

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Header ───────────────────────────────────────── */}
      <div className={`sticky top-0 z-20 bg-gradient-to-r ${headerGrad} shadow-lg`}>
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2 max-w-lg mx-auto">
          <button onClick={goBack} className="p-1 -ml-1 text-white/80 hover:text-white active:scale-90 transition-all">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            {masterTab === 'staff' && <h1 className="text-white font-black text-base">スタッフマスタ</h1>}
            {masterTab === 'presets' && <h1 className="text-white font-black text-base">✂️ お直し料金マスタ</h1>}
            {masterTab === 'schools' && schoolView === 'schools' && <h1 className="text-white font-black text-base">学校・商品マスタ</h1>}
            {masterTab === 'schools' && schoolView === 'products' && (
              <>
                <p className="text-white/60 text-[10px] font-bold truncate leading-tight">{selectedSchool?.name}</p>
                <h1 className="text-white font-black text-base leading-tight">商品マスタ</h1>
              </>
            )}
            {masterTab === 'schools' && schoolView === 'variants' && (
              <>
                <p className="text-white/60 text-[10px] font-bold truncate leading-tight">
                  {selectedSchool?.short_name ?? selectedSchool?.name} / {selectedProduct?.item_name}
                </p>
                <h1 className="text-white font-black text-base leading-tight">サイズ・価格マスタ</h1>
              </>
            )}
          </div>
          {masterTab === 'schools' && (
            <div className="flex items-center gap-0.5 text-[10px] shrink-0">
              <span className={schoolView === 'schools'  ? 'text-white font-black' : 'text-white/40'}>学校</span>
              <ChevronRight size={9} className="text-white/30" />
              <span className={schoolView === 'products' ? 'text-white font-black' : 'text-white/40'}>商品</span>
              <ChevronRight size={9} className="text-white/30" />
              <span className={schoolView === 'variants' ? 'text-white font-black' : 'text-white/40'}>価格</span>
            </div>
          )}
        </div>
        {/* タブ切替バー */}
        <div className="flex gap-1 mx-4 mb-2.5 bg-white/10 rounded-xl p-1">
          <button onClick={() => switchTab('schools')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              masterTab === 'schools' ? 'bg-white text-indigo-700 shadow-sm' : 'text-white/70 hover:text-white'
            }`}>
            <GraduationCap size={13} />学校・商品
          </button>
          <button onClick={() => switchTab('presets')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              masterTab === 'presets' ? 'bg-white text-amber-700 shadow-sm' : 'text-white/70 hover:text-white'
            }`}>
            <Scissors size={13} />お直し料金
          </button>
          <button onClick={() => switchTab('staff')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold transition-all ${
              masterTab === 'staff' ? 'bg-white text-emerald-700 shadow-sm' : 'text-white/70 hover:text-white'
            }`}>
            <Users size={13} />スタッフ
          </button>
        </div>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">

        {/* ================================================================
            お直し料金プリセット
        ================================================================ */}
        {masterTab === 'presets' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">お直し受付時にワンタップで品名・金額を入力できます</p>
            </div>

            {/* ── LINE友達登録QRコード ─────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                <QrCode size={15} className="text-green-600" />
                <p className="text-sm font-black text-gray-800">LINE友達登録QR</p>
              </div>
              <div className="px-4 py-4 space-y-3">
                {lineOfficialId ? (
                  <div className="flex items-start gap-4">
                    <img
                      src={`https://qr-official.line.me/gs/M_${lineOfficialId.replace('@', '')}_BW.png`}
                      alt="LINE友達登録QR"
                      className="w-28 h-28 rounded-xl border border-gray-200 shadow-sm shrink-0"
                      onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-gray-700 mb-1">公式アカウントID</p>
                      <p className="text-sm font-mono text-green-700 font-bold">{lineOfficialId}</p>
                      <p className="text-[10px] text-gray-400 mt-2 leading-relaxed">このQRをお客様に見せると<br />LINEで友達登録できます</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">LINE公式アカウントIDを設定するとQRが表示されます</p>
                )}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-500 block mb-1">LINE公式アカウントID（例: @abc1234d）</label>
                    <input type="text" value={lineOfficialId} onChange={e => setLineOfficialId(e.target.value)}
                      placeholder="@xxxxxxxxx"
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-green-500 bg-white" />
                  </div>
                  <button onClick={saveLineOfficialId} disabled={lineIdSaving}
                    className="px-4 py-2 rounded-xl bg-green-600 text-white text-xs font-bold flex items-center gap-1 disabled:opacity-50 active:scale-95 transition-all shrink-0">
                    {lineIdSaving ? <Loader2 size={12} className="animate-spin" /> : '保存'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── アイテムカテゴリ管理 ──────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-black text-gray-800 flex items-center gap-2"><Scissors size={14} className="text-amber-500" />品名カテゴリ</p>
                <button onClick={() => openCatModal()}
                  className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-800 px-2 py-1 rounded-lg hover:bg-amber-50 transition-all">
                  <Plus size={11} />追加
                </button>
              </div>
              {categories.length === 0 ? (
                <p className="text-xs text-gray-400 px-4 py-3">カテゴリ未登録（例：詰め襟・ブレザー・スラックス）</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center gap-3 px-4 py-2.5">
                      <p className="flex-1 text-sm font-bold text-gray-800">{cat.name}</p>
                      <button onClick={() => openCatModal(cat)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"><Pencil size={12} /></button>
                      <button onClick={() => handleCatDelete(cat.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── カテゴリ追加/編集モーダル ─────────────────────── */}
            {catModal && (
              <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4">
                <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-gray-900">{editingCat ? 'カテゴリを編集' : 'カテゴリを追加'}</h2>
                    <button onClick={() => setCatModal(false)} className="p-2 text-gray-400 hover:text-gray-700"><X size={18} /></button>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">カテゴリ名 <span className="text-red-500">*</span></label>
                    <input type="text" value={catName} onChange={e => setCatName(e.target.value)} autoFocus
                      placeholder="例：詰め襟上着" className={INPUT} />
                  </div>
                  <button onClick={handleCatSave} disabled={!catName.trim() || catSaving}
                    className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-50 flex items-center justify-center gap-2">
                    {catSaving ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '保存する'}
                  </button>
                </div>
              </div>
            )}

            {presetsLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 size={24} className="animate-spin text-amber-400" /></div>
            ) : (
              <>
                {/* 種別ごとにグルーピング */}
                {(Object.keys(REPAIR_TYPE_LABELS) as RepairType[]).map(rtype => {
                  const group = presets.filter(p => p.repair_type === rtype)
                  return (
                    <div key={rtype}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-base">{REPAIR_TYPE_ICONS[rtype]}</span>
                        <p className="text-xs font-black text-gray-700">{REPAIR_TYPE_LABELS[rtype]}</p>
                        <button onClick={() => { setPpRepairType(rtype); openPresetModal() }}
                          className="ml-auto flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-800 px-2 py-1 rounded-lg hover:bg-amber-50 transition-all">
                          <Plus size={11} />追加
                        </button>
                      </div>
                      {group.length === 0 ? (
                        <p className="text-xs text-gray-300 pl-7 mb-3">未登録</p>
                      ) : (
                        <div className="space-y-1.5 mb-3">
                          {group.map(p => (
                            <div key={p.id} className="flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold text-gray-900">{p.item_name}</p>
                                <div className="flex gap-2 mt-0.5 flex-wrap">
                                  {p.category_id && (() => { const c = categories.find(c => c.id === p.category_id); return c ? <span className="text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1.5 py-0.5 font-bold">{c.name}</span> : null })()}
                                  {p.school_name && <span className="text-[10px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">{p.school_name}</span>}
                                  {p.default_price != null && <span className="text-[10px] font-bold text-amber-700">¥{p.default_price.toLocaleString()}</span>}
                                  {p.notes && <span className="text-[10px] text-gray-400 truncate">{p.notes}</span>}
                                </div>
                              </div>
                              <button onClick={() => openPresetModal(p)} className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"><Pencil size={13} /></button>
                              <button onClick={() => handlePresetDelete(p.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={13} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}

            {/* プリセット追加/編集モーダル */}
            {presetModal && (
              <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4">
                <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                      <Scissors size={15} className="text-amber-500" />
                      {editingPreset ? 'プリセットを編集' : 'プリセットを追加'}
                    </h2>
                    <button onClick={() => setPresetModal(false)} className="p-2 text-gray-400 hover:text-gray-700"><X size={18} /></button>
                  </div>
                  <div className="space-y-3">
                    <Field label="お直し種別" required>
                      <select value={ppRepairType} onChange={e => setPpRepairType(e.target.value as RepairType)} className={INPUT}>
                        {(Object.keys(REPAIR_TYPE_LABELS) as RepairType[]).map(t => (
                          <option key={t} value={t}>{REPAIR_TYPE_ICONS[t]} {REPAIR_TYPE_LABELS[t]}</option>
                        ))}
                      </select>
                    </Field>
                    {categories.length > 0 && (
                      <Field label="品名カテゴリ">
                        <select value={ppCategoryId ?? ''} onChange={e => setPpCategoryId(e.target.value || null)} className={INPUT}>
                          <option value="">カテゴリなし</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </Field>
                    )}
                    <Field label="品名" required>
                      <input type="text" value={ppItemName} onChange={e => setPpItemName(e.target.value)}
                        placeholder="例：詰め襟上着 / スラックス" autoFocus className={INPUT} />
                    </Field>
                    <Field label="対象学校（空欄=全学校共通）">
                      <input type="text" value={ppSchoolName} onChange={e => setPpSchoolName(e.target.value)}
                        placeholder="例：○○中学校" className={INPUT} />
                    </Field>
                    <Field label="標準価格（円）">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">¥</span>
                        <input type="number" inputMode="numeric" value={ppPrice} onChange={e => setPpPrice(e.target.value)}
                          placeholder="800" className="w-full border border-gray-300 rounded-xl pl-6 pr-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-amber-500 bg-white" />
                      </div>
                    </Field>
                    <Field label="備考">
                      <input type="text" value={ppNotes} onChange={e => setPpNotes(e.target.value)}
                        placeholder="スタッフへの補足" className={INPUT} />
                    </Field>
                  </div>
                  <button onClick={handlePresetSave} disabled={!ppItemName.trim() || ppSaving}
                    className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98]">
                    {ppSaving ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '保存する'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ================================================================
            スタッフ一覧
        ================================================================ */}
        {masterTab === 'staff' && (
          <>
            {staffLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={26} className="animate-spin text-emerald-400" />
              </div>
            ) : staffList.length === 0 ? (
              <div className="text-center py-14 text-gray-400">
                <UserCircle size={48} className="mx-auto mb-3 opacity-25" />
                <p className="text-sm font-bold">スタッフがまだ登録されていません</p>
                <p className="text-xs mt-1">下の「スタッフを追加」から登録してください</p>
              </div>
            ) : (
              staffList.map(staff => (
                deleteStaffTarget?.id === staff.id ? (
                  <div key={staff.id} className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-black text-red-700 text-center">
                      「{staff.name}」を削除しますか？
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteStaffTarget(null)}
                        className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 text-sm font-bold">キャンセル</button>
                      <button onClick={handleStaffDelete} disabled={deleteStaffLoading}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                        {deleteStaffLoading ? <Loader2 size={13} className="animate-spin" /> : <><Trash2 size={13} />削除する</>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={staff.id} className="bg-white border border-gray-200 rounded-2xl px-4 py-3.5 flex items-center gap-3 shadow-sm">
                    <ColorDot color={staff.color ?? '#94a3b8'} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-black text-gray-900 text-base leading-tight truncate">{staff.name}</p>
                        {!staff.active && (
                          <span className="text-[10px] bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded-full font-bold">非表示</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {staff.kana && <p className="text-xs text-gray-400 truncate">{staff.kana}</p>}
                        {staff.role && (
                          <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded-full font-bold">
                            {staff.role}
                          </span>
                        )}
                        {staff.pin && (
                          <span className="text-[10px] text-gray-400 font-mono">PIN: {staff.pin}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button onClick={() => openStaffEdit(staff)}
                        className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:text-gray-800 hover:bg-gray-200 active:scale-90 transition-all">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setDeleteStaffTarget(staff)}
                        className="p-2 rounded-xl bg-gray-100 text-gray-400 hover:text-red-600 hover:bg-red-50 active:scale-90 transition-all">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                )
              ))
            )}
            <button onClick={openStaffAdd}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 font-bold text-sm transition-all active:scale-[0.98]">
              <Plus size={16} />スタッフを追加
            </button>
          </>
        )}

        {/* ================================================================
            学校一覧
        ================================================================ */}
        {masterTab === 'schools' && schoolView === 'schools' && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 size={26} className="animate-spin text-indigo-400" />
              </div>
            ) : schools.length === 0 ? (
              <div className="text-center py-14 text-gray-400">
                <GraduationCap size={44} className="mx-auto mb-3 opacity-25" />
                <p className="text-sm font-bold">学校がまだ登録されていません</p>
                <p className="text-xs mt-1">下の「学校を追加」から始めてください</p>
              </div>
            ) : (
              schools.map(school => (
                deleteSchoolTarget?.id === school.id ? (
                  <div key={school.id} className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-black text-red-700 text-center">
                      「{school.name}」を削除しますか？
                      <br /><span className="text-xs font-normal text-red-600">紐付く商品・サイズ/価格もすべて削除されます</span>
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteSchoolTarget(null)}
                        className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 text-sm font-bold">キャンセル</button>
                      <button onClick={handleSchoolDelete} disabled={deleteSchoolLoading}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                        {deleteSchoolLoading ? <Loader2 size={13} className="animate-spin" /> : <><Trash2 size={13} />削除する</>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={school.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-center gap-3 px-4 py-3.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
                        <GraduationCap size={18} className="text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-900 text-base leading-tight truncate">{school.name}</p>
                        {school.short_name && <p className="text-xs text-gray-400 truncate">略称: {school.short_name}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => openSchoolEdit(school)}
                          className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:text-gray-800 hover:bg-gray-200 active:scale-90 transition-all">
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => setDeleteSchoolTarget(school)}
                          className="p-2 rounded-xl bg-gray-100 text-gray-400 hover:text-red-600 hover:bg-red-50 active:scale-90 transition-all">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <button onClick={() => goToProducts(school)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-t border-indigo-100 hover:bg-indigo-100 active:bg-indigo-200 transition-all">
                      <span className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                        <Package size={12} />商品・サイズ/価格を管理する
                      </span>
                      <ChevronRight size={14} className="text-indigo-400" />
                    </button>
                  </div>
                )
              ))
            )}
            <button onClick={openSchoolAdd}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 font-bold text-sm transition-all active:scale-[0.98]">
              <Plus size={16} />学校を追加
            </button>
          </>
        )}

        {/* ================================================================
            商品一覧
        ================================================================ */}
        {masterTab === 'schools' && schoolView === 'products' && (
          <>
            {subLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 size={24} className="animate-spin text-teal-400" /></div>
            ) : products.length === 0 ? (
              <div className="text-center py-14 text-gray-400">
                <Package size={44} className="mx-auto mb-3 opacity-25" />
                <p className="text-sm font-bold">商品がまだ登録されていません</p>
              </div>
            ) : (
              products.map(product => (
                deleteProductTarget?.id === product.id ? (
                  <div key={product.id} className="bg-red-50 border-2 border-red-300 rounded-2xl p-4 space-y-3">
                    <p className="text-sm font-black text-red-700 text-center">
                      「{product.item_name}」を削除しますか？
                      <br /><span className="text-xs font-normal text-red-600">サイズ・価格データもすべて削除されます</span>
                    </p>
                    <div className="flex gap-2">
                      <button onClick={() => setDeleteProductTarget(null)}
                        className="flex-1 py-2.5 rounded-xl bg-gray-200 text-gray-700 text-sm font-bold">キャンセル</button>
                      <button onClick={handleProductDelete} disabled={deleteProductLoading}
                        className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-50">
                        {deleteProductLoading ? <Loader2 size={13} className="animate-spin" /> : <><Trash2 size={13} />削除する</>}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div key={product.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-start gap-3 px-4 py-3.5">
                      <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center shrink-0 mt-0.5">
                        <Package size={18} className="text-teal-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-gray-900 text-base leading-tight truncate">{product.item_name}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {product.maker_code && <span className="text-[10px] font-mono bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded-lg">品番: {product.maker_code}</span>}
                          {product.color_code && <span className="text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-lg">色: {product.color_code}</span>}
                          {product.category && <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded-lg">{product.category}</span>}
                          {product.gender && <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-lg">{product.gender}</span>}
                        </div>
                        {product.notes && <p className="text-xs text-gray-400 mt-0.5 truncate">{product.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={() => openProductEdit(product)} className="p-2 rounded-xl bg-gray-100 text-gray-500 hover:text-gray-800 hover:bg-gray-200 active:scale-90 transition-all"><Pencil size={13} /></button>
                        <button onClick={() => setDeleteProductTarget(product)} className="p-2 rounded-xl bg-gray-100 text-gray-400 hover:text-red-600 hover:bg-red-50 active:scale-90 transition-all"><Trash2 size={13} /></button>
                      </div>
                    </div>
                    <button onClick={() => goToVariants(product)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-teal-50 border-t border-teal-100 hover:bg-teal-100 active:bg-teal-200 transition-all">
                      <span className="text-xs font-bold text-teal-700 flex items-center gap-1.5"><Tag size={12} />サイズ・価格を管理する</span>
                      <ChevronRight size={14} className="text-teal-400" />
                    </button>
                  </div>
                )
              ))
            )}
            <button onClick={openProductAdd}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-teal-300 text-teal-600 hover:bg-teal-50 font-bold text-sm transition-all active:scale-[0.98]">
              <Plus size={16} />商品を追加
            </button>
          </>
        )}

        {/* ================================================================
            サイズ・価格一覧
        ================================================================ */}
        {masterTab === 'schools' && schoolView === 'variants' && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
              <div className="flex items-start gap-2.5">
                <Package size={15} className="text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="font-black text-amber-900 text-sm truncate">{selectedProduct?.item_name}</p>
                  <div className="flex gap-2 mt-0.5 flex-wrap">
                    {selectedProduct?.maker_code && <span className="text-[10px] text-amber-700 font-mono">品番: {selectedProduct.maker_code}</span>}
                    {selectedProduct?.color_code && <span className="text-[10px] text-amber-700">色: {selectedProduct.color_code}</span>}
                    {selectedProduct?.category && <span className="text-[10px] text-amber-600">{selectedProduct.category}</span>}
                    {selectedProduct?.gender && <span className="text-[10px] text-amber-600">{selectedProduct.gender}</span>}
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 flex items-start gap-2">
              <AlertCircle size={13} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-700 leading-relaxed">
                この価格は<span className="font-bold">「{selectedSchool?.name}」専用</span>です。同じ品番でも学校ごとに価格・サイズ展開を独立管理できます。
              </p>
            </div>

            {subLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 size={22} className="animate-spin text-amber-400" /></div>
            ) : variants.length === 0 ? (
              <div className="text-center py-10 text-gray-400">
                <Tag size={36} className="mx-auto mb-3 opacity-25" />
                <p className="text-sm font-bold">サイズ・価格がまだ登録されていません</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-4 gap-2 px-1">
                  {['サイズ', '販売価格', '仕入価格', '在庫'].map(h => (
                    <p key={h} className="text-[10px] font-bold text-gray-400 uppercase tracking-wide text-right first:text-left">{h}</p>
                  ))}
                </div>
                {variants.map(v => (
                  deleteVariantTarget?.id === v.id ? (
                    <div key={v.id} className="bg-red-50 border-2 border-red-300 rounded-xl p-3 space-y-2">
                      <p className="text-sm font-black text-red-700 text-center">「{v.size_label}」を削除しますか？</p>
                      <div className="flex gap-2">
                        <button onClick={() => setDeleteVariantTarget(null)} className="flex-1 py-2 rounded-xl bg-gray-200 text-gray-700 text-xs font-bold">キャンセル</button>
                        <button onClick={handleVariantDelete} disabled={deleteVariantLoading}
                          className="flex-1 py-2 rounded-xl bg-red-600 text-white text-xs font-bold flex items-center justify-center gap-1 disabled:opacity-50">
                          {deleteVariantLoading ? <Loader2 size={12} className="animate-spin" /> : <><Trash2 size={12} />削除</>}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div key={v.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-2 shadow-sm">
                      <div className="flex-1 grid grid-cols-4 gap-2 items-center">
                        <p className="font-black text-gray-900 text-base">{v.size_label}</p>
                        <p className="text-sm font-bold text-red-600 text-right">{v.price > 0 ? `¥${v.price.toLocaleString()}` : '―'}</p>
                        <p className="text-xs text-gray-400 text-right">{v.cost != null ? `¥${v.cost.toLocaleString()}` : '―'}</p>
                        <p className={`text-xs font-bold text-right ${v.stock === 0 ? 'text-red-400' : 'text-gray-600'}`}>{v.stock}</p>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => openVariantEdit(v)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:text-gray-800 hover:bg-gray-200 active:scale-90 transition-all"><Pencil size={12} /></button>
                        <button onClick={() => setDeleteVariantTarget(v)} className="p-1.5 rounded-lg bg-gray-100 text-gray-400 hover:text-red-600 hover:bg-red-50 active:scale-90 transition-all"><Trash2 size={12} /></button>
                      </div>
                    </div>
                  )
                ))}
              </>
            )}
            <button onClick={openVariantAdd}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl border-2 border-dashed border-amber-300 text-amber-600 hover:bg-amber-50 font-bold text-sm transition-all active:scale-[0.98]">
              <Plus size={16} />バリエーションを追加
            </button>
          </>
        )}
      </div>

      {/* ================================================================
          スタッフフォームモーダル
      ================================================================ */}
      {staffModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setStaffModal(false)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4 shadow-2xl overflow-y-auto" style={{ maxHeight: '90dvh' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Users size={16} className="text-emerald-500" />
                {editingStaff ? 'スタッフを編集' : 'スタッフを追加'}
              </h2>
              <button onClick={() => setStaffModal(false)} className="p-2 text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Field label="氏名" required>
                  <input type="text" value={sfName} onChange={e => setSfName(e.target.value)}
                    placeholder="例：田中 花子" autoFocus className={INPUT} />
                </Field>
                <Field label="ふりがな">
                  <input type="text" value={sfKana} onChange={e => setSfKana(e.target.value)}
                    placeholder="たなか はなこ" className={INPUT} />
                </Field>
              </div>
              <Field label="役職">
                <select value={sfRole} onChange={e => setSfRole(e.target.value)} className={INPUT}>
                  <option value="">未設定</option>
                  {STAFF_ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="表示カラー">
                <div className="flex gap-2 flex-wrap pt-0.5">
                  {STAFF_COLOR_OPTIONS.map(c => (
                    <button key={c} onClick={() => setSfColor(c)}
                      style={{ backgroundColor: c }}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        sfColor === c ? 'border-gray-900 scale-110 shadow-md' : 'border-transparent'
                      }`} />
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <ColorDot color={sfColor} size={20} />
                  <span className="text-xs text-gray-500 font-mono">{sfColor}</span>
                </div>
              </Field>
              <Field label="個人識別PIN（4桁・任意）">
                <input type="text" inputMode="numeric" maxLength={4} value={sfPin}
                  onChange={e => setSfPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="例：1234" className={INPUT} />
                <p className="text-[10px] text-gray-400 mt-0.5">お渡し記録などで担当者を識別するためのPINです</p>
              </Field>
            </div>
            <button onClick={handleStaffSave} disabled={!sfName.trim() || sfSaving}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
              {sfSaving ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '保存する'}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================
          学校フォームモーダル
      ================================================================ */}
      {schoolModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSchoolModal(false)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                <GraduationCap size={16} className="text-indigo-500" />{editingSchool ? '学校を編集' : '学校を追加'}
              </h2>
              <button onClick={() => setSchoolModal(false)} className="p-2 text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <Field label="学校名" required>
                <input type="text" value={sName} onChange={e => setSName(e.target.value)} placeholder="例：○○中学校" autoFocus className={INPUT} />
              </Field>
              <Field label="略称（任意）">
                <input type="text" value={sShort} onChange={e => setSShort(e.target.value)} placeholder="例：○○中" className={INPUT} />
              </Field>
            </div>
            <button onClick={handleSchoolSave} disabled={!sName.trim() || schoolSaving}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
              {schoolSaving ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '保存する'}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================
          商品フォームモーダル
      ================================================================ */}
      {productModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setProductModal(false)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4 shadow-2xl overflow-y-auto max-h-[88vh]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Package size={16} className="text-teal-500" />{editingProduct ? '商品を編集' : '商品を追加'}
              </h2>
              <button onClick={() => setProductModal(false)} className="p-2 text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <Field label="商品名" required>
                <input type="text" value={pName} onChange={e => setPName(e.target.value)} placeholder="例：男子夏用スラックス" autoFocus className={INPUT} />
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Field label="メーカー品番">
                    <input type="text" value={pMaker} onChange={e => setPMaker(e.target.value)} placeholder="例：SL-100" className={INPUT} />
                  </Field>
                  <p className="text-[10px] text-amber-600 mt-0.5 font-bold">※ 同品番でも学校ごとに別登録可</p>
                </div>
                <Field label="色番">
                  <input type="text" value={pColor} onChange={e => setPColor(e.target.value)} placeholder="例：01（黒）" className={INPUT} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="カテゴリ">
                  <select value={pCategory} onChange={e => setPCategory(e.target.value)} className={INPUT}>
                    <option value="">未設定</option>
                    {PRODUCT_CATEGORY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="性別区分">
                  <select value={pGender} onChange={e => setPGender(e.target.value)} className={INPUT}>
                    <option value="">未設定</option>
                    {PRODUCT_GENDER_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="メモ">
                <input type="text" value={pNotes} onChange={e => setPNotes(e.target.value)} placeholder="備考・注意事項など" className={INPUT} />
              </Field>
            </div>
            <button onClick={handleProductSave} disabled={!pName.trim() || productSaving}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-teal-600 to-emerald-600 text-white disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
              {productSaving ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '保存する'}
            </button>
          </div>
        </div>
      )}

      {/* ================================================================
          サイズ・価格フォームモーダル
      ================================================================ */}
      {variantModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setVariantModal(false)}>
          <div className="w-full max-w-lg bg-white rounded-t-3xl px-5 pt-5 pb-8 space-y-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black text-gray-900 flex items-center gap-2">
                <Tag size={16} className="text-amber-500" />{editingVariant ? 'バリエーションを編集' : 'バリエーションを追加'}
              </h2>
              <button onClick={() => setVariantModal(false)} className="p-2 text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <Field label="サイズ" required>
                <input type="text" value={vSize} onChange={e => setVSize(e.target.value)} placeholder="例：150, 155, M, L, 170B" autoFocus className={INPUT} />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="販売価格" required>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">¥</span>
                    <input type="number" inputMode="numeric" value={vPrice} onChange={e => setVPrice(e.target.value)} placeholder="8800"
                      className="w-full border border-gray-300 rounded-xl pl-6 pr-2 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-amber-500 bg-white" />
                  </div>
                </Field>
                <Field label="仕入価格">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">¥</span>
                    <input type="number" inputMode="numeric" value={vCost} onChange={e => setVCost(e.target.value)} placeholder="5500"
                      className="w-full border border-gray-300 rounded-xl pl-6 pr-2 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-amber-500 bg-white" />
                  </div>
                </Field>
                <Field label="在庫数">
                  <input type="number" inputMode="numeric" value={vStock} onChange={e => setVStock(e.target.value)} placeholder="0"
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-amber-500 bg-white" />
                </Field>
              </div>
            </div>
            <button onClick={handleVariantSave} disabled={!vSize.trim() || variantSaving}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
              {variantSaving ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '保存する'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Export（useSearchParams は Suspense が必要）
// ============================================================
export default function MasterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-indigo-400" />
      </div>
    }>
      <MasterPageInner />
    </Suspense>
  )
}
