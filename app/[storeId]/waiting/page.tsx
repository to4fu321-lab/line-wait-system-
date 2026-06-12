'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import type { SchoolDetail } from '@/types/school'

function WaitingContent() {
  const { storeId } = useParams<{ storeId: string }>()
  const searchParams = useSearchParams()
  const schoolId = searchParams.get('school_id')
  const { hasFeature, loaded } = useStoreFeatures(storeId)
  const [school, setSchool] = useState<SchoolDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)

  // Wake Lock to prevent screen sleep
  useEffect(() => {
    const acquireWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen')
        }
      } catch { /* silently ignore */ }
    }
    acquireWakeLock()
    return () => { wakeLockRef.current?.release() }
  }, [])

  const fetchSchool = async () => {
    if (!schoolId) return
    setLoading(true)
    try {
      const [s, items, grades] = await Promise.all([
        fetch(`/api/schools/${schoolId}`).then(r => r.json()),
        fetch(`/api/schools/${schoolId}/items`).then(r => r.json()),
        fetch(`/api/schools/${schoolId}/grades`).then(r => r.json()),
      ])
      setSchool({ ...s, items: Array.isArray(items) ? items : [], grades: Array.isArray(grades) ? grades : [] })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSchool()
    const interval = setInterval(fetchSchool, 5 * 60 * 1000) // 5分ごとに更新
    return () => clearInterval(interval)
  }, [schoolId])

  // Feature not enabled — show plain waiting screen
  if (loaded && !hasFeature('school_waiting') && !schoolId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-8xl mb-6">⏳</div>
          <h1 className="text-4xl font-bold mb-4">しばらくお待ちください</h1>
          <p className="text-xl text-slate-300">スタッフがご案内します</p>
        </div>
      </div>
    )
  }

  const required = school?.items?.filter(i => i.required) ?? []
  const optional = school?.items?.filter(i => !i.required) ?? []

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 text-white p-6 md:p-10">
      {/* ヘッダー */}
      <div className="text-center mb-8">
        <p className="text-slate-400 text-sm mb-1">お客様への情報</p>
        <h1 className="text-3xl md:text-5xl font-bold">
          {school ? school.name : 'しばらくお待ちください'}
        </h1>
        {school && (
          <p className="text-slate-300 text-lg mt-2">学校規定品のご案内</p>
        )}
      </div>

      {!schoolId && !school && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="text-8xl mb-4">⏳</div>
            <p className="text-2xl text-slate-300">スタッフがご案内します</p>
          </div>
        </div>
      )}

      {school && (
        <div className="max-w-4xl mx-auto">
          {/* 必須品 */}
          {required.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-green-400 mb-4 flex items-center gap-2">
                ✅ 必須購入品 <span className="text-base font-normal text-green-300">({required.length}点)</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {required.map((item, i) => (
                  <div key={item.id || i} className="bg-white/10 border border-white/20 rounded-2xl p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-lg font-bold text-white">{item.name}</h3>
                      <div className="flex gap-2">
                        {item.growth_adjust && (
                          <span className="text-xs bg-blue-500/50 text-blue-200 px-2 py-0.5 rounded-full">成長機能</span>
                        )}
                        {item.uses_grade_color && (
                          <span className="text-xs bg-purple-500/50 text-purple-200 px-2 py-0.5 rounded-full">🎨 学年色</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 text-sm text-slate-300">
                      {item.price_tax_in && (
                        <p>💴 ¥{item.price_tax_in.toLocaleString()}</p>
                      )}
                      {item.size_spec && (
                        <p>📏 {item.size_spec}</p>
                      )}
                      {item.avg_qty != null && (
                        <p>📦 平均 {item.avg_qty}点</p>
                      )}
                    </div>
                    {item.uses_grade_color && item.grade_color_note && (
                      <p className="text-xs text-purple-300 mt-1">{item.grade_color_note}</p>
                    )}
                    {item.item_notes && (
                      <p className="text-xs text-yellow-300 mt-1">⚠ {item.item_notes}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 学年カラー */}
          {school.grades && school.grades.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl md:text-2xl font-bold text-purple-400 mb-4">🎨 学年カラー</h2>
              <div className="flex flex-wrap gap-4">
                {school.grades.map((g, i) => (
                  <div key={g.id || i} className="flex items-center gap-3 bg-white/10 border border-white/20 rounded-xl px-4 py-3">
                    <div style={{ backgroundColor: g.color_hex || '#6366f1' }}
                      className="w-8 h-8 rounded-full border-2 border-white/30 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-white">{g.grade_name}</p>
                      {g.color_name && <p className="text-xs text-slate-300">{g.color_name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 任意品 */}
          {optional.length > 0 && (
            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-300 mb-3">任意購入品</h2>
              <div className="flex flex-wrap gap-2">
                {optional.map((item, i) => (
                  <span key={item.id || i}
                    className="text-sm bg-white/10 text-slate-200 px-3 py-1.5 rounded-full border border-white/20">
                    {item.name}
                    {item.price_tax_in && <span className="text-slate-400 ml-1">¥{item.price_tax_in.toLocaleString()}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 注意事項 */}
          {school.notes && (
            <div className="bg-yellow-500/20 border border-yellow-500/40 rounded-2xl p-5">
              <p className="text-lg font-bold text-yellow-300 mb-2">📋 ご注意</p>
              <p className="text-white leading-relaxed">{school.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* フッター */}
      <div className="text-center mt-10 text-slate-500 text-sm">
        スタッフがご案内します — {new Date().toLocaleDateString('ja-JP')}
      </div>
    </div>
  )
}

export default function WaitingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center text-white">
          <div className="text-8xl mb-6">⏳</div>
          <h1 className="text-4xl font-bold">しばらくお待ちください</h1>
        </div>
      </div>
    }>
      <WaitingContent />
    </Suspense>
  )
}
