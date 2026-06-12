'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { School as SchoolRegulation, SchoolItem, SchoolGrade, SchoolParentTip } from '@/types/school'

type Tab = 'items' | 'grades' | 'tips' | 'info'

export default function SchoolDetailPage() {
  const { storeId, schoolId } = useParams<{ storeId: string; schoolId: string }>()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('items')
  const [school, setSchool] = useState<SchoolRegulation | null>(null)
  const [items, setItems] = useState<SchoolItem[]>([])
  const [grades, setGrades] = useState<SchoolGrade[]>([])
  const [tips, setTips] = useState<SchoolParentTip[]>([])
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/schools/${schoolId}`).then(r => r.json()),
      fetch(`/api/schools/${schoolId}/items`).then(r => r.json()),
      fetch(`/api/schools/${schoolId}/grades`).then(r => r.json()),
      fetch(`/api/schools/${schoolId}/tips`).then(r => r.json()),
    ]).then(([s, it, gr, tp]) => {
      setSchool(s)
      setItems(Array.isArray(it) ? it : [])
      setGrades(Array.isArray(gr) ? gr : [])
      setTips(Array.isArray(tp) ? tp : [])
    })
  }, [schoolId])

  const showMsg = (text: string) => { setMsg(text); setTimeout(() => setMsg(null), 2500) }

  const saveItems = async () => {
    setSaving(true)
    const res = await fetch(`/api/schools/${schoolId}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, updated_by: 'staff' }),
    })
    setSaving(false)
    if (res.ok) showMsg('保存しました')
    else showMsg('保存に失敗しました')
  }

  const saveGrades = async () => {
    setSaving(true)
    const res = await fetch(`/api/schools/${schoolId}/grades`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grades, updated_by: 'staff' }),
    })
    setSaving(false)
    if (res.ok) showMsg('保存しました')
    else showMsg('保存に失敗しました')
  }

  const saveInfo = async () => {
    if (!school) return
    setSaving(true)
    const res = await fetch(`/api/schools/${schoolId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: school.name, kana: school.kana, notes: school.notes, updated_by: 'staff' }),
    })
    const updated = await res.json()
    if (res.ok) { setSchool(updated); showMsg('保存しました') }
    else showMsg('保存に失敗しました')
    setSaving(false)
  }

  const addItem = () => setItems(prev => [
    ...prev,
    { id: '', school_id: schoolId, name: '', required: true, price_tax_in: null, price_tax_out: null,
      size_spec: '', product_code: '', growth_adjust: false, washable: '', avg_qty: null,
      uses_grade_color: false, grade_color_note: '', item_notes: '', sort_order: prev.length,
      created_at: '', updated_at: '', updated_by: '' }
  ])

  const addGrade = () => setGrades(prev => [
    ...prev,
    { id: '', school_id: schoolId, grade_name: '', color_name: '', color_hex: '#6366f1',
      sort_order: prev.length, created_at: '', updated_at: '', updated_by: '' }
  ])

  const updateItem = (i: number, patch: Partial<SchoolItem>) =>
    setItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))

  const updateGrade = (i: number, patch: Partial<SchoolGrade>) =>
    setGrades(prev => prev.map((g, idx) => idx === i ? { ...g, ...patch } : g))

  const approveTip = async (tipId: string, approved: boolean) => {
    await fetch(`/api/schools/tips/${tipId}/approve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved, updated_by: 'staff' }),
    })
    setTips(prev => prev.map(t => t.id === tipId ? { ...t, approved } : t))
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'items', label: `アイテム (${items.length})` },
    { key: 'grades', label: '学年カラー' },
    { key: 'tips', label: `保護者の声 (${tips.length})` },
    { key: 'info', label: '基本情報' },
  ]

  if (!school) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <button onClick={() => router.back()} className="text-gray-500 text-sm">← 戻る</button>
          <h1 className="text-base font-bold flex-1 truncate">{school.name}</h1>
          <button
            onClick={() => router.push(`/${storeId}/schools/${schoolId}/ocr`)}
            className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
          >
            📄 OCR取込
          </button>
        </div>
        <div className="flex border-b border-gray-100 -mb-px overflow-x-auto">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-gray-500'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Toast */}
      {msg && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
          {msg}
        </div>
      )}

      <div className="p-4 max-w-2xl mx-auto">

        {/* ── アイテムタブ ── */}
        {tab === 'items' && (
          <div>
            <div className="space-y-2 mb-4">
              {items.length === 0 && (
                <p className="text-center text-gray-400 py-6 text-sm">アイテムがありません。OCR取込または手動追加してください。</p>
              )}
              {items.map((item, i) => (
                <div key={i} className={`border rounded-xl p-3 ${item.required ? 'border-green-300 bg-green-50' : 'bg-white border-gray-200'}`}>
                  <div className="flex gap-2 mb-2 items-start">
                    <input
                      value={item.name}
                      onChange={e => updateItem(i, { name: e.target.value })}
                      placeholder="アイテム名 *"
                      className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                    />
                    <label className="flex items-center gap-1 text-xs text-gray-600 whitespace-nowrap pt-1.5">
                      <input type="checkbox" checked={item.required}
                        onChange={e => updateItem(i, { required: e.target.checked })}
                        className="accent-green-600" />
                      必須
                    </label>
                    <button
                      onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-red-400 text-xs pt-1.5 hover:text-red-600">削除</button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 text-xs">
                    <input
                      value={item.price_tax_in ?? ''}
                      type="number"
                      onChange={e => updateItem(i, { price_tax_in: e.target.value ? Number(e.target.value) : null })}
                      placeholder="税込価格"
                      className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-400"
                    />
                    <input
                      value={item.size_spec}
                      onChange={e => updateItem(i, { size_spec: e.target.value })}
                      placeholder="サイズ建て"
                      className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-400"
                    />
                    <input
                      value={item.avg_qty ?? ''}
                      type="number"
                      step="0.5"
                      onChange={e => updateItem(i, { avg_qty: e.target.value ? Number(e.target.value) : null })}
                      placeholder="平均点数"
                      className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-400"
                    />
                    <input
                      value={item.product_code}
                      onChange={e => updateItem(i, { product_code: e.target.value })}
                      placeholder="品番"
                      className="border border-gray-300 rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                  <div className="flex gap-3 mt-2 text-xs">
                    <label className="flex items-center gap-1 text-gray-600">
                      <input type="checkbox" checked={item.growth_adjust}
                        onChange={e => updateItem(i, { growth_adjust: e.target.checked })}
                        className="accent-blue-600" />
                      成長機能
                    </label>
                    <label className="flex items-center gap-1 text-gray-600">
                      <input type="checkbox" checked={item.uses_grade_color}
                        onChange={e => updateItem(i, { uses_grade_color: e.target.checked })}
                        className="accent-purple-600" />
                      🎨 学年色あり
                    </label>
                  </div>
                  {item.uses_grade_color && (
                    <input
                      value={item.grade_color_note}
                      onChange={e => updateItem(i, { grade_color_note: e.target.value })}
                      placeholder="学年色メモ（例: ラインの色が学年色）"
                      className="mt-1.5 w-full border border-purple-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-purple-400 bg-purple-50"
                    />
                  )}
                  <input
                    value={item.item_notes}
                    onChange={e => updateItem(i, { item_notes: e.target.value })}
                    placeholder="注意事項"
                    className="mt-1.5 w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-400"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={addItem}
                className="flex-1 border-2 border-dashed border-gray-300 rounded-xl py-2.5 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                + アイテムを追加
              </button>
              <button onClick={saveItems} disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 transition-colors">
                {saving ? '保存中...' : '💾 保存'}
              </button>
            </div>
          </div>
        )}

        {/* ── 学年カラータブ ── */}
        {tab === 'grades' && (
          <div>
            <p className="text-xs text-gray-500 mb-3">ジャージなど学年によって色が変わるアイテムの学年カラーを登録してください</p>
            <div className="space-y-2 mb-4">
              {grades.length === 0 && (
                <p className="text-center text-gray-400 py-6 text-sm">学年カラーが登録されていません</p>
              )}
              {grades.map((g, i) => (
                <div key={i} className="flex gap-2 items-center bg-white border border-gray-200 rounded-xl p-3">
                  <input
                    value={g.grade_name}
                    onChange={e => updateGrade(i, { grade_name: e.target.value })}
                    placeholder="学年（例: 1年生）"
                    className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                  />
                  <input
                    value={g.color_name}
                    onChange={e => updateGrade(i, { color_name: e.target.value })}
                    placeholder="色名（例: 赤）"
                    className="w-24 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="color"
                      value={g.color_hex || '#6366f1'}
                      onChange={e => updateGrade(i, { color_hex: e.target.value })}
                      className="w-9 h-9 rounded-lg border border-gray-200 cursor-pointer"
                      title="カラーを選択"
                    />
                  </div>
                  <button
                    onClick={() => setGrades(prev => prev.filter((_, idx) => idx !== i))}
                    className="text-red-400 text-xs hover:text-red-600">削除</button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <button onClick={addGrade}
                className="flex-1 border-2 border-dashed border-gray-300 rounded-xl py-2.5 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
                + 学年を追加
              </button>
              <button onClick={saveGrades} disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 transition-colors">
                {saving ? '保存中...' : '💾 保存'}
              </button>
            </div>
          </div>
        )}

        {/* ── 保護者の声タブ ── */}
        {tab === 'tips' && (
          <div className="space-y-2">
            {tips.length === 0 && (
              <p className="text-center text-gray-400 py-8 text-sm">保護者からの投稿がありません</p>
            )}
            {tips.map(tip => (
              <div key={tip.id} className={`border rounded-xl p-3 ${tip.approved ? 'border-green-300 bg-green-50' : 'bg-white border-gray-200'}`}>
                {tip.item_name && (
                  <p className="text-xs text-indigo-600 font-bold mb-1">[{tip.item_name}]</p>
                )}
                <p className="text-sm text-gray-800 mb-2">{tip.tip_text}</p>
                <div className="flex gap-2">
                  <button onClick={() => approveTip(tip.id, true)}
                    className={`flex-1 text-xs py-1.5 rounded-lg font-bold transition-colors ${
                      tip.approved ? 'bg-green-600 text-white' : 'border border-green-500 text-green-600 hover:bg-green-50'
                    }`}>
                    ✅ 承認して掲載
                  </button>
                  <button onClick={() => approveTip(tip.id, false)}
                    className={`flex-1 text-xs py-1.5 rounded-lg font-bold transition-colors ${
                      !tip.approved ? 'bg-gray-400 text-white' : 'border border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}>
                    非承認
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 基本情報タブ ── */}
        {tab === 'info' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">学校名 *</label>
              <input
                value={school.name}
                onChange={e => setSchool(s => s ? { ...s, name: e.target.value } : s)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">かな</label>
              <input
                value={school.kana}
                onChange={e => setSchool(s => s ? { ...s, kana: e.target.value } : s)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 block mb-1">注意事項</label>
              <textarea
                value={school.notes}
                onChange={e => setSchool(s => s ? { ...s, notes: e.target.value } : s)}
                rows={4}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                placeholder="保護者に伝えるべき注意事項を入力"
              />
            </div>
            <p className="text-xs text-gray-400">
              最終更新: {school.updated_by || '未設定'} / {new Date(school.updated_at).toLocaleDateString('ja-JP')}
            </p>
            <button
              onClick={saveInfo}
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-sm font-bold disabled:opacity-50 transition-colors"
            >
              {saving ? '保存中...' : '💾 保存'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
