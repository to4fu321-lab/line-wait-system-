'use client'

// ============================================================
// 顧客ページ用フォーム群（app/[storeId]/page.tsx から分割）
//   - AddChildForm: お子様追加
//   - WaitingCustomerEditForm: 待ち時間中の顧客情報編集
//   - ChildEditInline: お子様情報インライン編集
//   - WaitingFirstChildForm: 待ち中の保護者＋お子様一括登録
// ============================================================
import { useState } from 'react'
import { AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Customer, Child } from '@/types/crm'
import { GRADE_OPTIONS, SCHOOL_OPTIONS } from '@/types/crm'
import { useStoreTheme } from '@/lib/theme-context'
import { useKanaAutoFill } from '@/lib/useKanaAutoFill'

// ── お子様追加フォーム ──────────────────────────────────────
export function AddChildForm({
  onSubmit,
  onCancel,
  submitting,
  schoolOptions,
  schools,
}: {
  onSubmit: (d: { childName: string; childKana: string; schoolName: string; schoolId: string; grade: string; heightCm: string; weightKg: string; gender: string }) => Promise<void>
  onCancel?: () => void
  submitting: boolean
  schoolOptions?: string[]
  schools?: { id: string; name: string }[]
}) {
  const theme = useStoreTheme()
  const child = useKanaAutoFill('')
  const [schoolId,   setSchoolId]   = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [grade,      setGrade]      = useState('')
  const [heightCm,   setHeightCm]   = useState('')
  const [weightKg,   setWeightKg]   = useState('')
  const [gender,     setGender]     = useState('')
  const [error,      setError]      = useState('')

  const useSchoolPicker = !!(schools && schools.length > 0)
  const effectiveSchoolOptions = !useSchoolPicker && schoolOptions && schoolOptions.length > 0 ? schoolOptions : SCHOOL_OPTIONS
  const resolvedSchoolName = useSchoolPicker ? (schools!.find(s => s.id === schoolId)?.name ?? '') : schoolName
  const resolvedSchoolId   = useSchoolPicker ? schoolId : ''

  const handleSubmit = async () => {
    if (!child.name.trim()) { setError('お名前を入力してください'); return }
    if (!(useSchoolPicker ? schoolId : schoolName)) { setError('学校名を選択してください'); return }
    if (!grade)             { setError('学年を選択してください'); return }
    if (!gender)            { setError('性別を選択してください'); return }
    setError('')
    await onSubmit({ childName: child.name.trim(), childKana: child.kana.trim(), schoolName: resolvedSchoolName.trim(), schoolId: resolvedSchoolId, grade, heightCm, weightKg, gender })
  }

  const base  = 'w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50/80 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all'
  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = theme.colors.primary)
  const blur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = '')

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">お名前 <span className="text-red-500">*</span></label>
        <input type="text" {...child.nameProps} placeholder="例：山田 次郎" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">フリガナ</label>
        <input type="text" {...child.kanaProps} placeholder="ヤマダ ジロウ" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1.5">学校名 <span className="text-red-500">*</span></label>
          {useSchoolPicker ? (
            <select value={schoolId} onChange={e => setSchoolId(e.target.value)} className={base} onFocus={focus} onBlur={blur}>
              <option value="">選択してください</option>
              {schools!.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : (
            <select value={schoolName} onChange={e => setSchoolName(e.target.value)} className={base} onFocus={focus} onBlur={blur}>
              <option value="">選択してください</option>
              {effectiveSchoolOptions.map(s => <option key={s} value={s === 'その他' ? '' : s}>{s}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1.5">学年 <span className="text-red-500">*</span></label>
          <select value={grade} onChange={e => setGrade(e.target.value)} className={base} onFocus={focus} onBlur={blur}>
            <option value="">選択</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">性別 <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setGender('male')}
            className={`py-2 rounded-xl border-2 text-sm font-bold transition-all ${gender === 'male' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-zinc-100 bg-zinc-50/80 text-zinc-500'}`}>
            男子
          </button>
          <button type="button" onClick={() => setGender('female')}
            className={`py-2 rounded-xl border-2 text-sm font-bold transition-all ${gender === 'female' ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-zinc-100 bg-zinc-50/80 text-zinc-500'}`}>
            女子
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1.5">身長 (cm) <span className="text-red-500">*</span></label>
          <input type="number" inputMode="decimal" value={heightCm} onChange={e => setHeightCm(e.target.value)}
            placeholder="例：158" className={base} onFocus={focus} onBlur={blur} />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1.5">体重 (kg)</label>
          <input type="number" inputMode="decimal" value={weightKg} onChange={e => setWeightKg(e.target.value)}
            placeholder="例：48" className={base} onFocus={focus} onBlur={blur} />
        </div>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <div className="flex gap-2">
        {onCancel && (
          <button onClick={onCancel} className="flex-1 py-3 rounded-xl border border-zinc-200 text-zinc-500 font-bold text-sm active:scale-95 transition-transform">
            キャンセル
          </button>
        )}
        <button onClick={handleSubmit} disabled={submitting || !child.name.trim()}
          className="flex-1 py-3 rounded-xl text-white font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})` }}>
          {submitting ? <Loader2 size={14} className="animate-spin" /> : '追加する'}
        </button>
      </div>
    </div>
  )
}

// ── 待ち時間中の顧客情報編集フォーム ──────────────────────
export function WaitingCustomerEditForm({
  customer, selectedChild, schoolOptions, onSaved, onChildSaved, onClose,
}: {
  customer: Customer
  selectedChild?: Child | null
  schoolOptions?: string[]
  onSaved: (c: Customer) => void
  onChildSaved?: (c: Child) => void
  onClose: () => void
}) {
  const theme = useStoreTheme()
  const [name,       setName]       = useState(customer.name)
  const [kana,       setKana]       = useState(customer.kana ?? '')
  const [tel,        setTel]        = useState(customer.tel ?? '')
  const [childName,  setChildName]  = useState(selectedChild?.name ?? '')
  const [childKana,  setChildKana]  = useState(selectedChild?.kana ?? '')
  const [schoolName, setSchoolName] = useState(selectedChild?.school_name ?? '')
  const [grade,      setGrade]      = useState(selectedChild?.grade ?? '')
  const [saving,     setSaving]     = useState(false)

  const effectiveSchoolOptions = schoolOptions && schoolOptions.length > 0 ? schoolOptions : SCHOOL_OPTIONS
  const base = 'w-full text-sm text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all'
  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = theme.colors.primary)
  const blur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = '')

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const [custResult, childResult] = await Promise.all([
      ((supabase as any).from('customers') as any)
        .update({ name: name.trim(), kana: kana.trim() || null, tel: tel.trim() || null })
        .eq('id', customer.id).select().single(),
      selectedChild
        ? ((supabase as any).from('children') as any)
            .update({ name: childName.trim() || selectedChild.name, kana: childKana.trim() || null, school_name: schoolName.trim() || null, grade: grade || null })
            .eq('id', selectedChild.id).select().single()
        : Promise.resolve({ data: null, error: null }),
    ])
    setSaving(false)
    if (!custResult.error && custResult.data) onSaved(custResult.data as Customer)
    if (!childResult.error && childResult.data && onChildSaved) onChildSaved(childResult.data as Child)
    onClose()
  }

  return (
    <div className="mt-3 pt-3 border-t border-zinc-100 space-y-3">
      <p className="text-xs font-bold mb-1" style={{ color: theme.colors.primary }}>保護者情報</p>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1">お名前</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="山田 太郎" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1">フリガナ</label>
        <input type="text" value={kana} onChange={e => setKana(e.target.value)} placeholder="ヤマダ タロウ" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1">電話番号</label>
        <input type="tel" inputMode="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="090-1234-5678" className={base} onFocus={focus} onBlur={blur} />
      </div>

      {selectedChild && (
        <>
          <p className="text-xs font-bold pt-2 border-t border-zinc-100" style={{ color: theme.colors.primary }}>お子様情報（{selectedChild.name}）</p>
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">お名前</label>
            <input type="text" value={childName} onChange={e => setChildName(e.target.value)} placeholder="山田 花子" className={base} onFocus={focus} onBlur={blur} />
          </div>
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1">フリガナ</label>
            <input type="text" value={childKana} onChange={e => setChildKana(e.target.value)} placeholder="ヤマダ ハナコ" className={base} onFocus={focus} onBlur={blur} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">学校名</label>
              <select value={schoolName} onChange={e => setSchoolName(e.target.value)} className={base} onFocus={focus} onBlur={blur}>
                <option value="">選択してください</option>
                {effectiveSchoolOptions.map(s => <option key={s} value={s === 'その他' ? '' : s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 mb-1">学年</label>
              <select value={grade} onChange={e => setGrade(e.target.value)} className={base} onFocus={focus} onBlur={blur}>
                <option value="">選択</option>
                {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          </div>
        </>
      )}

      <div className="flex gap-2 pt-1">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-500 text-sm font-bold active:scale-95 transition-transform">キャンセル</button>
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})` }}>
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  )
}

// ── お子様情報インライン編集 ───────────────────────────────
export function ChildEditInline({ child, schools, gradeOptions, onSaved, onClose }: {
  child: Child
  schools: { id: string; name: string }[]
  gradeOptions: string[]
  onSaved: (c: Child) => void
  onClose: () => void
}) {
  const theme = useStoreTheme()
  const [name,     setName]     = useState(child.name)
  const [schoolId, setSchoolId] = useState(
    child.school_id ?? schools.find(s => s.name === child.school_name)?.id ?? ''
  )
  const [grade,    setGrade]    = useState(child.grade ?? '')
  const [gender,   setGender]   = useState(child.gender && child.gender !== 'other' ? child.gender : '')
  const [saving,   setSaving]   = useState(false)
  const base = 'w-full text-sm text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:outline-none transition-all'

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    const school = schools.find(s => s.id === schoolId)
    const { data, error } = await ((supabase as any).from('children') as any)
      .update({ name: name.trim(), school_id: school?.id ?? null, school_name: school?.name ?? null, grade: grade || null, gender: gender || null })
      .eq('id', child.id).select().single()
    setSaving(false)
    if (!error && data) { onSaved(data as Child); onClose() }
  }

  return (
    <div className="space-y-3 pt-3 border-t border-zinc-100">
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1">お名前</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} className={base} />
      </div>
      {schools.length > 0 && (
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">学校名</label>
          <select value={schoolId} onChange={e => setSchoolId(e.target.value)} className={base}>
            <option value="">選択してください</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">学年</label>
          <select value={grade} onChange={e => setGrade(e.target.value)} className={base}>
            <option value="">選択</option>
            {gradeOptions.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">性別</label>
          <select value={gender} onChange={e => setGender(e.target.value)} className={base}>
            <option value="">選択</option>
            <option value="male">男子</option>
            <option value="female">女子</option>
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-zinc-200 text-zinc-500 text-sm font-bold active:scale-95 transition-transform">キャンセル</button>
        <button onClick={handleSave} disabled={saving || !name.trim()}
          className="flex-1 py-2.5 rounded-xl text-white text-sm font-bold disabled:opacity-50 active:scale-95 transition-transform"
          style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})` }}>
          {saving ? '保存中...' : '保存する'}
        </button>
      </div>
    </div>
  )
}

// ── 待ち中：保護者＋お子様 一括登録フォーム ──────────────
export function WaitingFirstChildForm({
  customer, schools: schoolsList, storeId, ticketId, onSaved,
}: {
  customer: Customer
  schools: { id: string; name: string }[]
  storeId: string
  ticketId: string | null
  onSaved: (c: Customer, ch: Child) => void
}) {
  const theme = useStoreTheme()
  const parent = useKanaAutoFill(customer.name, customer.kana ?? undefined)
  const [tel,      setTel]      = useState(customer.tel ?? '')
  const child = useKanaAutoFill('')
  const [schoolId,   setSchoolId]   = useState('')
  const [schoolName, setSchoolName] = useState('')
  const [grade,      setGrade]      = useState('')
  const [heightCm,   setHeightCm]   = useState('')
  const [weightKg,   setWeightKg]   = useState('')
  const [gender,     setGender]     = useState('')
  const [error,      setError]      = useState('')
  const [saving,     setSaving]     = useState(false)

  const useSchoolPicker = schoolsList.length > 0
  const effectiveSchoolOptions = useSchoolPicker ? [] : SCHOOL_OPTIONS
  const resolvedSchoolName = useSchoolPicker ? (schoolsList.find(s => s.id === schoolId)?.name ?? '') : schoolName
  const resolvedSchoolId   = useSchoolPicker ? schoolId : ''

  const base  = 'w-full text-sm text-zinc-900 border-2 border-zinc-100 bg-zinc-50 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all'
  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = theme.colors.primary)
  const blur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = '')

  const handleSave = async () => {
    if (!parent.name.trim()) { setError('保護者のお名前を入力してください'); return }
    if (!child.name.trim())  { setError('お子様のお名前を入力してください'); return }
    if (!(useSchoolPicker ? schoolId : schoolName)) { setError('学校名を選択してください'); return }
    if (!grade)               { setError('学年を選択してください'); return }
    if (!gender)              { setError('性別を選択してください'); return }
    setSaving(true); setError('')
    try {
      const [custResult, childResult] = await Promise.all([
        ((supabase as any).from('customers') as any)
          .update({ name: parent.name.trim(), kana: parent.kana.trim() || null, tel: tel.trim() || null })
          .eq('id', customer.id).select().single(),
        (supabase as any).from('children').insert({
          customer_id: customer.id, store_id: storeId,
          name: child.name.trim(), kana: child.kana.trim() || null,
          school_id: resolvedSchoolId || null, school_name: resolvedSchoolName.trim() || null,
          grade: grade || null, gender: gender || null,
        }).select().single(),
      ])
      if (custResult.error) throw new Error(custResult.error.message)
      if (childResult.error) throw new Error(childResult.error.message)
      const updatedCust = custResult.data as Customer
      const newChild    = childResult.data as Child
      if (ticketId) {
        const qUpdate: Record<string, unknown> = {
          customer_name: parent.name.trim(),
          customer_id:   customer.id,
          child_name:    child.name.trim() || null,
          child_id:      newChild.id,
          school_name:   resolvedSchoolName.trim() || null,
          gender:        gender || null,
        }
        if (heightCm) qUpdate.details = { height: heightCm, ...(weightKg ? { weight: weightKg } : {}) }
        await (supabase as any).from('queues').update(qUpdate).eq('id', ticketId)
      }
      onSaved(updatedCust, newChild)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存に失敗しました')
    }
    setSaving(false)
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-black tracking-wider pt-1" style={{ color: theme.colors.primary }}>保護者情報</p>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1">お名前 <span className="text-red-500">*</span></label>
        <input type="text" {...parent.nameProps} placeholder="例：山田 太郎" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1">フリガナ</label>
        <input type="text" {...parent.kanaProps} placeholder="ヤマダ タロウ" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1">電話番号</label>
        <input type="tel" inputMode="tel" value={tel} onChange={e => setTel(e.target.value)} placeholder="090-1234-5678" className={base} onFocus={focus} onBlur={blur} />
      </div>

      <p className="text-xs font-black tracking-wider pt-2 border-t border-zinc-100" style={{ color: theme.colors.primary }}>お子様情報</p>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1">お名前 <span className="text-red-500">*</span></label>
        <input type="text" {...child.nameProps} placeholder="例：山田 花子" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1">フリガナ</label>
        <input type="text" {...child.kanaProps} placeholder="ヤマダ ハナコ" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">学校名 <span className="text-red-500">*</span></label>
          {useSchoolPicker ? (
            <select value={schoolId} onChange={e => setSchoolId(e.target.value)} className={base} onFocus={focus} onBlur={blur}>
              <option value="">選択してください</option>
              {schoolsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : (
            <select value={schoolName} onChange={e => setSchoolName(e.target.value)} className={base} onFocus={focus} onBlur={blur}>
              <option value="">選択してください</option>
              {effectiveSchoolOptions.map(s => <option key={s} value={s === 'その他' ? '' : s}>{s}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">学年 <span className="text-red-500">*</span></label>
          <select value={grade} onChange={e => setGrade(e.target.value)} className={base} onFocus={focus} onBlur={blur}>
            <option value="">選択</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1">性別 <span className="text-red-500">*</span></label>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setGender('male')}
            className={`py-2 rounded-xl border-2 text-sm font-bold transition-all ${gender === 'male' ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-zinc-100 bg-zinc-50 text-zinc-500'}`}>
            男子
          </button>
          <button type="button" onClick={() => setGender('female')}
            className={`py-2 rounded-xl border-2 text-sm font-bold transition-all ${gender === 'female' ? 'border-pink-400 bg-pink-50 text-pink-700' : 'border-zinc-100 bg-zinc-50 text-zinc-500'}`}>
            女子
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">身長 (cm)</label>
          <input type="number" inputMode="decimal" value={heightCm} onChange={e => setHeightCm(e.target.value)} placeholder="例：158" className={base} onFocus={focus} onBlur={blur} />
        </div>
        <div>
          <label className="block text-xs font-bold text-zinc-500 mb-1">体重 (kg)</label>
          <input type="number" inputMode="decimal" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="例：48" className={base} onFocus={focus} onBlur={blur} />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <button onClick={handleSave} disabled={saving || !parent.name.trim() || !child.name.trim()}
        className="w-full py-3.5 rounded-xl text-white font-black text-sm disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
        style={{ background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})` }}>
        {saving ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '保存する'}
      </button>
    </div>
  )
}

