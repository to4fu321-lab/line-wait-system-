'use client'

import type { ReactNode } from 'react'

// ============================================================
// フォームのラベル付きフィールド（共通コンポーネント）
// ============================================================
export function Field({ label, required, hint, full, children }: {
  label: string
  required?: boolean
  hint?: string
  full?: boolean
  children: ReactNode
}) {
  return (
    <div className={full ? 'col-span-2' : ''}>
      <label className="block text-xs font-bold text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
        {hint && <span className="ml-1 font-normal text-gray-400">{hint}</span>}
      </label>
      {children}
    </div>
  )
}
