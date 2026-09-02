'use client'

// ============================================================================
//  糸・部材マスタ — 受付でタップ選択する材料（ガット・グリップ等）を登録する
//
//  実体は商品マスタ(products)。専用テーブルを作らないのは、ストリングが
//  「張替えなしの単品販売もするPOS商品」だから（在庫・原価・売上が二重になる）。
//    銘柄 = group_name  /  色 = color_code  /  表示名 = name（自動生成）
//  受付は group_name でまとめて〈銘柄→色〉の2段タップで選ぶ。
//
//  ※ /admin/products は旧スキーマ(code/sizes/price/is_active)前提で現行DBに
//    対しては動作しない。ここは現行スキーマだけを使う。
//  設計: docs/repair-flexible-catalog-design.md §3 追加③
// ============================================================================

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, Plus, Pencil, Trash2, Loader2, X, Package } from 'lucide-react'
import { useBackHref } from '@/lib/useBackHref'
import { supabase } from '@/lib/supabase'
import { Toast } from '@/app/_components/Toast'

const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2.5 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

// 受付の FieldDef.material_category と対応する。増やしたければここに足す。
const CATEGORIES: { key: string; label: string; hint: string }[] = [
  { key: 'string', label: 'ガット（糸）', hint: '例: BG66アルティマックス / イエロー' },
  { key: 'grip',   label: 'グリップ',     hint: '例: ウェットスーパーグリップ / ブラック' },
]

// メーカー・色はタップで打てるとほぼ手入力が要らなくなる。自由記載も残す。
const MAKER_PRESETS: Record<string, string[]> = {
  string: ['ヨネックス', 'ゴーセン', 'バボラ', 'ウイルソン', 'プリンス', 'テクニファイバー', 'ルキシロン', 'ダンロップ'],
  grip:   ['ヨネックス', 'トアルソン', 'ウイルソン', 'プリンス', 'ミズノ', 'ゴーセン'],
}
const COLOR_PRESETS: Record<string, string[]> = {
  string: ['ホワイト', 'ブラック', 'イエロー', 'レッド', 'ブルー', 'グリーン', 'オレンジ', 'ピンク', 'ナチュラル'],
  grip:   ['ホワイト', 'ブラック', 'ブルー', 'レッド', 'イエロー', 'ピンク', 'グリーン'],
}

interface MaterialRow {
  id:                string
  name:              string
  group_name:        string | null
  color_code:        string | null
  maker:             string | null
  base_price_tax_in: number | null
  stock:             number | null
  category:          string | null
  active:            boolean
}

