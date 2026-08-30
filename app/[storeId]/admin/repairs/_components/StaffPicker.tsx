'use client'

// ============================================================================
//  担当スタッフの選択
//   受付した人と作業・連絡した人は別なので、それぞれ記録できるようにする。
//   端末を触る人はシフト中ほぼ固定なので、前回選んだ人を憶えて既定にする
//   （毎回選ばせると必ず入力されなくなる）。
// ============================================================================

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export interface StaffOption { id: string; name: string }

const lastKey = (storeId: string) => `repair_staff_${storeId}`

/** この端末で前回選ばれた担当者（無ければ null） */
export function lastStaffId(storeId: string): string | null {
  try { return sessionStorage.getItem(lastKey(storeId)) } catch { /* 参照できなければ未選択扱い */ return null }
}

export function rememberStaffId(storeId: string, id: string | null) {
  try {
    if (id) sessionStorage.setItem(lastKey(storeId), id)
    else    sessionStorage.removeItem(lastKey(storeId))
  } catch { /* 記憶できなくても選択自体は成立する */ }
}

export function useStaffList(storeId: string): StaffOption[] {
  const [list, setList] = useState<StaffOption[]>([])
  useEffect(() => {
    if (!storeId) return
    ;(supabase as any).from('staff')
      .select('id, name').eq('store_id', storeId).eq('active', true).order('sort_order')
      .then(({ data }: { data: StaffOption[] | null }) => setList(data ?? []))
  }, [storeId])
  return list
}

export function StaffPicker({ storeId, label, value, onChange }: {
  storeId:  string
  label:    string
  value:    string | null
  onChange: (id: string | null) => void
}) {
  const staff = useStaffList(storeId)
  if (staff.length === 0) return null   // スタッフ未登録の店では出さない

  return (
    <div>
      <p className="text-[11px] font-black text-gray-400 mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {staff.map(s => (
          <button key={s.id} type="button"
            onClick={() => {
              const next = value === s.id ? null : s.id
              onChange(next)
              rememberStaffId(storeId, next)
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-bold transition ${
              value === s.id ? 'border-indigo-400 bg-indigo-50 text-indigo-700' : 'border-gray-200 bg-white text-gray-600'
            }`}>{s.name}</button>
        ))}
      </div>
    </div>
  )
}
