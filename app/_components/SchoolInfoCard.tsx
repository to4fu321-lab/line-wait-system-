'use client'
import { useState, useEffect } from 'react'
import type { SchoolDetail } from '@/types/school'
import { SchoolGradeColorPop } from './SchoolGradeColorPop'

interface Props {
  schoolId: string
  storeId: string
}

export function SchoolInfoCard({ schoolId, storeId }: Props) {
  const [school, setSchool] = useState<SchoolDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!schoolId) return
    Promise.all([
      fetch(`/api/schools/${schoolId}`).then(r => r.json()),
      fetch(`/api/schools/${schoolId}/items`).then(r => r.json()),
      fetch(`/api/schools/${schoolId}/grades`).then(r => r.json()),
    ]).then(([s, items, grades]) => {
      setSchool({ ...s, items: Array.isArray(items) ? items : [], grades: Array.isArray(grades) ? grades : [] })
    }).finally(() => setLoading(false))
  }, [schoolId])

  if (loading) return (
    <div className="border border-gray-200 rounded-xl p-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-32 mb-2" />
      <div className="h-3 bg-gray-100 rounded w-48" />
    </div>
  )

  if (!school) return null

  const required = school.items?.filter(i => i.required) ?? []
  const optional = school.items?.filter(i => !i.required) ?? []

  return (
    <div className="border border-indigo-200 bg-indigo-50/50 rounded-xl overflow-hidden">
      {/* ヘッダー */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-indigo-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-base">🏫</span>
          <div className="text-left">
            <p className="text-sm font-bold text-indigo-800">{school.name}</p>
            <p className="text-xs text-indigo-500">{school.items?.length ?? 0}アイテム</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {school.grades?.length > 0 && <SchoolGradeColorPop grades={school.grades} />}
          <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-indigo-100">
          {required.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-bold text-green-700 mb-1">✅ 必須購入品</p>
              <div className="space-y-1">
                {required.map((item, i) => (
                  <div key={item.id || i} className="flex justify-between text-xs">
                    <span className="text-gray-700">{item.name}</span>
                    <div className="flex items-center gap-2 text-gray-500">
                      {item.price_tax_in && <span>¥{item.price_tax_in.toLocaleString()}</span>}
                      {item.avg_qty && <span>平均{item.avg_qty}点</span>}
                      {item.uses_grade_color && <span className="text-purple-500">🎨</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {optional.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-bold text-gray-500 mb-1">任意購入品</p>
              <div className="space-y-1">
                {optional.map((item, i) => (
                  <div key={item.id || i} className="flex justify-between text-xs text-gray-500">
                    <span>{item.name}</span>
                    {item.price_tax_in && <span>¥{item.price_tax_in.toLocaleString()}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {school.notes && (
            <div className="mt-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
              <p className="text-xs text-yellow-700">{school.notes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