export default function MaterialsMasterPage() {
  const params  = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const backHref = useBackHref(`/${storeId}/admin/master/repair`)

  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const showToast = (type: 'ok' | 'err', msg: string) => setToast({ msg, type })

  const [category, setCategory] = useState(CATEGORIES[0].key)
  const [rows, setRows]         = useState<MaterialRow[]>([])
  const [loading, setLoading]   = useState(true)

  const fetchRows = useCallback(async () => {
    if (!storeId) return
    setLoading(true)
    const { data, error } = await (supabase as any).from('products')
      .select('id, name, group_name, color_code, maker, base_price_tax_in, stock, category, active')
      .eq('store_id', storeId).eq('category', category)
      .order('group_name').order('sort_order')
    if (error) { showToast('err', '読み込みに失敗しました: ' + error.message); setLoading(false); return }
    setRows((data ?? []) as MaterialRow[])
    setLoading(false)
  }, [storeId, category])

  useEffect(() => { fetchRows() }, [fetchRows])

  // ── 編集モーダル ────────────────────────────────────────────
  const [modal, setModal]     = useState(false)
  const [editing, setEditing] = useState<MaterialRow | null>(null)
  const [gName, setGName]     = useState('')
  const [color, setColor]     = useState('')
  const [maker, setMaker]     = useState('')
  const [price, setPrice]     = useState('')
  const [stock, setStock]     = useState('')
  const [saving, setSaving]   = useState(false)

  const open = (r?: MaterialRow) => {
    setEditing(r ?? null)
    setGName(r?.group_name ?? ''); setColor(r?.color_code ?? '')
    setMaker(r?.maker ?? '')
    setPrice(r?.base_price_tax_in != null ? String(r.base_price_tax_in) : '')
    setStock(r?.stock != null ? String(r.stock) : '')
    setModal(true)
  }

  // 自店で既に使っている銘柄名。同じ銘柄の色違いを追加するときに
  // 表記ゆれ（全角半角・スペース）で別グループになるのを防ぐ
  const knownBrands = Array.from(new Set(rows.map(r => r.group_name?.trim()).filter((v): v is string => !!v)))
    .sort((a, b) => a.localeCompare(b, 'ja'))

  const save = async () => {
    if (!gName.trim()) return showToast('err', '銘柄は必須です')
    setSaving(true)
    // 表示名は「銘柄 色」。受付の選択結果としてそのまま伝票に載る
    const name = [gName.trim(), color.trim()].filter(Boolean).join(' ')
    const payload = {
      name,
      group_name:        gName.trim(),
      color_code:        color.trim() || null,
      maker:             maker.trim() || null,
      base_price_tax_in: price !== '' ? Number(price) : null,
      stock:             stock !== '' ? Number(stock) : null,
      category,
      active:            true,
    }
    const db = supabase as any
    const { error } = editing
      ? await db.from('products').update(payload).eq('id', editing.id)
      : await db.from('products').insert({ ...payload, store_id: storeId })
    setSaving(false)
    if (error) { showToast('err', '保存に失敗しました: ' + error.message); return }
    setModal(false); showToast('ok', '保存しました'); fetchRows()
  }

  const remove = async (r: MaterialRow) => {
    if (!confirm(`「${r.name}」を削除します。よろしいですか？`)) return
    const { error } = await (supabase as any).from('products').delete().eq('id', r.id)
    if (error) { showToast('err', '削除に失敗しました: ' + error.message); return }
    showToast('ok', '削除しました'); fetchRows()
  }

  // 銘柄ごとにまとめて表示（受付の2段タップと同じ見え方にする）
  const groups = rows.reduce<Map<string, MaterialRow[]>>((m, r) => {
    const k = r.group_name?.trim() || r.name
    if (!m.has(k)) m.set(k, [])
    m.get(k)!.push(r)
    return m
  }, new Map())

  const cat = CATEGORIES.find(c => c.key === category)!

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {toast && <Toast {...toast} onClose={() => setToast(null)} />}

      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3.5 flex items-center gap-3 sticky top-0 z-30">
        <Link href={backHref} className="text-white/90"><ChevronLeft size={22} /></Link>
        <Package size={18} className="text-white" />
        <h1 className="text-white font-black text-base">糸・部材マスタ</h1>
      </div>

      <div className="p-4 space-y-4">
        <div className="bg-white rounded-2xl p-3 shadow-sm">
          <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">種別</p>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={() => setCategory(c.key)}
                className={`rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition ${
                  category === c.key ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 bg-white text-gray-600'
                }`}>{c.label}</button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            ここに登録すると、受付画面で〈銘柄→色〉のタップ選択になります。
          </p>
        </div>

        <button onClick={() => open()}
          className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-white py-3.5 font-black active:scale-[0.99]">
          <Plus size={18} />{cat.label}を追加
        </button>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gray-300" size={28} /></div>
        ) : groups.size === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm">
            <p className="text-sm text-gray-400">まだ登録がありません。</p>
            <p className="text-[11px] text-gray-400 mt-1">{cat.hint}</p>
          </div>
        ) : (
          Array.from(groups.entries()).map(([g, items]) => (
            <div key={g} className="bg-white rounded-2xl p-3 shadow-sm">
              <div className="flex items-baseline gap-2 mb-2">
                <p className="font-black text-gray-800">{g}</p>
                {items[0]?.maker && <span className="text-[11px] text-gray-400">{items[0].maker}</span>}
                <span className="ml-auto text-[11px] text-gray-400">{items.length}色</span>
              </div>
              <div className="space-y-1.5">
                {items.map(r => (
                  <div key={r.id} className="flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2">
                    <span className="flex-1 text-sm font-bold text-gray-700">{r.color_code || '（色指定なし）'}</span>
                    {r.base_price_tax_in != null && (
                      <span className="text-xs text-gray-500">¥{r.base_price_tax_in.toLocaleString()}</span>
                    )}
                    {r.stock != null && (
                      <span className={`text-xs font-bold ${r.stock > 0 ? 'text-gray-400' : 'text-red-500'}`}>残{r.stock}</span>
                    )}
                    <button onClick={() => open(r)} className="p-1.5 text-gray-400 hover:text-indigo-600"><Pencil size={15} /></button>
                    <button onClick={() => remove(r)} className="p-1.5 text-gray-300 hover:text-red-500"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setModal(false)}>
          <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-5 py-3.5 flex items-center justify-between z-10">
              <h2 className="font-black text-gray-900">{editing ? `${cat.label}を編集` : `${cat.label}を追加`}</h2>
              <button onClick={() => setModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={20} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">銘柄<span className="text-red-500">*</span></label>
                <input className={INPUT} value={gName} onChange={e => setGName(e.target.value)}
                  placeholder="例: BG66アルティマックス" />
                <p className="text-[11px] text-gray-400 mt-1">同じ銘柄の色違いは、この名前を揃えるとまとまります。</p>
                {/* 自店で登録済みの銘柄。タップすれば表記ゆれなく色違いを追加できる */}
                {knownBrands.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {knownBrands.map(b => (
                      <button key={b} type="button" onClick={() => setGName(b)}
                        className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 transition ${
                          gName.trim() === b ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-200 text-gray-600'
                        }`}>{b}</button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">色</label>
                <input className={INPUT} value={color} onChange={e => setColor(e.target.value)} placeholder="例: イエロー（自由入力もOK）" />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {COLOR_PRESETS[category]?.map(c => (
                    <button key={c} type="button" onClick={() => setColor(c)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 transition ${
                        color.trim() === c ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-200 text-gray-600'
                      }`}>{c}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600 block mb-1">メーカー</label>
                <input className={INPUT} value={maker} onChange={e => setMaker(e.target.value)} placeholder="例: ヨネックス（自由入力もOK）" />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {MAKER_PRESETS[category]?.map(m => (
                    <button key={m} type="button" onClick={() => setMaker(m)}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold border-2 transition ${
                        maker.trim() === m ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-gray-200 text-gray-600'
                      }`}>{m}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">材料費（税込）</label>
                  <input className={INPUT} inputMode="numeric" value={price} onChange={e => setPrice(e.target.value)} placeholder="1200" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 block mb-1">在庫（張り数）</label>
                  <input className={INPUT} inputMode="numeric" value={stock} onChange={e => setStock(e.target.value)} placeholder="空欄=管理しない" />
                </div>
              </div>
              <p className="text-[11px] text-gray-400">
                ロール品は「何張り取れるか」を在庫にしてください（例: 200mロール ÷ 1張り10m = 20）。
              </p>
              <button onClick={save} disabled={saving}
                className="w-full py-3 rounded-xl bg-emerald-600 text-white font-black disabled:opacity-60">
                {saving ? <Loader2 size={18} className="animate-spin mx-auto" /> : '保存する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
