'use client'
import { useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { OcrResult, OcrResultItem } from '@/types/school'

export default function SchoolOcrPage() {
  const { storeId, schoolId } = useParams<{ storeId: string; schoolId: string }>()
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [previews, setPreviews] = useState<string[]>([])
  const [files, setFiles] = useState<File[]>([])
  const [result, setResult] = useState<OcrResult | null>(null)
  const [editItems, setEditItems] = useState<OcrResultItem[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? [])
    setFiles(selected)
    const urls = selected.map(f => URL.createObjectURL(f))
    setPreviews(prev => { prev.forEach(u => URL.revokeObjectURL(u)); return urls })
    setResult(null)
    setError('')
  }

  const handleOcr = async () => {
    if (files.length === 0) return
    setLoading(true)
    setError('')
    try {
      const form = new FormData()
      files.forEach(f => form.append('images', f))
      const res = await fetch('/api/schools/ocr', { method: 'POST', body: form })
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        throw new Error(err.error || `HTTP ${res.status}`)
      }
      const data: OcrResult = await res.json()
      setResult(data)
      setEditItems(data.items ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    await fetch(`/api/schools/${schoolId}/items`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: editItems, updated_by: 'staff' }),
    })
    if (result?.notes) {
      await fetch(`/api/schools/${schoolId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: result.notes, updated_by: 'staff' }),
      })
    }
    setSaving(false)
    router.push(`/${storeId}/schools/${schoolId}`)
  }

  const updateItem = (i: number, patch: Partial<OcrResultItem>) =>
    setEditItems(prev => prev.map((it, idx) => idx === i ? { ...it, ...patch } : it))

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* ヘッダー */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-500 text-sm">← 戻る</button>
        <h1 className="text-base font-bold flex-1">📄 OCRで取り込む</h1>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {!result ? (
          /* ── アップロードフェーズ ── */
          <div>
            <div
              onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-sky-300 bg-sky-50 rounded-2xl p-8 text-center cursor-pointer hover:bg-sky-100 transition-colors mb-4"
            >
              <div className="text-4xl mb-2">📷</div>
              <p className="font-bold text-sky-700 mb-1">マニュアル・あんちょこを取り込む</p>
              <p className="text-xs text-gray-400">JPG / PNG（複数枚まとめて選択可）</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />

            {previews.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">
                {previews.map((src, i) => (
                  <img key={i} src={src} alt="" className="w-20 h-24 object-cover rounded-xl border border-gray-200 shadow-sm" />
                ))}
                <button onClick={() => { setFiles([]); setPreviews([]); setError('') }}
                  className="w-20 h-24 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 text-xs hover:border-red-300 hover:text-red-400 transition-colors">
                  クリア
                </button>
              </div>
            )}

            {files.length > 0 && (
              <button
                onClick={handleOcr}
                disabled={loading}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white py-3 rounded-xl font-bold disabled:opacity-50 transition-colors"
              >
                {loading ? '🤖 AI読み取り中...' : `🤖 AI読み取り開始（${files.length}枚）`}
              </button>
            )}
            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3 text-red-600 text-sm">{error}</div>
            )}
          </div>
        ) : (
          /* ── 確認・編集フェーズ ── */
          <div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-700 font-medium">
              ✅ {editItems.length}アイテムを読み取りました。内容を確認・編集してから保存してください。
            </div>

            <div className="overflow-x-auto bg-white border border-gray-200 rounded-xl mb-4">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-bold text-gray-600">アイテム名</th>
                    <th className="px-2 py-2 font-bold text-gray-600">区分</th>
                    <th className="px-2 py-2 font-bold text-gray-600">税込価格</th>
                    <th className="px-2 py-2 font-bold text-gray-600">サイズ建て</th>
                    <th className="px-2 py-2 font-bold text-gray-600">平均点数</th>
                    <th className="px-2 py-2 font-bold text-gray-600">注意</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {editItems.map((item, i) => (
                    <tr key={i} className={item.confidence === 'low' ? 'bg-yellow-50' : item.required ? 'bg-green-50/50' : ''}>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          {item.confidence === 'low' && <span className="text-yellow-500 text-xs" title="読み取り不確か">⚠</span>}
                          <input
                            value={item.name}
                            onChange={e => updateItem(i, { name: e.target.value })}
                            className="w-full bg-transparent min-w-[80px] focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1"
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <select
                          value={item.required ? 'true' : 'false'}
                          onChange={e => updateItem(i, { required: e.target.value === 'true' })}
                          className="text-xs bg-transparent focus:outline-none"
                        >
                          <option value="true">必須</option>
                          <option value="false">任意</option>
                        </select>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={item.price_tax_in ?? ''}
                          type="number"
                          onChange={e => updateItem(i, { price_tax_in: e.target.value ? Number(e.target.value) : null })}
                          className="w-full bg-transparent min-w-[60px] focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={item.size_spec}
                          onChange={e => updateItem(i, { size_spec: e.target.value })}
                          className="w-full bg-transparent min-w-[80px] focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={item.avg_qty ?? ''}
                          type="number"
                          step="0.5"
                          onChange={e => updateItem(i, { avg_qty: e.target.value ? Number(e.target.value) : null })}
                          className="w-full bg-transparent min-w-[40px] focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={item.item_notes}
                          onChange={e => updateItem(i, { item_notes: e.target.value })}
                          className="w-full bg-transparent min-w-[80px] focus:outline-none focus:ring-1 focus:ring-indigo-300 rounded px-1"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {result.notes && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
                <p className="text-xs font-bold text-yellow-700 mb-1">📋 注意事項（自動抽出）</p>
                <p className="text-xs text-yellow-800">{result.notes}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setResult(null); setFiles([]); setPreviews([]) }}
                className="flex-1 border border-gray-300 text-gray-600 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors"
              >
                ← 撮り直す
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-[2] bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-colors"
              >
                {saving ? '保存中...' : `✅ 一括保存（${editItems.length}アイテム）`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
