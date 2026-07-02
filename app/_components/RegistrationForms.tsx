'use client'

import { useState } from 'react'
import { Loader2, AlertCircle } from 'lucide-react'
import { GRADE_OPTIONS, SCHOOL_OPTIONS } from '@/types/crm'
import { useStoreTheme } from '@/lib/theme-context'
import { useKanaAutoFill } from '@/lib/useKanaAutoFill'

// ── 初回登録フォーム（保護者 + お子様）──────────────────────
// 順番待ち受付・QR会員登録の両方で共用する（フォームを一本化）。
export function InitialRegistrationForm({
  lineDisplayName,
  onSubmit,
  submitting,
  schoolOptions,
  schools,
}: {
  lineDisplayName: string
  onSubmit: (d: { parentName: string; parentKana: string; tel: string; childName: string; childKana: string; schoolName: string; schoolId: string; grade: string; heightCm: string; weightKg: string; gender: string }) => Promise<void>
  submitting: boolean
  schoolOptions?: string[]
  schools?: { id: string; name: string }[]
}) {
  const theme  = useStoreTheme()
  const parent = useKanaAutoFill(lineDisplayName)
  const child  = useKanaAutoFill('')
  const [tel,        setTel]        = useState('')
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
    if (!parent.name.trim()) { setError('保護者のお名前を入力してください'); return }
    if (!child.name.trim())  { setError('お子様のお名前を入力してください'); return }
    if (!(useSchoolPicker ? schoolId : schoolName)) { setError('学校名を選択してください'); return }
    if (!grade)              { setError('学年を選択してください'); return }
    if (!gender)             { setError('性別を選択してください'); return }
    setError('')
    await onSubmit({
      parentName: parent.name.trim(), parentKana: parent.kana.trim(),
      tel: tel.trim(), childName: child.name.trim(), childKana: child.kana.trim(),
      schoolName: resolvedSchoolName.trim(), schoolId: resolvedSchoolId,
      grade, heightCm, weightKg, gender,
    })
  }

  const base  = 'w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50/80 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all'
  const focus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = theme.colors.primary)
  const blur  = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => (e.currentTarget.style.borderColor = '')

  return (
    <div className="space-y-3">
      {/* 保護者名・電話番号 */}
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">保護者のお名前 <span className="text-red-500">*</span></label>
        <input type="text" {...parent.nameProps} placeholder="例：山田 太郎" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">電話番号</label>
        <input type="tel" inputMode="tel" value={tel} placeholder="例：090-1234-5678" className={base}
          onChange={e => setTel(e.target.value)} onFocus={focus} onBlur={blur} />
      </div>

      {/* お子様情報 */}
      <div className="border-t border-zinc-200 pt-3 mt-1">
        <p className="text-xs font-bold text-zinc-400 mb-2.5">お子様情報</p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-zinc-500 mb-1.5">お名前 <span className="text-red-500">*</span></label>
            <input type="text" {...child.nameProps} placeholder="例：山田 花子" className={base} onFocus={focus} onBlur={blur} />
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
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}

      <button onClick={handleSubmit} disabled={submitting || !parent.name.trim() || !child.name.trim()}
        className="w-full text-white text-base font-black py-4 rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
          boxShadow:  `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.45)`,
        }}>
        {submitting ? <><Loader2 size={18} className="animate-spin" />登録中...</> : '登録して進む'}
      </button>
    </div>
  )
}

// ── シンプルモード登録フォーム（名前 + 電話のみ）────────────
export function SimpleRegistrationForm({
  lineDisplayName,
  onSubmit,
  submitting,
}: {
  lineDisplayName: string
  onSubmit: (d: { name: string; tel: string }) => Promise<void>
  submitting: boolean
}) {
  const theme = useStoreTheme()
  const [name, setName] = useState(lineDisplayName)
  const [tel,  setTel]  = useState('')
  const [error, setError] = useState('')
  const base  = 'w-full text-base text-zinc-900 border-2 border-zinc-100 bg-zinc-50/80 rounded-xl px-3 py-2.5 focus:bg-white focus:outline-none transition-all'
  const focus = (e: React.FocusEvent<HTMLInputElement>) => (e.currentTarget.style.borderColor = theme.colors.primary)
  const blur  = (e: React.FocusEvent<HTMLInputElement>) => (e.currentTarget.style.borderColor = '')

  const handleSubmit = async () => {
    if (!name.trim()) { setError('お名前を入力してください'); return }
    setError('')
    await onSubmit({ name: name.trim(), tel: tel.trim() })
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">お名前 <span className="text-red-500">*</span></label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="例：山田 太郎" className={base} onFocus={focus} onBlur={blur} />
      </div>
      <div>
        <label className="block text-xs font-bold text-zinc-500 mb-1.5">電話番号</label>
        <input type="tel" inputMode="tel" value={tel} onChange={e => setTel(e.target.value)}
          placeholder="例：090-1234-5678" className={base} onFocus={focus} onBlur={blur} />
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <button onClick={handleSubmit} disabled={submitting || !name.trim()}
        className="w-full text-white text-base font-black py-4 rounded-2xl disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95 transition-transform"
        style={{
          background: `linear-gradient(135deg, ${theme.colors.primary}, ${theme.colors.primaryDark})`,
          boxShadow: `0 12px 30px -8px rgb(${theme.colors.primaryRgb} / 0.45)`,
        }}>
        {submitting ? <><Loader2 size={18} className="animate-spin" />登録中...</> : '登録して完了'}
      </button>
    </div>
  )
}
