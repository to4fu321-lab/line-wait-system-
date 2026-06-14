'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import {
  ChevronLeft, ChevronRight, Plus, Pencil, Trash2,
  GraduationCap, Package, Tag, Loader2, X, AlertCircle, Users, UserCircle, Scissors, ScanLine,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { seedDefaultGrades } from '@/lib/master'
import type { School, SchoolProduct, SchoolProductVariant, Staff } from '@/types/master'
import type { SchoolGrade, SchoolParentTip, OcrResult, OcrResultItem } from '@/types/school'
import {
  PRODUCT_CATEGORY_OPTIONS, PRODUCT_GENDER_OPTIONS,
  STAFF_ROLE_OPTIONS, STAFF_COLOR_OPTIONS,
} from '@/types/master'
import { REPAIR_TYPE_LABELS, REPAIR_TYPE_ICONS } from '@/types/crm'
import type { RepairType } from '@/types/crm'

// ── 型 ────────────────────────────────────────────────────────
type MasterTab      = 'schools' | 'staff' | 'presets'
type SchoolView     = 'schools' | 'school_detail' | 'products' | 'variants'
type SchoolDetailTab = 'catalog' | 'regulations' | 'grades' | 'tips' | 'ocr'

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
  const { hasFeature, loaded: featLoaded } = useStoreFeatures(storeId)
  const isSimpleMode = featLoaded && !hasFeature('repairs_tab_purchase') && !hasFeature('repairs_tab_arrival')

  // ── Tab ──────────────────────────────────────────────────
  const initialTab = (searchParams?.get('tab') ?? (isSimpleMode ? 'presets' : 'schools')) as MasterTab
  const [masterTab, setMasterTab] = useState<MasterTab>(initialTab)

  // 「学校・商品」マスタは再設計版(/master/manage)へ移行済み。リダイレクトする。
  useEffect(() => {
    if (masterTab === 'schools') router.replace(`/${storeId}/admin/master/manage`)
  }, [masterTab, router, storeId])

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
  // 展開中カテゴリID（アコーディオン）
  const [expandedCatId, setExpandedCatId] = useState<string | null>(null)

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

  // ── School detail / regulations state ────────────────────
  const [schoolDetailTab, setSchoolDetailTab] = useState<SchoolDetailTab>('catalog')
  const [regGrades,  setRegGrades]  = useState<SchoolGrade[]>([])
  const [regTips,    setRegTips]    = useState<SchoolParentTip[]>([])
  const [regSaving,  setRegSaving]  = useState(false)
  // OCR state
  const [ocrFiles,    setOcrFiles]    = useState<File[]>([])
  const [ocrPreviews, setOcrPreviews] = useState<string[]>([])
  const [ocrResult,   setOcrResult]   = useState<OcrResult | null>(null)
  const [ocrEditItems, setOcrEditItems] = useState<OcrResultItem[]>([])
  const [ocrLoading,  setOcrLoading]  = useState(false)
  const ocrFileRef = useRef<HTMLInputElement | null>(null)

  // ── Product form state ────────────────────────────────────
  const [productModal,         setProductModal]         = useState(false)
  const [editingProduct,       setEditingProduct]       = useState<SchoolProduct | null>(null)
  const [pName,                setPName]                = useState('')
  const [pMakerName,           setPMakerName]           = useState('')
  const [supplierNames,        setSupplierNames]        = useState<string[]>([])
  const [pMaker,               setPMaker]               = useState('')
  const [pColor,               setPColor]               = useState('')
  const [pCategory,            setPCategory]            = useState('')
  const [pGender,              setPGender]              = useState('')
  const [pNotes,               setPNotes]               = useState('')
  const [productSaving,        setProductSaving]        = useState(false)
  const [deleteProductTarget,  setDeleteProductTarget]  = useState<SchoolProduct | null>(null)
  const [deleteProductLoading, setDeleteProductLoading] = useState(false)
  const [pBarcode,             setPBarcode]             = useState('')
  const [pScanLoading,         setPScanLoading]         = useState(false)
  const pScanRef       = useRef<HTMLInputElement | null>(null)
  const [globalScanLoading,    setGlobalScanLoading]    = useState(false)
  const globalScanRef  = useRef<HTMLInputElement | null>(null)

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

  // 仕入先マスタ → 商品フォームのメーカー選択肢（表記ゆれ防止）
  const fetchSuppliers = useCallback(async () => {
    if (!storeId) return
    const { data } = await (supabase as any)
      .from('suppliers').select('name, is_active').eq('store_id', storeId)
      .order('sort_order').order('name')
    if (Array.isArray(data)) {
      setSupplierNames(data.filter((s: any) => s.is_active !== false && s.name).map((s: any) => s.name as string))
    }
  }, [storeId])

  useEffect(() => {
    fetchSchools()
    fetchStaff()
    fetchSuppliers()
  }, [fetchSchools, fetchStaff, fetchSuppliers])

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

  // ── Repair presets ───────────────────────────────────────
  const fetchPresets = useCallback(async () => {
    setPresetsLoading(true)
    const { data } = await (supabase as any).from('repair_price_presets')
      .select('*').eq('store_id', storeId).order('repair_type').order('sort_order')
    setPresets(data ?? [])
    setPresetsLoading(false)
  }, [storeId])

  const openPresetModal = (preset?: RepairPreset, defaultCategoryId?: string | null, defaultRepairType?: RepairType) => {
    setEditingPreset(preset ?? null)
    setPpItemName(preset?.item_name ?? '')
    setPpRepairType((preset?.repair_type ?? defaultRepairType ?? 'hem') as RepairType)
    setPpSchoolName(preset?.school_name ?? '')
    setPpPrice(preset?.default_price != null ? String(preset.default_price) : '')
    setPpNotes(preset?.notes ?? '')
    setPpCategoryId(preset?.category_id ?? defaultCategoryId ?? null)
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

  // お直しマスタは専用ページへ移行済み（服種>項目>オプションの3階層）。
  // 旧 presets タブに来たら新ページへリダイレクトする。
  useEffect(() => {
    if (masterTab === 'presets' && storeId) router.replace(`/${storeId}/admin/master/repair`)
  }, [masterTab, storeId, router])

  // ── Tab 切替 ──────────────────────────────────────────────
  const switchTab = (tab: MasterTab) => {
    if (tab === 'presets') { router.push(`/${storeId}/admin/master/repair`); return }
    setMasterTab(tab)
    if (tab === 'schools') { setSchoolView('schools'); setSelectedSchool(null); setSelectedProduct(null); setSchoolDetailTab('catalog') }
  }

  // ── Navigation (school drill-down) ───────────────────────
  const goToSchoolDetail = async (school: School) => {
    setSelectedSchool(school)
    setSchoolView('school_detail')
    setSchoolDetailTab('catalog')
    const [gradesRes, tipsRes] = await Promise.all([
      fetch(`/api/schools/${school.id}/grades`).then(r => r.json()),
      fetch(`/api/schools/${school.id}/tips`).then(r => r.json()),
    ])
    setRegGrades(Array.isArray(gradesRes) ? gradesRes : [])
    setRegTips(Array.isArray(tipsRes) ? tipsRes : [])
    // 規定品タブは school_products を共用するためここで先読み
    await fetchProducts(school.id)
  }
  const goToVariants = async (product: SchoolProduct) => {
    setSelectedProduct(product); setVariants([]); setSchoolView('variants')
    await fetchVariants(product.id)
  }
  const goBack = () => {
    if (masterTab === 'staff') { router.back() }
    else if (schoolView === 'variants') { setSchoolView('products'); setSelectedProduct(null) }
    else if (schoolView === 'products') { setSchoolView('school_detail') }
    else if (schoolView === 'school_detail') { setSchoolView('schools'); setSelectedSchool(null) }
    else router.back()
  }

  // ── Regulation save functions ─────────────────────────────
  const saveRegulationFields = async () => {
    if (!selectedSchool || products.length === 0) return
    setRegSaving(true)
    const now = new Date().toISOString()
    await Promise.all(products.map(p =>
      (supabase as any).from('school_products').update({
        required:         p.required ?? true,
        avg_qty:          p.avg_qty ?? null,
        uses_grade_color: p.uses_grade_color ?? false,
        grade_color_note: p.grade_color_note ?? '',
        eo_price_tax_in:  p.eo_price_tax_in ?? null,
        eo_price_tax_out: p.eo_price_tax_out ?? null,
        updated_at: now,
      }).eq('id', p.id)
    ))
    setRegSaving(false)
    showToast('ok', '規定品情報を保存しました')
  }

  const saveRegGrades = async () => {
    if (!selectedSchool) return
    setRegSaving(true)
    await fetch(`/api/schools/${selectedSchool.id}/grades`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grades: regGrades, updated_by: 'staff' }),
    })
    setRegSaving(false)
    showToast('ok', '学年色を保存しました')
  }

  // 標準学年(1〜3年 + 既定色)を自動生成して取り込む
  const seedRegGrades = async () => {
    if (!selectedSchool) return
    setRegSaving(true)
    try {
      await seedDefaultGrades(selectedSchool.id, 3)
      const grades = await fetch(`/api/schools/${selectedSchool.id}/grades`).then(r => r.json())
      setRegGrades(Array.isArray(grades) ? grades : [])
      showToast('ok', '標準学年を生成しました')
    } catch (e: any) { showToast('err', `生成失敗: ${e.message}`) }
    setRegSaving(false)
  }

  const approveTip = async (tipId: string, approved: boolean) => {
    await fetch(`/api/schools/tips/${tipId}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, updated_by: 'staff' }),
    })
    setRegTips(prev => prev.map(t => t.id === tipId ? { ...t, approved } : t))
  }

  const handleOcr = async () => {
    if (ocrFiles.length === 0) return
    setOcrLoading(true)
    try {
      const form = new FormData()
      ocrFiles.forEach(f => form.append('images', f))
      const res = await fetch('/api/schools/ocr', { method: 'POST', body: form })
      const data: OcrResult = await res.json()
      setOcrResult(data)
      setOcrEditItems(data.items ?? [])
    } catch { showToast('err', 'OCRに失敗しました') }
    setOcrLoading(false)
  }

  const saveOcrItems = async () => {
    if (!selectedSchool) return
    setRegSaving(true)
    const baseSort = products.length
    for (let idx = 0; idx < ocrEditItems.length; idx++) {
      const it = ocrEditItems[idx]
      const productPayload = {
        school_id:        selectedSchool.id,
        store_id:         storeId,
        item_name:        it.name,
        maker_code:       (it as any).product_code || null,
        notes:            [(it as any).size_spec, it.item_notes].filter(Boolean).join(' / ') || null,
        required:         it.required,
        avg_qty:          it.avg_qty ?? null,
        uses_grade_color: it.uses_grade_color,
        grade_color_note: it.grade_color_note ?? '',
        eo_price_tax_in:  (it as any).eo_price_tax_in ?? null,
        eo_price_tax_out: (it as any).eo_price_tax_out ?? null,
        sort_order:       baseSort + idx,
      }
      const { data: newProduct } = await (supabase as any)
        .from('school_products').insert(productPayload).select().single()
      if (newProduct && (it.price_tax_in || (it as any).cost_price)) {
        await (supabase as any).from('school_product_variants').insert({
          product_id: newProduct.id,
          store_id:   storeId,
          size_label: (it as any).size_spec || '標準',
          price:      it.price_tax_in ?? 0,
          cost:       (it as any).cost_price ?? null,
          stock:      0,
        })
      }
    }
    await fetchProducts(selectedSchool.id)
    setOcrResult(null)
    setOcrFiles([])
    setOcrPreviews([])
    setRegSaving(false)
    setSchoolDetailTab('regulations')
    showToast('ok', `${ocrEditItems.length}件を商品マスタに追加しました`)
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
  const openProductAdd  = () => { setEditingProduct(null); setPName(''); setPMakerName(''); setPMaker(''); setPColor(''); setPCategory(''); setPGender(''); setPNotes(''); setPBarcode(''); setProductModal(true) }
  const openProductEdit = (p: SchoolProduct) => { setEditingProduct(p); setPName(p.item_name); setPMakerName(p.maker ?? ''); setPMaker(p.maker_code ?? ''); setPColor(p.color_code ?? ''); setPCategory(p.category ?? ''); setPGender(p.gender ?? ''); setPNotes(p.notes ?? ''); setPBarcode(p.barcode ?? ''); setProductModal(true) }

  const handleProductSave = async () => {
    if (!pName.trim() || !selectedSchool) return
    setProductSaving(true)
    const payload = { item_name: pName.trim(), maker: pMakerName.trim() || null, maker_code: pMaker.trim() || null, color_code: pColor.trim() || null, category: pCategory || null, gender: pGender || null, notes: pNotes.trim() || null, barcode: pBarcode.trim() || null, updated_at: new Date().toISOString() }
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

  // ── Tag scan: 商品タグのAI認識（フォーム自動入力）────────────
  const handleTagScan = async (file: File) => {
    setPScanLoading(true)
    try {
      let detectedBarcode: string | null = null
      if ('BarcodeDetector' in window) {
        try {
          const bd = new (window as any).BarcodeDetector()
          const bitmap = await createImageBitmap(file)
          const codes = await bd.detect(bitmap)
          if (codes.length > 0) { detectedBarcode = codes[0].rawValue; setPBarcode(codes[0].rawValue) }
        } catch {}
      }
      const b64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = () => res((reader.result as string).split(',')[1])
        reader.onerror = rej; reader.readAsDataURL(file)
      })
      const resp = await fetch('/api/tag-scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64, mimeType: file.type }),
      })
      const { ok, data } = await resp.json()
      if (ok && data) {
        if (data.barcode || detectedBarcode) setPBarcode(data.barcode ?? detectedBarcode)
        if (data.item_name)  setPName(data.item_name)
        if (data.maker)      setPMakerName(data.maker)
        if (data.maker_code) setPMaker(data.maker_code)
        if (data.color_code) setPColor(data.color_code)
        if (data.category)   setPCategory(data.category)
        if (data.gender)     setPGender(data.gender)
        showToast('ok', `📷 タグを読み取りました（精度: ${data.confidence === 'high' ? '高' : data.confidence === 'medium' ? '中' : '低'}）`)
      } else {
        showToast('err', 'タグの読み取りに失敗しました')
      }
    } catch (e) {
      showToast('err', `スキャンエラー: ${String(e)}`)
    } finally {
      setPScanLoading(false)
    }
  }

  // ── Global scan: バーコードで商品を検索してナビゲート ─────────
  const handleGlobalScan = async (file: File) => {
    setGlobalScanLoading(true)
    try {
      let barcode: string | null = null
      if ('BarcodeDetector' in window) {
        try {
          const bd = new (window as any).BarcodeDetector()
          const bitmap = await createImageBitmap(file)
          const codes = await bd.detect(bitmap)
          if (codes.length > 0) barcode = codes[0].rawValue
        } catch {}
      }
      if (!barcode) {
        const b64 = await new Promise<string>((res, rej) => {
          const reader = new FileReader()
          reader.onload = () => res((reader.result as string).split(',')[1])
          reader.onerror = rej; reader.readAsDataURL(file)
        })
        const resp = await fetch('/api/tag-scan', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: b64, mimeType: file.type }),
        })
        const { ok, data } = await resp.json()
        if (ok && data?.barcode) barcode = data.barcode
      }
      if (!barcode) { showToast('err', 'バーコードが読み取れませんでした'); return }

      const { data: found } = await (supabase as any).from('school_products')
        .select('*').eq('store_id', storeId).eq('barcode', barcode).eq('active', true).limit(1)
      if (!found?.[0]) { showToast('err', `「${barcode}」に一致する商品がマスタに登録されていません`); return }

      const prod = found[0] as SchoolProduct
      const school = schools.find(s => s.id === prod.school_id)
      if (!school) { showToast('err', '学校情報が取得できませんでした'); return }

      setSelectedSchool(school)
      setSelectedProduct(prod)
      setSchoolView('variants')
      setMasterTab('schools')
      await fetchVariants(prod.id)
      showToast('ok', `📦 ${prod.item_name} を開きました`)
    } catch (e) {
      showToast('err', `スキャンエラー: ${String(e)}`)
    } finally {
      setGlobalScanLoading(false)
    }
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
    : schoolView === 'school_detail' ? 'from-violet-700 to-indigo-700'
    : schoolView === 'products' ? 'from-teal-700 to-emerald-700'
    : schoolView === 'variants' ? 'from-amber-600 to-orange-600'
    : 'from-indigo-700 to-violet-700'

  // ============================================================
  // Render
  // ============================================================
  if (featLoaded && !hasFeature('repairs_master')) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h1 className="text-lg font-black text-gray-800 mb-2">このページは現在のプランでは利用できません</h1>
        <p className="text-sm text-gray-400 mb-6">スーパー管理画面でプランを変更するか、管理者にお問い合わせください</p>
        <button onClick={() => router.back()}
          className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-2xl">戻る</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ── Header ───────────────────────────────────────── */}
      <div className={`sticky top-0 z-20 bg-gradient-to-r ${headerGrad} shadow-lg`} style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2 max-w-lg mx-auto">
          <button onClick={goBack} className="p-1 -ml-1 text-white/80 hover:text-white active:scale-90 transition-all">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            {masterTab === 'staff' && <h1 className="text-white font-black text-base">スタッフマスタ</h1>}
            {masterTab === 'presets' && <h1 className="text-white font-black text-base">✂️ お直し料金マスタ</h1>}
            {masterTab === 'schools' && schoolView === 'schools' && <h1 className="text-white font-black text-base">学校・商品マスタ</h1>}
            {masterTab === 'schools' && schoolView === 'school_detail' && (
              <>
                <p className="text-white/60 text-[10px] font-bold truncate leading-tight">学校・商品マスタ</p>
                <h1 className="text-white font-black text-base leading-tight">{selectedSchool?.name}</h1>
              </>
            )}
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
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={() => globalScanRef.current?.click()} disabled={globalScanLoading}
                title="バーコード・QRコードで商品を検索"
                className="p-1.5 text-white/70 hover:text-white bg-white/10 rounded-xl transition-all active:scale-90 disabled:opacity-50">
                {globalScanLoading ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
              </button>
              <input ref={globalScanRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleGlobalScan(f); e.target.value = '' }} />
              <div className="flex items-center gap-0.5 text-[10px]">
                <span className={schoolView === 'schools'  ? 'text-white font-black' : 'text-white/40'}>学校</span>
                <ChevronRight size={9} className="text-white/30" />
                <span className={schoolView === 'school_detail' ? 'text-white font-black' : 'text-white/40'}>詳細</span>
                <ChevronRight size={9} className="text-white/30" />
                <span className={schoolView === 'products' ? 'text-white font-black' : 'text-white/40'}>商品</span>
                <ChevronRight size={9} className="text-white/30" />
                <span className={schoolView === 'variants' ? 'text-white font-black' : 'text-white/40'}>価格</span>
              </div>
            </div>
          )}
        </div>
        {/* タブ切替バー — simpleモードはお直し料金のみ */}
        {!isSimpleMode && (
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
        )}
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">

        {/* ================================================================
            お直し料金プリセット（服種×お直し種別の2階層）
        ================================================================ */}
        {masterTab === 'presets' && (
          <>
            <p className="text-xs text-gray-500">服種（大項目）ごとにお直し料金を設定します。設定内容はお直し受付画面に反映されます。</p>

            {/* ── 大項目（服種）管理 ──────────────────────────── */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <p className="text-sm font-black text-gray-800 flex items-center gap-2">
                  <Scissors size={14} className="text-amber-500" />大項目（服種）
                </p>
                <button onClick={() => openCatModal()}
                  className="flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:text-amber-800 px-2 py-1 rounded-lg hover:bg-amber-50 transition-all">
                  <Plus size={11} />追加
                </button>
              </div>
              {categories.length === 0 ? (
                <div className="p-4 space-y-2">
                  <p className="text-xs text-gray-400">服種カテゴリが未登録です。おすすめから追加できます：</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { name: '上着・ジャケット', icon: '🧥' },
                      { name: 'スラックス', icon: '👖' },
                      { name: 'スカート', icon: '👗' },
                      { name: 'ワイシャツ', icon: '👔' },
                    ].map((d, i) => (
                      <button key={d.name}
                        onClick={async () => {
                          await (supabase as any).from('repair_item_categories').insert({
                            store_id: storeId, name: d.name, sort_order: i,
                          })
                          fetchCategories()
                          showToast('ok', `「${d.name}」を追加しました`)
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-700 hover:bg-amber-100 transition-all active:scale-95">
                        <span>{d.icon}</span>{d.name}<Plus size={9} className="opacity-60" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 flex flex-wrap gap-2">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded-xl px-2.5 py-1.5">
                      <span className="text-sm font-bold text-amber-800">{cat.name}</span>
                      <button onClick={() => openCatModal(cat)}
                        className="p-0.5 text-amber-300 hover:text-amber-700 rounded transition-all ml-0.5">
                        <Pencil size={10} />
                      </button>
                      <button onClick={() => handleCatDelete(cat.id)}
                        className="p-0.5 text-amber-300 hover:text-red-500 rounded transition-all">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── カテゴリ追加/編集モーダル ─────────────────────── */}
            {catModal && (
              <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center sm:p-4">
                <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-gray-900">{editingCat ? '服種カテゴリを編集' : '服種カテゴリを追加'}</h2>
                    <button onClick={() => setCatModal(false)} className="p-2 text-gray-400 hover:text-gray-700"><X size={18} /></button>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-600 block mb-1">カテゴリ名 <span className="text-red-500">*</span></label>
                    <input type="text" value={catName} onChange={e => setCatName(e.target.value)} autoFocus
                      placeholder="例：上着・ジャケット、スラックス" className={INPUT} />
                  </div>
                  <button onClick={handleCatSave} disabled={!catName.trim() || catSaving}
                    className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white disabled:opacity-50 flex items-center justify-center gap-2">
                    {catSaving ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '保存する'}
                  </button>
                </div>
              </div>
            )}

            {/* ── 各服種のお直し設定 ──────────────────────────── */}
            {presetsLoading ? (
              <div className="flex items-center justify-center py-10"><Loader2 size={24} className="animate-spin text-amber-400" /></div>
            ) : (
              <>
                {categories.length === 0 && (
                  <div className="text-center py-10 text-gray-300">
                    <Scissors size={40} className="mx-auto mb-3 opacity-30" />
                    <p className="text-sm font-bold text-gray-400">服種カテゴリを追加してから</p>
                    <p className="text-xs mt-1 text-gray-400">お直し料金を設定できます</p>
                  </div>
                )}

                {categories.map(cat => {
                  const catPresets = presets.filter(p => p.category_id === cat.id)
                  const isOpen = expandedCatId === cat.id
                  return (
                    <div key={cat.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                      {/* ── 大項目ヘッダー（タップで展開） ── */}
                      <button
                        onClick={() => setExpandedCatId(isOpen ? null : cat.id)}
                        className="w-full flex items-center gap-3 px-4 py-4 bg-gradient-to-r from-amber-50 to-orange-50 active:bg-amber-100 transition-all text-left"
                        aria-expanded={isOpen}>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-black text-amber-900">{cat.name}</p>
                          <p className="text-xs text-amber-600 mt-0.5 font-medium">
                            {catPresets.length > 0 ? `${catPresets.length}件` : '未設定'}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button onClick={e => { e.stopPropagation(); openCatModal(cat) }}
                            className="p-2 text-amber-300 hover:text-amber-700 hover:bg-amber-100 rounded-xl transition-all active:scale-90"
                            aria-label={`${cat.name}を編集`}>
                            <Pencil size={14} />
                          </button>
                          <button onClick={e => { e.stopPropagation(); handleCatDelete(cat.id) }}
                            className="p-2 text-amber-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                            aria-label={`${cat.name}を削除`}>
                            <Trash2 size={14} />
                          </button>
                          <ChevronRight size={16} className={`text-amber-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
                        </div>
                      </button>

                      {/* ── 項目フラット一覧（展開時） ── */}
                      {isOpen && (
                        <div>
                          {catPresets.length === 0 ? (
                            <div className="px-4 py-6 text-center">
                              <Scissors size={28} className="mx-auto mb-2 text-gray-200" />
                              <p className="text-sm text-gray-400 font-bold">まだ項目がありません</p>
                              <p className="text-xs text-gray-300 mt-0.5">下の「＋追加」から登録してください</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-50">
                              {catPresets.map(p => (
                                <div key={p.id} className="flex items-center gap-3 px-4 py-3.5">
                                  <span className="text-xl shrink-0 w-8 text-center">
                                    {REPAIR_TYPE_ICONS[p.repair_type as RepairType] ?? '✂️'}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 leading-tight">{p.item_name}</p>
                                    {p.notes && <p className="text-[10px] text-gray-400 mt-0.5 truncate">{p.notes}</p>}
                                    {p.school_name && (
                                      <span className="inline-block text-[10px] bg-indigo-50 text-indigo-600 border border-indigo-100 rounded px-1.5 py-0.5 mt-0.5">{p.school_name}</span>
                                    )}
                                  </div>
                                  {p.default_price != null && (
                                    <span className="text-sm font-black text-amber-600 shrink-0">¥{p.default_price.toLocaleString()}</span>
                                  )}
                                  <div className="flex gap-1 shrink-0">
                                    <button onClick={() => openPresetModal(p)}
                                      className="p-2 text-gray-300 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all active:scale-90"
                                      aria-label={`${p.item_name}を編集`}>
                                      <Pencil size={13} />
                                    </button>
                                    <button onClick={() => handlePresetDelete(p.id)}
                                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
                                      aria-label={`${p.item_name}を削除`}>
                                      <Trash2 size={13} />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="px-4 py-3 border-t border-gray-50">
                            <button
                              onClick={() => openPresetModal(undefined, cat.id)}
                              className="flex items-center gap-2 text-sm font-bold text-amber-600 hover:text-amber-800 hover:bg-amber-50 px-4 py-3 rounded-xl transition-all w-full justify-center border-2 border-dashed border-amber-300 hover:border-amber-400 active:scale-[0.98]">
                              <Plus size={15} />お直し項目を追加
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* カテゴリ未分類のプリセット */}
                {(() => {
                  const uncatPresets = presets.filter(p => !p.category_id)
                  if (uncatPresets.length === 0) return null
                  const typesWithPresets = (Object.keys(REPAIR_TYPE_LABELS) as RepairType[]).filter(
                    rt => uncatPresets.some(p => p.repair_type === rt)
                  )
                  return (
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
                        <p className="text-xs font-black text-gray-500">カテゴリ未分類</p>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {typesWithPresets.map(rtype => {
                          const group = uncatPresets.filter(p => p.repair_type === rtype)
                          return (
                            <div key={rtype} className="px-4 py-2.5">
                              <div className="flex items-center gap-2 mb-1.5">
                                <span className="text-sm">{REPAIR_TYPE_ICONS[rtype]}</span>
                                <p className="text-xs font-bold text-gray-500 flex-1">{REPAIR_TYPE_LABELS[rtype]}</p>
                              </div>
                              <div className="flex flex-wrap gap-1.5 pl-6">
                                {group.map(p => (
                                  <div key={p.id} className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                                    <span className="text-xs font-bold text-gray-700">{p.item_name}</span>
                                    {p.default_price != null && (
                                      <span className="text-xs font-black text-amber-600">¥{p.default_price.toLocaleString()}</span>
                                    )}
                                    <button onClick={() => openPresetModal(p)}
                                      className="p-1 text-gray-300 hover:text-indigo-600 rounded-lg transition-all"><Pencil size={10} /></button>
                                    <button onClick={() => handlePresetDelete(p.id)}
                                      className="p-1 text-gray-300 hover:text-red-500 rounded-lg transition-all"><Trash2 size={10} /></button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </>
            )}

            {/* プリセット追加/編集モーダル */}
            {presetModal && (
              <div className="fixed inset-0 z-[60] bg-black/40 flex items-end sm:items-center justify-center sm:p-4">
                <div className="bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-black text-gray-900 flex items-center gap-2">
                      <Scissors size={15} className="text-amber-500" />
                      {editingPreset ? 'プリセットを編集' : 'プリセットを追加'}
                    </h2>
                    <button onClick={() => setPresetModal(false)} className="p-2 text-gray-400 hover:text-gray-700"><X size={18} /></button>
                  </div>
                  <div className="space-y-3">
                    <Field label="項目名" required>
                      <input type="text" value={ppItemName} onChange={e => setPpItemName(e.target.value)}
                        placeholder="例：裾上げ（シングル） / 袖丈詰め" autoFocus className={INPUT} />
                    </Field>
                    <Field label="標準価格（円）">
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">¥</span>
                        <input type="number" inputMode="numeric" value={ppPrice} onChange={e => setPpPrice(e.target.value)}
                          placeholder="800" className="w-full border border-gray-300 rounded-xl pl-6 pr-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-amber-500 bg-white" />
                      </div>
                    </Field>
                    <Field label="備考・スタッフへの補足">
                      <input type="text" value={ppNotes} onChange={e => setPpNotes(e.target.value)}
                        placeholder="例：グローイング対応、ヘム仕上げ+¥400" className={INPUT} />
                    </Field>
                    {categories.length > 0 && (
                      <Field label="服種カテゴリ">
                        <select value={ppCategoryId ?? ''} onChange={e => setPpCategoryId(e.target.value || null)} className={INPUT}>
                          <option value="">未分類</option>
                          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                      </Field>
                    )}
                    <Field label="対象学校（空欄＝全学校共通）">
                      <input type="text" value={ppSchoolName} onChange={e => setPpSchoolName(e.target.value)}
                        placeholder="例：○○中学校" className={INPUT} />
                    </Field>
                    <div className="border-t border-gray-100 pt-2">
                      <Field label="✂️ お直し種別タグ（受付フォームの入力欄を切り替えます）">
                        <select value={ppRepairType} onChange={e => setPpRepairType(e.target.value as RepairType)} className={INPUT}>
                          {(Object.keys(REPAIR_TYPE_LABELS) as RepairType[]).map(t => (
                            <option key={t} value={t}>{REPAIR_TYPE_ICONS[t]} {REPAIR_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </Field>
                    </div>
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
                    <button onClick={() => goToSchoolDetail(school)}
                      className="w-full flex items-center justify-between px-4 py-2.5 bg-indigo-50 border-t border-indigo-100 hover:bg-indigo-100 active:bg-indigo-200 transition-all">
                      <span className="text-xs font-bold text-indigo-600 flex items-center gap-1.5">
                        <Package size={12} />商品・規定品・学年色を管理する
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
            学校詳細（タブ付き: 商品マスタ / 規定品 / 学年色 / 保護者の声 / OCR）
        ================================================================ */}
        {masterTab === 'schools' && schoolView === 'school_detail' && selectedSchool && (
          <div className="max-w-lg mx-auto">
            {/* Sub-tab bar */}
            <div className="flex overflow-x-auto gap-1 mb-4 bg-white border border-gray-200 rounded-xl p-1">
              {([
                { key: 'catalog',     label: '📦 商品マスタ' },
                { key: 'regulations', label: '📋 規定品' },
                { key: 'grades',      label: '🎨 学年色' },
                { key: 'tips',        label: '💬 保護者の声' },
                { key: 'ocr',         label: '📄 OCR取込' },
              ] as { key: SchoolDetailTab; label: string }[]).map(t => (
                <button key={t.key} onClick={() => setSchoolDetailTab(t.key)}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                    schoolDetailTab === t.key ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* 商品マスタ tab */}
            {schoolDetailTab === 'catalog' && (
              <div>
                <p className="text-xs text-gray-500 mb-3">商品・サイズ・価格マスタを管理します</p>
                <button onClick={() => { setSchoolView('products'); fetchProducts(selectedSchool.id) }}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-3 font-bold text-sm transition-colors">
                  商品マスタを開く →
                </button>
              </div>
            )}

            {/* 規定品 tab */}
            {schoolDetailTab === 'regulations' && (
              <div className="px-4 pb-4">
                <p className="text-xs text-gray-400 mb-3">商品マスタに登録済みの商品に対し、必須/任意・平均点数・EO価格・学年色を設定します。品番・サイズ・価格の追加は「📦 商品マスタ」から行ってください。</p>
                {products.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-400 text-sm mb-3">商品がまだ登録されていません</p>
                    <button onClick={() => { setSchoolView('products'); fetchProducts(selectedSchool.id) }}
                      className="text-indigo-600 text-sm font-bold underline">📦 商品マスタへ →</button>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2 mb-4">
                      {products.map((prod, i) => (
                        <div key={prod.id} className={`border rounded-xl p-3 ${prod.required ? 'border-green-300 bg-green-50' : 'bg-white border-gray-200'}`}>
                          {/* 品名 + 必須チェック */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`flex-1 text-sm font-bold truncate ${prod.required ? 'text-green-800' : 'text-gray-700'}`}>
                              {prod.item_name}
                            </span>
                            {prod.maker_code && <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">{prod.maker_code}</span>}
                            <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap">
                              <input type="checkbox" checked={prod.required ?? true}
                                onChange={e => setProducts(prev => prev.map((p, idx) => idx === i ? { ...p, required: e.target.checked } : p))}
                                className="accent-green-600" />
                              必須
                            </label>
                          </div>
                          {/* 規定品フィールド */}
                          <div className="grid grid-cols-2 gap-1.5 text-xs">
                            <input value={prod.eo_price_tax_in ?? ''} type="number"
                              onChange={e => setProducts(prev => prev.map((p, idx) => idx === i ? { ...p, eo_price_tax_in: e.target.value ? Number(e.target.value) : null } : p))}
                              placeholder="EO価格（税込）" className="border border-orange-200 rounded-lg px-2 py-1 focus:outline-none focus:border-orange-400 bg-orange-50" />
                            <input value={prod.avg_qty ?? ''} type="number" step="0.5"
                              onChange={e => setProducts(prev => prev.map((p, idx) => idx === i ? { ...p, avg_qty: e.target.value ? Number(e.target.value) : null } : p))}
                              placeholder="平均点数" className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-400 bg-white" />
                          </div>
                          <div className="flex gap-3 mt-1.5 text-xs">
                            <label className="flex items-center gap-1 text-gray-600">
                              <input type="checkbox" checked={prod.uses_grade_color ?? false}
                                onChange={e => setProducts(prev => prev.map((p, idx) => idx === i ? { ...p, uses_grade_color: e.target.checked } : p))}
                                className="accent-purple-600" />
                              🎨 学年色あり
                            </label>
                          </div>
                          {prod.uses_grade_color && (
                            <input value={prod.grade_color_note ?? ''} onChange={e => setProducts(prev => prev.map((p, idx) => idx === i ? { ...p, grade_color_note: e.target.value } : p))}
                              placeholder="学年色メモ（例: ジャージラインが学年色）" className="mt-1.5 w-full border border-purple-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-400 bg-purple-50" />
                          )}
                        </div>
                      ))}
                    </div>
                    <button onClick={saveRegulationFields} disabled={regSaving}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 transition-colors">
                      {regSaving ? '保存中...' : '💾 規定品情報を保存'}
                    </button>
                  </>
                )}
              </div>
            )}

            {/* 学年色 tab */}
            {schoolDetailTab === 'grades' && (
              <div>
                <p className="text-xs text-gray-500 mb-3">ジャージなど学年によって色が変わるアイテムの学年カラーを登録</p>
                <div className="space-y-2 mb-4">
                  {regGrades.length === 0 && (
                    <div className="text-center py-6 space-y-3">
                      <p className="text-gray-400 text-sm">学年カラーが登録されていません</p>
                      <button onClick={seedRegGrades} disabled={regSaving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-sm font-bold hover:bg-indigo-100 disabled:opacity-50 transition-colors">
                        {regSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                        標準学年（1〜3年）を生成
                      </button>
                    </div>
                  )}
                  {regGrades.map((g, i) => (
                    <div key={i} className="flex gap-2 items-center bg-white border border-gray-200 rounded-xl p-3">
                      <input value={g.grade_name} onChange={e => setRegGrades(prev => prev.map((gr, idx) => idx === i ? { ...gr, grade_name: e.target.value } : gr))}
                        placeholder="学年（例: 1年生）" className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                      <input value={g.color_name} onChange={e => setRegGrades(prev => prev.map((gr, idx) => idx === i ? { ...gr, color_name: e.target.value } : gr))}
                        placeholder="色名" className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                      <input type="color" value={g.color_hex || '#6366f1'} onChange={e => setRegGrades(prev => prev.map((gr, idx) => idx === i ? { ...gr, color_hex: e.target.value } : gr))}
                        className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer" />
                      <button onClick={() => setRegGrades(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 text-xs hover:text-red-600">削除</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setRegGrades(prev => [...prev, { id: '', school_id: selectedSchool.id, grade_name: '', color_name: '', color_hex: '#6366f1', sort_order: prev.length, created_at: '', updated_at: '', updated_by: '' }])}
                    className="flex-1 border-2 border-dashed border-gray-300 rounded-xl py-2.5 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                    + 追加
                  </button>
                  <button onClick={saveRegGrades} disabled={regSaving}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 transition-colors">
                    {regSaving ? '保存中...' : '💾 保存'}
                  </button>
                </div>
              </div>
            )}

            {/* 保護者の声 tab */}
            {schoolDetailTab === 'tips' && (
              <div className="space-y-2">
                {regTips.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">保護者からの投稿がありません</p>}
                {regTips.map(tip => (
                  <div key={tip.id} className={`border rounded-xl p-3 ${tip.approved ? 'border-green-300 bg-green-50' : 'bg-white border-gray-200'}`}>
                    {tip.item_name && <p className="text-xs text-indigo-600 font-bold mb-1">[{tip.item_name}]</p>}
                    <p className="text-sm text-gray-800 mb-2">{tip.tip_text}</p>
                    <div className="flex gap-2">
                      <button onClick={() => approveTip(tip.id, true)}
                        className={`flex-1 text-xs py-1.5 rounded-lg font-bold transition-colors ${tip.approved ? 'bg-green-600 text-white' : 'border border-green-500 text-green-600 hover:bg-green-50'}`}>
                        ✅ 承認して掲載
                      </button>
                      <button onClick={() => approveTip(tip.id, false)}
                        className={`flex-1 text-xs py-1.5 rounded-lg font-bold transition-colors ${!tip.approved ? 'bg-gray-400 text-white' : 'border border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
                        非承認
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* OCR取込 tab */}
            {schoolDetailTab === 'ocr' && (
              <div>
                {!ocrResult ? (
                  <div>
                    <div onClick={() => ocrFileRef.current?.click()}
                      className="border-2 border-dashed border-sky-300 bg-sky-50 rounded-2xl p-8 text-center cursor-pointer hover:bg-sky-100 transition-colors mb-4">
                      <div className="text-4xl mb-2">📷</div>
                      <p className="font-bold text-sky-700 mb-1">マニュアル・あんちょこを取り込む</p>
                      <p className="text-xs text-gray-400">JPG / PNG（複数枚まとめて選択可）</p>
                    </div>
                    <input ref={ocrFileRef} type="file" accept="image/*" multiple
                      onChange={e => {
                        const selected = Array.from(e.target.files ?? [])
                        setOcrFiles(selected)
                        const urls = selected.map(f => URL.createObjectURL(f))
                        setOcrPreviews(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return urls })
                      }}
                      className="hidden" />
                    {ocrPreviews.length > 0 && (
                      <div className="flex gap-2 flex-wrap mb-4">
                        {ocrPreviews.map((src, i) => (
                          <img key={i} src={src} alt="" className="w-20 h-24 object-cover rounded-xl border border-gray-200" />
                        ))}
                      </div>
                    )}
                    {ocrFiles.length > 0 && (
                      <button onClick={handleOcr} disabled={ocrLoading}
                        className="w-full bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-xl font-bold disabled:opacity-50 transition-colors">
                        {ocrLoading ? '🤖 AI読み取り中...' : `🤖 AI読み取り開始（${ocrFiles.length}枚）`}
                      </button>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-700 font-medium">
                      ✅ {ocrEditItems.length}アイテムを読み取りました。確認・編集してから保存してください。
                    </div>
                    <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl mb-4">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left px-3 py-2 font-bold text-gray-600 whitespace-nowrap">アイテム名</th>
                            <th className="px-2 py-2 font-bold text-gray-600">区分</th>
                            <th className="px-2 py-2 font-bold text-gray-600 whitespace-nowrap">品番</th>
                            <th className="px-2 py-2 font-bold text-gray-600 whitespace-nowrap">サイズ建て</th>
                            <th className="px-2 py-2 font-bold text-gray-600 whitespace-nowrap">税込価格</th>
                            <th className="px-2 py-2 font-bold text-orange-600 whitespace-nowrap">EO価格</th>
                            <th className="px-2 py-2 font-bold text-gray-500 whitespace-nowrap">仕入れ値</th>
                            <th className="px-2 py-2 font-bold text-gray-600 whitespace-nowrap">平均点数</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {ocrEditItems.map((item, i) => (
                            <tr key={i} className={item.confidence === 'low' ? 'bg-yellow-50' : item.required ? 'bg-green-50/50' : ''}>
                              <td className="px-2 py-1.5">
                                <div className="flex items-center gap-1">
                                  {item.confidence === 'low' && <span className="text-yellow-500">⚠</span>}
                                  <input value={item.name} onChange={e => setOcrEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, name: e.target.value } : it))}
                                    className="w-full bg-transparent min-w-[80px] focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1" />
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <select value={item.required ? 'true' : 'false'} onChange={e => setOcrEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, required: e.target.value === 'true' } : it))}
                                  className="text-xs bg-transparent focus:outline-none">
                                  <option value="true">必須</option>
                                  <option value="false">任意</option>
                                </select>
                              </td>
                              <td className="px-2 py-1.5">
                                <input value={(item as any).product_code ?? ''} onChange={e => setOcrEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, product_code: e.target.value } : it))}
                                  className="w-full bg-transparent min-w-[60px] focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1 font-mono" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input value={(item as any).size_spec ?? ''} onChange={e => setOcrEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, size_spec: e.target.value } : it))}
                                  className="w-full bg-transparent min-w-[80px] focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input value={item.price_tax_in ?? ''} type="number" onChange={e => setOcrEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, price_tax_in: e.target.value ? Number(e.target.value) : null } : it))}
                                  className="w-full bg-transparent min-w-[60px] focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1" />
                              </td>
                              <td className="px-2 py-1.5 bg-orange-50/50">
                                <input value={(item as any).eo_price_tax_in ?? ''} type="number" onChange={e => setOcrEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, eo_price_tax_in: e.target.value ? Number(e.target.value) : null } : it))}
                                  className="w-full bg-transparent min-w-[60px] focus:outline-none focus:ring-1 focus:ring-orange-300 rounded px-1" />
                              </td>
                              <td className="px-2 py-1.5 bg-gray-50/50">
                                <input value={(item as any).cost_price ?? ''} type="number" onChange={e => setOcrEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, cost_price: e.target.value ? Number(e.target.value) : null } : it))}
                                  className="w-full bg-transparent min-w-[60px] focus:outline-none focus:ring-1 focus:ring-gray-300 rounded px-1" />
                              </td>
                              <td className="px-2 py-1.5">
                                <input value={item.avg_qty ?? ''} type="number" step="0.5" onChange={e => setOcrEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, avg_qty: e.target.value ? Number(e.target.value) : null } : it))}
                                  className="w-full bg-transparent min-w-[40px] focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1" />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => { setOcrResult(null); setOcrFiles([]); setOcrPreviews([]) }}
                        className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors">
                        ← 撮り直す
                      </button>
                      <button onClick={saveOcrItems} disabled={regSaving}
                        className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors">
                        {regSaving ? '保存中...' : `✅ 一括保存（${ocrEditItems.length}アイテム）`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
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
                          {product.maker && <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-lg font-bold">{product.maker}</span>}
                          {product.maker_code && <span className="text-[10px] font-mono bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded-lg">品番: {product.maker_code}</span>}
                          {product.color_code && <span className="text-[10px] font-mono bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded-lg">色: {product.color_code}</span>}
                          {product.category && <span className="text-[10px] bg-teal-50 text-teal-700 border border-teal-200 px-1.5 py-0.5 rounded-lg">{product.category}</span>}
                          {product.gender && <span className="text-[10px] bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded-lg">{product.gender}</span>}
                          {product.barcode && <span className="text-[10px] font-mono bg-sky-50 text-sky-700 border border-sky-200 px-1.5 py-0.5 rounded-lg flex items-center gap-0.5"><ScanLine size={8} />{product.barcode.length > 13 ? product.barcode.slice(0, 13) + '…' : product.barcode}</span>}
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
                    {selectedProduct?.maker && <span className="text-[10px] text-amber-800 font-bold">{selectedProduct.maker}</span>}
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
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setStaffModal(false)}>
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
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSchoolModal(false)}>
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
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setProductModal(false)}>
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
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-gray-600">メーカー・仕入先</label>
                  <Link href={`/${storeId}/admin/master/suppliers`}
                    className="text-[10px] font-bold text-indigo-600 hover:underline">仕入先マスタを編集 →</Link>
                </div>
                <div className="grid grid-cols-3 gap-1.5 mb-2">
                  {(supplierNames.length ? supplierNames : ['トンボ', 'カンコー', 'スクールフォーラム', '明石スクール', '富士ヨット', 'テイコク']).map(m => (
                    <button key={m} type="button"
                      onClick={() => setPMakerName(pMakerName === m ? '' : m)}
                      className={`py-2.5 rounded-xl text-sm font-bold border transition-all active:scale-95 ${
                        pMakerName === m
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                          : 'bg-white border-gray-300 text-gray-700 hover:border-indigo-400 hover:text-indigo-700'
                      }`}>{m}</button>
                  ))}
                </div>
                <input type="text" value={pMakerName} onChange={e => setPMakerName(e.target.value)}
                  placeholder={supplierNames.length ? '一覧にない場合は直接入力' : '上記以外は直接入力'} className={INPUT} />
                {!supplierNames.length && (
                  <p className="text-[10px] text-gray-400 mt-1">仕入先マスタに登録すると、ここに候補が表示されます。</p>
                )}
              </div>
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
              <Field label="バーコード・QRコード">
                <div className="flex gap-2">
                  <input type="text" value={pBarcode} onChange={e => setPBarcode(e.target.value)}
                    placeholder="例：4901234567890" className={`${INPUT} flex-1 font-mono text-xs`} />
                  <button type="button" onClick={() => pScanRef.current?.click()} disabled={pScanLoading}
                    className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-xl transition-all active:scale-95 disabled:opacity-60">
                    {pScanLoading ? <Loader2 size={13} className="animate-spin" /> : <ScanLine size={13} />}
                    {pScanLoading ? '読取中...' : 'タグ撮影'}
                  </button>
                  <input ref={pScanRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleTagScan(f); e.target.value = '' }} />
                </div>
                <p className="text-[10px] text-gray-400 mt-0.5">タグを撮影するとAIが品名・品番・バーコードを自動入力します</p>
              </Field>
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
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm" onClick={() => setVariantModal(false)}>
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
