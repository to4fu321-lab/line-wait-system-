'use client'

// ============================================================
// スタッフマスタ（/admin/master?tab=staff）
//   このページの旧「学校・商品マスタ」「お直し料金マスタ」は
//   /master/manage, /master/repair へ移行済み（該当タブはリダイレクト）。
//   以前は移行前の学校/商品/バリエーション/OCR取込のUIが到達不能な
//   まま残っていたため削除し、スタッフ管理のみに整理した。
// ============================================================

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import {
  ChevronLeft, Plus, Pencil, Trash2,
  GraduationCap, Loader2, X, Users, UserCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Staff } from '@/types/master'
import { STAFF_ROLE_OPTIONS, STAFF_COLOR_OPTIONS, EMPLOYMENT_TYPE_OPTIONS } from '@/types/master'
import { parsePlanLimitError, ownerPlanLimitMessage } from '@/lib/planLimitError'
import type { Availability } from '@/lib/availability'
import { AvailabilityEditor } from './_components/AvailabilityEditor'
import { Toast } from '@/app/_components/Toast'
import { Field } from '@/app/_components/Field'

type MasterTab = 'schools' | 'staff' | 'presets'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

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

  const initialTab = (searchParams?.get('tab') ?? (isSimpleMode ? 'presets' : 'schools')) as MasterTab

  // 「学校・商品」は /master/manage、「お直し料金」は /master/repair へ移行済み
  useEffect(() => {
    if (!storeId) return
    if (initialTab === 'schools') router.replace(`/${storeId}/admin/master/manage`)
    if (initialTab === 'presets') router.replace(`/${storeId}/admin/master/repair`)
  }, [initialTab, router, storeId])

  // ── Staff state ───────────────────────────────────────────
  const [staffList,          setStaffList]          = useState<Staff[]>([])
  const [staffLoading,       setStaffLoading]       = useState(true)
  const [staffModal,         setStaffModal]         = useState(false)
  const [editingStaff,       setEditingStaff]       = useState<Staff | null>(null)
  const [sfName,             setSfName]             = useState('')
  const [sfKana,             setSfKana]             = useState('')
  const [sfRole,             setSfRole]             = useState('')
  const [sfColor,            setSfColor]            = useState<string>(STAFF_COLOR_OPTIONS[0])
  const [sfPin,              setSfPin]              = useState('')
  const [sfWage,             setSfWage]             = useState('')
  const [sfTel,              setSfTel]              = useState('')
  const [sfEmployment,       setSfEmployment]       = useState('')
  const [sfSkill,            setSfSkill]            = useState(0)
  const [sfMaxWeekly,        setSfMaxWeekly]        = useState('')
  const [sfMaxDaily,         setSfMaxDaily]         = useState('')
  const [sfCommute,          setSfCommute]          = useState('')
  const [sfAvail,            setSfAvail]            = useState<Availability | null>(null)
  const [sfSaving,           setSfSaving]           = useState(false)
  const [deleteStaffTarget,  setDeleteStaffTarget]  = useState<Staff | null>(null)
  const [deleteStaffLoading, setDeleteStaffLoading] = useState(false)

  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const showToast = useCallback((type: 'ok' | 'err', msg: string) => setToast({ type, msg }), [])

  const fetchStaff = useCallback(async () => {
    if (!storeId) return
    setStaffLoading(true)
    const { data, error } = await supabase
      .from('staff').select('*').eq('store_id', storeId)
      .order('sort_order').order('name')
    setStaffLoading(false)
    if (error) { showToast('err', `スタッフ取得失敗: ${error.message}`); return }
    setStaffList((data ?? []) as Staff[])
  }, [storeId, showToast])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  // ── Staff CRUD ────────────────────────────────────────────
  const resetStaffExtra = (s?: Staff) => {
    setSfWage(s?.hourly_wage != null ? String(s.hourly_wage) : '')
    setSfTel(s?.tel ?? '')
    setSfEmployment(s?.employment_type ?? '')
    setSfSkill(s?.skill_level ?? 0)
    setSfMaxWeekly(s?.max_weekly_hours != null ? String(s.max_weekly_hours) : '')
    setSfMaxDaily(s?.max_daily_hours != null ? String(s.max_daily_hours) : '')
    setSfCommute(s?.commute_min != null ? String(s.commute_min) : '')
    setSfAvail(s?.availability ?? null)
  }
  const openStaffAdd  = () => { setEditingStaff(null); setSfName(''); setSfKana(''); setSfRole(''); setSfColor(STAFF_COLOR_OPTIONS[0]); setSfPin(''); resetStaffExtra(); setStaffModal(true) }
  const openStaffEdit = (s: Staff) => { setEditingStaff(s); setSfName(s.name); setSfKana(s.kana ?? ''); setSfRole(s.role ?? ''); setSfColor(s.color ?? STAFF_COLOR_OPTIONS[0]); setSfPin(s.pin ?? ''); resetStaffExtra(s); setStaffModal(true) }

  const handleStaffSave = async () => {
    if (!sfName.trim()) return
    setSfSaving(true)
    const payload = {
      name: sfName.trim(), kana: sfKana.trim() || null, role: sfRole || null, color: sfColor, pin: sfPin.trim() || null,
      hourly_wage: sfWage.trim() ? Number(sfWage) : null,
      tel: sfTel.trim() || null,
      employment_type: sfEmployment || null,
      skill_level: sfSkill > 0 ? sfSkill : null,
      max_weekly_hours: sfMaxWeekly.trim() ? Number(sfMaxWeekly) : null,
      max_daily_hours: sfMaxDaily.trim() ? Number(sfMaxDaily) : null,
      commute_min: sfCommute.trim() ? Number(sfCommute) : null,
      availability: sfAvail,
      updated_at: new Date().toISOString(),
    }
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
      if (error) {
        const limitMetric = parsePlanLimitError(error.message)
        showToast('err', limitMetric ? ownerPlanLimitMessage(limitMetric) : '追加失敗')
        return
      }
      setStaffList(prev => [...prev, data as Staff])
      showToast('ok', 'スタッフを追加しました')
    }
    setStaffModal(false)
  }

  const handleStaffDelete = async () => {
    if (!deleteStaffTarget) return
    setDeleteStaffLoading(true)
    const { error } = await supabase.from('staff').delete().eq('id', deleteStaffTarget.id)
    setDeleteStaffLoading(false)
    if (error) { showToast('err', '削除失敗'); return }
    setStaffList(prev => prev.filter(s => s.id !== deleteStaffTarget.id))
    showToast('ok', 'スタッフを削除しました')
    setDeleteStaffTarget(null)
  }

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
      <div className="sticky top-0 z-20 bg-gradient-to-r from-emerald-700 to-teal-700 shadow-lg" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-3 px-4 pt-3.5 pb-2 max-w-lg mx-auto">
          <button onClick={() => router.push(`/${storeId}/admin/settings/staff`)} className="p-1 -ml-1 text-white/80 hover:text-white active:scale-90 transition-all">
            <ChevronLeft size={22} />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-black text-base">スタッフマスタ</h1>
          </div>
        </div>
        {/* タブ切替バー — 学校・商品は再設計版ページへ */}
        {!isSimpleMode && (
          <div className="flex gap-1 mx-4 mb-2.5 bg-white/10 rounded-xl p-1">
            <button onClick={() => router.push(`/${storeId}/admin/master/manage`)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold text-white/70 hover:text-white transition-all">
              <GraduationCap size={13} />学校・商品
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-bold bg-white text-emerald-700 shadow-sm">
              <Users size={13} />スタッフ
            </button>
          </div>
        )}
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto space-y-3">
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
                    {staff.employment_type && (
                      <span className="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded-full font-bold">
                        {staff.employment_type}
                      </span>
                    )}
                    {staff.hourly_wage != null && (
                      <span className="text-[10px] text-gray-500 font-bold">¥{staff.hourly_wage.toLocaleString()}/h</span>
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

              {/* ── 勤務情報（シフト・人件費・自動生成に使用）── */}
              <div className="pt-1 border-t border-gray-100">
                <p className="text-[11px] font-black text-gray-400 mt-2 mb-1">勤務情報</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="時給（円）">
                  <input type="number" inputMode="numeric" min={0} step={10} value={sfWage}
                    onChange={e => setSfWage(e.target.value)} placeholder="例：1100" className={INPUT} />
                </Field>
                <Field label="電話番号">
                  <input type="tel" value={sfTel} onChange={e => setSfTel(e.target.value)}
                    placeholder="090-1234-5678" className={INPUT} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Field label="雇用形態">
                  <select value={sfEmployment} onChange={e => setSfEmployment(e.target.value)} className={INPUT}>
                    <option value="">未設定</option>
                    {EMPLOYMENT_TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="通勤時間（分）">
                  <input type="number" inputMode="numeric" min={0} step={5} value={sfCommute}
                    onChange={e => setSfCommute(e.target.value)} placeholder="例：20" className={INPUT} />
                </Field>
              </div>
              <Field label="スキル（接客・採寸の習熟度）">
                <div className="flex gap-1.5 pt-0.5">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} type="button" onClick={() => setSfSkill(sfSkill === n ? 0 : n)}
                      className={`w-9 h-9 rounded-lg text-sm font-black transition-all ${
                        sfSkill >= n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400'
                      }`}>★</button>
                  ))}
                  <span className="self-center text-xs text-gray-400 ml-1">{sfSkill > 0 ? `Lv.${sfSkill}` : '未設定'}</span>
                </div>
              </Field>
              <div className="grid grid-cols-2 gap-2">
                <Field label="週の上限時間">
                  <input type="number" inputMode="numeric" min={0} step={1} value={sfMaxWeekly}
                    onChange={e => setSfMaxWeekly(e.target.value)} placeholder="例：28" className={INPUT} />
                </Field>
                <Field label="1日の上限時間">
                  <input type="number" inputMode="numeric" min={0} step={1} value={sfMaxDaily}
                    onChange={e => setSfMaxDaily(e.target.value)} placeholder="例：8" className={INPUT} />
                </Field>
              </div>
              <Field label="勤務可能曜日（固定の希望日程）">
                <AvailabilityEditor value={sfAvail} onChange={setSfAvail} />
                <p className="text-[10px] text-gray-400 mt-1">「希望から下書き」やAI自動生成・欠員補充の判定に使われます</p>
              </Field>
            </div>
            <button onClick={handleStaffSave} disabled={!sfName.trim() || sfSaving}
              className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-emerald-600 to-teal-600 text-white disabled:opacity-50 flex items-center justify-center gap-2 active:scale-[0.98] transition-all">
              {sfSaving ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '保存する'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MasterPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={26} className="animate-spin text-gray-300" />
      </div>
    }>
      <MasterPageInner />
    </Suspense>
  )
}
