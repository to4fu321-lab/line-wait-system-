'use client'

import { useState, useEffect } from 'react'
import {
  Loader2, Phone, GraduationCap, User,
  Pencil, AlertCircle, X,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { Customer, Child } from '@/types/crm'
import { GRADE_OPTIONS } from '@/types/crm'
import type { CustomerInfoData } from './types'

interface SchoolOption { id: string; name: string }

function useSchools(storeId: string) {
  const [schools, setSchools] = useState<SchoolOption[]>([])
  useEffect(() => {
    if (!storeId) return
    supabase.from('schools').select('id, name').eq('store_id', storeId).eq('active', true)
      .order('sort_order').then(({ data }) => setSchools((data as SchoolOption[] | null) ?? []))
  }, [storeId])
  return schools
}

// ============================================================
// 共通フィールドラベル
// ============================================================
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-600 mb-1.5">
        {label}{required && <span className="text-red-600 ml-1">*</span>}
      </label>
      {children}
    </div>
  )
}

// ============================================================
// 顧客情報インラインパネル（お直し・取置きカード内）
// ============================================================
export function CustomerInfoPanel({ customerId, storeId }: { customerId: string; storeId: string }) {
  const [data, setData]       = useState<CustomerInfoData | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('customers').select('id, name, kana, tel, children(id, name, school_name, grade)')
      .eq('id', customerId).single()
      .then(({ data: d }) => { setData(d as CustomerInfoData | null); setLoading(false) })
  }, [customerId])
  if (loading) return <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-gray-500" /></div>
  if (!data)   return <p className="text-gray-400 text-xs">顧客情報なし</p>
  return (
    <div className="space-y-1.5">
      {data.kana && <p className="text-gray-600 text-xs">{data.kana}</p>}
      {data.tel  && (
        <a href={`tel:${data.tel}`} className="flex items-center gap-1.5 text-blue-600 text-xs font-bold">
          <Phone size={11} />{data.tel}
        </a>
      )}
      {(data.children ?? []).map(c => (
        <div key={c.id} className="flex items-center gap-1.5">
          <GraduationCap size={11} className="text-amber-600 shrink-0" />
          <span className="text-amber-600 text-xs font-bold">{c.name}</span>
          {c.school_name && <span className="text-gray-500 text-xs truncate">{c.school_name}{c.grade && ` ${c.grade}`}</span>}
        </div>
      ))}
      <a href={`/${storeId}/admin/crm?customerId=${customerId}`}
        className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700 mt-0.5">
        <User size={10} />顧客管理で編集
      </a>
    </div>
  )
}

// ============================================================
// 顧客編集フォーム
// ============================================================
export function EditCustomerForm({ customer, onSaved, onCancel }: {
  customer: Customer; onSaved: (c: Customer) => void; onCancel: () => void
}) {
  const [name,    setName]    = useState(customer.name)
  const [kana,    setKana]    = useState(customer.kana ?? '')
  const [tel,     setTel]     = useState(customer.tel ?? '')
  const [notes,   setNotes]   = useState(customer.notes ?? '')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) { setError('氏名を入力してください'); return }
    setLoading(true); setError(null)
    const { data, error: err } = await (supabase as any).from('customers')
      .update({ name: name.trim(), kana: kana.trim() || null, tel: tel.trim() || null, notes: notes.trim() || null })
      .eq('id', customer.id).select().single()
    setLoading(false)
    if (err) {
      setError(err.message.includes('idx_customers_store_tel')
        ? 'この電話番号は他のお客様に登録されています'
        : `保存失敗: ${err.message}`)
      return
    }
    if (data) onSaved(data as Customer)
  }

  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-gray-900 text-sm flex items-center gap-2">
          <Pencil size={14} className="text-amber-600" />保護者情報を編集
        </p>
        <button onClick={onCancel} className="p-1 text-gray-500 hover:text-gray-900"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="お名前" required>
          <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none"
            value={name} onChange={e => { setName(e.target.value); setError(null) }} />
        </Field>
        <Field label="フリガナ">
          <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none placeholder-gray-400"
            placeholder="ヤマダ タロウ" value={kana} onChange={e => setKana(e.target.value)} />
        </Field>
      </div>
      <Field label="電話番号">
        <input type="tel" inputMode="tel" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none placeholder-gray-400"
          placeholder="090-1234-5678" value={tel} onChange={e => setTel(e.target.value)} />
      </Field>
      <Field label="メモ">
        <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none placeholder-gray-400"
          placeholder="アレルギー・注意事項など" value={notes} onChange={e => setNotes(e.target.value)} />
      </Field>
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <button onClick={handleSave} disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '変更を保存する'}
      </button>
    </div>
  )
}

