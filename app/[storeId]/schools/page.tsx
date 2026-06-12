'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useStoreFeatures } from '@/lib/useStoreFeatures'
import type { SchoolWithCounts } from '@/types/school'

export default function SchoolsPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const router = useRouter()
  const { hasFeature, loaded } = useStoreFeatures(storeId)
  const [schools, setSchools] = useState<SchoolWithCounts[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [newName, setNewName] = useState('')
  const [newKana, setNewKana] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetch(`/api/schools?storeId=${storeId}`)
      .then(r => r.json())
      .then(data => setSchools(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false))
  }, [storeId])

  const filtered = schools.filter(s =>
    s.name.includes(search) || (s.kana ?? '').includes(search)
  )

  const handleAdd = async () => {
    if (!newName.trim()) return
    setAdding(true)
    const res = await fetch('/api/schools', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ store_id: storeId, name: newName.trim(), kana: newKana, updated_by: 'staff' }),
    })
    const school = await res.json()
    if (res.ok) {
      setSchools(prev => [...prev, { ...school, item_count: 0, grade_count: 0 }])
      setNewName('')
      setNewKana('')
    }
    setAdding(false)
  }

  if (loaded && !hasFeature('school_master')) {
    return (
      <div className="p-8 text-center text-gray-400">
        <p>学校マスター管理は現在のプランでは無効です</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700">
          ← 戻る
        </button>
        <h1 className="text-lg font-bold flex-1">🏫 学校規定マスター</h1>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* 検索 */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="学校名・かなで検索..."
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 mb-4 text-sm bg-white focus:outline-none focus:border-indigo-500"
        />

        {/* 学校一覧 */}
        {loading ? (
          <div className="text-center py-12 text-gray-400">読み込み中...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            {search ? '検索結果がありません' : '学校が登録されていません'}
          </div>
        ) : (
          <div className="space-y-2 mb-6">
            {filtered.map(school => {
              // Handle both number and Supabase aggregation [{count: number}] shapes
              const rawCount = school.item_count
              const itemCount = Array.isArray(rawCount)
                ? ((rawCount[0] as unknown as { count: number })?.count ?? 0)
                : (rawCount as number)
              return (
                <button
                  key={school.id}
                  onClick={() => router.push(`/${storeId}/schools/${school.id}`)}
                  className="w-full flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all text-left"
                >
                  <div>
                    <p className="font-semibold text-gray-900">{school.name}</p>
                    {school.kana && <p className="text-xs text-gray-400 mt-0.5">{school.kana}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{itemCount}アイテム</p>
                    <p className="text-xs text-indigo-400 mt-0.5">詳細 →</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* 新規追加 */}
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-bold text-gray-700 mb-3">学校を追加</p>
          <div className="flex gap-2 mb-3">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="学校名 *"
              className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
            <input
              value={newKana}
              onChange={e => setNewKana(e.target.value)}
              placeholder="かな"
              className="w-32 border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
          >
            {adding ? '追加中...' : '追加する'}
          </button>
        </div>
      </div>
    </div>
  )
}
