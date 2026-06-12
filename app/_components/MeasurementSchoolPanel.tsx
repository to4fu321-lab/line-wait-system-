'use client'
import { useState, useEffect } from 'react'
import type { SchoolItem, SchoolGrade } from '@/types/school'
import { SchoolGradeColorPop } from './SchoolGradeColorPop'

interface Props {
  schoolId: string
  schoolName: string
}

export function MeasurementSchoolPanel({ schoolId, schoolName }: Props) {
  const [items, setItems] = useState<SchoolItem[]>([])
  const [grades, setGrades] = useState<SchoolGrade[]>([])
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    if (!schoolId) return
    Promise.all([
      fetch(`/api/schools/${schoolId}/items`).then(r => r.json()),
      fetch(`/api/schools/${schoolId}/grades`).then(r => r.json()),
    ]).then(([it, gr]) => {
      setItems(Array.isArray(it) ? it : [])
      setGrades(Array.isArray(gr) ? gr : [])
    }).finally(() => setLoading(false))
  }, [schoolId])

  if (loading) return (
    <div className="border border-gray-200 rounded-xl p-3 mb-3 animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-40" />
    </div>
  )

  const required = items.filter(i => i.required)
  const optional = items.filter(i => !i.required)

  return (
    <div className="border border-sky-200 bg-sky-50/30 rounded-xl mb-3 overflow-hidden">
      {/* ヘッダー */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-sky-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>🏫</span>
          <span className="text-sm font-bold text-sky-800">{schoolName} — 規定品</span>
          <span className="text-xs bg-sky-200 text-sky-700 px-1.5 py-0.5 rounded-full">{items.length}点</span>
        </div>
        <div className="flex items-center gap-2">
          {grades.length > 0 && <SchoolGradeColorPop grades={grades} />}
          <span className="text-gray-400 text-xs">{collapsed ? '▼' : '▲'}</span>
        </div>
      </button>

      {!collapsed && (
        <div className="border-t border-sky-100">
          {/* 必須品テーブル */}
          {required.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-green-50 border-b border-green-100">
                    <th className="text-left px-3 py-1.5 font-bold text-green-700" colSpan={5}>
                      ✅ 必須 ({required.length}点)
                    </th>
                  </tr>
                  <tr className="bg-green-50/50 border-b border-green-100 text-green-600">
                    <th className="text-left px-3 py-1 font-medium">アイテム</th>
                    <th className="px-2 py-1 font-medium">税込価格</th>
                    <th className="px-2 py-1 font-medium">サイズ建て</th>
                    <th className="px-2 py-1 font-medium">平均点数</th>
                    <th className="px-2 py-1 font-medium">備考</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-50">
                  {required.map((item, i) => (
                    <tr key={item.id || i} className="hover:bg-green-50/50 transition-colors">
                      <td className="px-3 py-2 font-medium text-gray-800">
                        <div>
                          {item.name}
                          {item.growth_adjust && <span className="ml-1 text-blue-500 text-xs">📏成長</span>}
                          {item.uses_grade_color && <span className="ml-1 text-purple-500 text-xs">🎨</span>}
                        </div>
                        {item.uses_grade_color && item.grade_color_note && (
                          <div className="text-xs text-purple-400 mt-0.5">{item.grade_color_note}</div>
                        )}
                      </td>
                      <td className="px-2 py-2 text-center text-gray-600">
                        {item.price_tax_in ? `¥${item.price_tax_in.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-2 py-2 text-center text-gray-600">{item.size_spec || '-'}</td>
                      <td className="px-2 py-2 text-center">
                        {item.avg_qty != null ? (
                          <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full text-xs font-bold">
                            {item.avg_qty}点
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-2 py-2 text-gray-400">{item.item_notes || ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 任意品 */}
          {optional.length > 0 && (
            <div className="px-3 py-2 border-t border-sky-100">
              <p className="text-xs font-bold text-gray-500 mb-1">任意購入品 ({optional.length}点)</p>
              <div className="flex flex-wrap gap-2">
                {optional.map((item, i) => (
                  <span key={item.id || i}
                    className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full flex items-center gap-1">
                    {item.name}
                    {item.avg_qty != null && <span className="text-gray-400">×{item.avg_qty}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