// ============================================================
// お子様編集フォーム
// ============================================================
export function EditChildForm({ child, onSaved, onCancel, schoolOptions: _ignored }: {
  child: Child
  onSaved: (c: Child) => void
  onCancel: () => void
  schoolOptions?: string[]
}) {
  const schools    = useSchools(child.store_id)
  const [name,     setName]     = useState(child.name)
  const [kana,     setKana]     = useState(child.kana ?? '')
  const [schoolId, setSchoolId] = useState(child.school_id ?? '')
  const [grade,    setGrade]    = useState(child.grade ?? '')
  const [gender,   setGender]   = useState(child.gender ?? '')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) { setError('お名前を入力してください'); return }
    setLoading(true); setError(null)
    const schoolName = schools.find(s => s.id === schoolId)?.name ?? child.school_name ?? null
    const { data, error: err } = await (supabase as any).from('children')
      .update({
        name: name.trim(), kana: kana.trim() || null,
        school_id: schoolId || null, school_name: schoolName,
        grade: grade || null, gender: gender || null,
      })
      .eq('id', child.id).select().single()
    setLoading(false)
    if (err) { setError(`保存失敗: ${err.message}`); return }
    if (data) onSaved(data as Child)
  }

  return (
    <div className="bg-white border border-amber-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-gray-900 text-sm flex items-center gap-2">
          <Pencil size={14} className="text-amber-600" />お子様情報を編集
        </p>
        <button onClick={onCancel} className="p-1 text-gray-500 hover:text-gray-900"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="お名前" required>
          <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none"
            value={name} onChange={e => { setName(e.target.value); setError(null) }} />
        </Field>
        <Field label="フリガナ">
          <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none placeholder-gray-400"
            placeholder="ヤマダ ハナコ" value={kana} onChange={e => setKana(e.target.value)} />
        </Field>
      </div>
      <Field label="学校">
        <select value={schoolId} onChange={e => setSchoolId(e.target.value)}
          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none">
          <option value="">選択してください</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="学年">
          <select value={grade} onChange={e => setGrade(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none">
            <option value="">選択</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="性別">
          <select value={gender} onChange={e => setGender(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-amber-500 focus:outline-none">
            <option value="">選択</option>
            <option value="male">男子</option>
            <option value="female">女子</option>
          </select>
        </Field>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <button onClick={handleSave} disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-orange-500 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin" />保存中...</> : '変更を保存する'}
      </button>
    </div>
  )
}

// ============================================================
// お子様追加フォーム（CRM内）
// ============================================================
export function AddChildFormCRM({ customerId, storeId, onSaved, onCancel, schoolOptions: _ignored }: {
  customerId: string; storeId: string; onSaved: (c: Child) => void; onCancel: () => void
  schoolOptions?: string[]
}) {
  const schools    = useSchools(storeId)
  const [name,     setName]     = useState('')
  const [kana,     setKana]     = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [grade,    setGrade]    = useState('')
  const [gender,   setGender]   = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  const handleSave = async () => {
    if (!name.trim()) { setError('お名前を入力してください'); return }
    setLoading(true); setError(null)
    const schoolName = schools.find(s => s.id === schoolId)?.name ?? null
    const { data, error: err } = await (supabase as any).from('children').insert({
      customer_id: customerId, store_id: storeId,
      name: name.trim(), kana: kana.trim() || null,
      school_id: schoolId || null, school_name: schoolName,
      grade: grade || null, gender: gender || null,
    }).select().single()
    setLoading(false)
    if (err) { setError(`保存失敗: ${err.message}`); return }
    if (data) onSaved(data as Child)
  }

  return (
    <div className="bg-white border border-indigo-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="font-black text-gray-900 text-sm flex items-center gap-2">
          <GraduationCap size={14} className="text-indigo-600" />お子様を追加
        </p>
        <button onClick={onCancel} className="p-1 text-gray-500 hover:text-gray-900"><X size={16} /></button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="お名前" required>
          <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
            placeholder="山田 花子" value={name} onChange={e => { setName(e.target.value); setError(null) }} />
        </Field>
        <Field label="フリガナ">
          <input type="text" className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none placeholder-gray-400"
            placeholder="ヤマダ ハナコ" value={kana} onChange={e => setKana(e.target.value)} />
        </Field>
      </div>
      <Field label="学校">
        <select value={schoolId} onChange={e => setSchoolId(e.target.value)}
          className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none">
          <option value="">選択してください</option>
          {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="学年">
          <select value={grade} onChange={e => setGrade(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none">
            <option value="">選択</option>
            {GRADE_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </Field>
        <Field label="性別">
          <select value={gender} onChange={e => setGender(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:border-indigo-500 focus:outline-none">
            <option value="">選択</option>
            <option value="male">男子</option>
            <option value="female">女子</option>
          </select>
        </Field>
      </div>
      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs bg-red-50 border border-red-200 rounded-xl px-3 py-2">
          <AlertCircle size={13} />{error}
        </div>
      )}
      <button onClick={handleSave} disabled={loading}
        className="w-full py-3 rounded-xl font-bold text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
        {loading ? <><Loader2 size={14} className="animate-spin" />登録中...</> : '追加する'}
      </button>
    </div>
  )
}
