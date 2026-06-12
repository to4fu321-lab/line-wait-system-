'use client'
import { useState } from 'react'
import type { SchoolGrade } from '@/types/school'

interface Props {
  grades: SchoolGrade[]
}

export function SchoolGradeColorPop({ grades }: Props) {
  const [open, setOpen] = useState(false)

  if (!grades || grades.length === 0) return null

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full hover:bg-purple-200 transition-colors"
      >
        🎨 学年色
        <span className="flex gap-0.5 ml-1">
          {grades.slice(0, 4).map(g => (
            <span key={g.id || g.grade_name} style={{ backgroundColor: g.color_hex || '#6366f1' }}
              className="w-2.5 h-2.5 rounded-full border border-white/50" />
          ))}
        </span>
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-8 z-50 bg-white border border-gray-200 rounded-xl shadow-xl p-3 min-w-[160px]">
            <p className="text-xs font-bold text-gray-600 mb-2">学年カラー</p>
            <div className="space-y-1.5">
              {grades.map(g => (
                <div key={g.id || g.grade_name} className="flex items-center gap-2 text-xs">
                  <span style={{ backgroundColor: g.color_hex || '#6366f1' }}
                    className="w-4 h-4 rounded-full border border-gray-200 flex-shrink-0" />
                  <span className="text-gray-700">{g.grade_name}</span>
                  {g.color_name && <span className="text-gray-400">({g.color_name})</span>}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
