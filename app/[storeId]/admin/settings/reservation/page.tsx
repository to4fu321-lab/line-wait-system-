'use client'

// ============================================================
// 採寸予約設定（曜日ごとの受付枠 / 採寸メニュー）
//   reservation_settings を編集する画面。
//   来店予約ウィザード・お客様LINEの予約は、この設定が1件も無いと
//   フォールバックの固定値（平日2枠・土曜3枠）で動くため、
//   店舗ごとに枠を調整する手段がこれまで存在しなかった。
// ============================================================
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Plus, Trash2, Save, CalendarClock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { FeatureGuard } from '@/app/_components/FeatureGuard'
import { Toast } from '@/app/_components/Toast'

const sb = supabase as any

interface ResvSetting {
  id?: string
  service_type: string
  label: string
  duration_min: number
  start_time: string
  end_time: string
  slots_sun: number; slots_mon: number; slots_tue: number; slots_wed: number
  slots_thu: number; slots_fri: number; slots_sat: number
  is_active: boolean
}

const WEEKDAYS: { key: keyof ResvSetting; label: string }[] = [
  { key: 'slots_sun', label: '日' }, { key: 'slots_mon', label: '月' }, { key: 'slots_tue', label: '火' },
  { key: 'slots_wed', label: '水' }, { key: 'slots_thu', label: '木' }, { key: 'slots_fri', label: '金' },
  { key: 'slots_sat', label: '土' },
]

const EMPTY: ResvSetting = {
  service_type: '', label: '', duration_min: 60, start_time: '10:00', end_time: '17:00',
  slots_sun: 0, slots_mon: 2, slots_tue: 2, slots_wed: 2, slots_thu: 2, slots_fri: 2, slots_sat: 2,
  is_active: true,
}

function ReservationSettingsPage() {
  const params  = useParams<{ storeId: string }>()
  const storeId = params?.storeId ?? ''
  const router  = useRouter()

  const [rows,    setRows]    = useState<ResvSetting[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState<number | null>(null)
  const [toast,   setToast]   = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  // 試着室の実数（stores.active_fittings）。シフト管理の「人員設計」タブと
  // 同じ値を共有する。曜日別の同時受付枠は「試着室が何室あるか」で決まるのが
  // 自然なので、新規メニュー追加時の初期値のヒントとしてここでも使う
  // （あくまで初期値。曜日ごとの個別調整は引き続き手動で可能）。
  const [rooms,       setRooms]       = useState('')
  const [roomsSaving,  setRoomsSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data, error }, { data: store }] = await Promise.all([
      sb.from('reservation_settings').select('*').eq('store_id', storeId).order('duration_min', { ascending: false }),
      sb.from('stores').select('active_fittings').eq('id', storeId).maybeSingle(),
    ])
    if (error) setToast({ type: 'err', msg: `読み込みに失敗しました: ${error.message}` })
    setRows((data ?? []) as ResvSetting[])
    if (store?.active_fittings) setRooms(String(store.active_fittings))
    setLoading(false)
  }, [storeId])

  useEffect(() => { if (storeId) load() }, [storeId, load])

  const saveRooms = async () => {
    const n = Number(rooms)
    if (!Number.isFinite(n) || n <= 0) { setToast({ type: 'err', msg: '1以上の数値を入力してください' }); return }
    setRoomsSaving(true)
    const { error } = await sb.from('stores').update({ active_fittings: n }).eq('id', storeId)
    setRoomsSaving(false)
    if (error) { setToast({ type: 'err', msg: `保存に失敗しました: ${error.message}` }); return }
    setToast({ type: 'ok', msg: '試着室数を保存しました' })
  }

  const update = (i: number, patch: Partial<ResvSetting>) =>
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))

  const addRow = () => {
    const hint = Number(rooms)
    const base = Number.isFinite(hint) && hint > 0 ? hint : EMPTY.slots_mon
    setRows(prev => [...prev, {
      ...EMPTY,
      slots_sun: 0, slots_mon: base, slots_tue: base, slots_wed: base,
      slots_thu: base, slots_fri: base, slots_sat: base,
    }])
  }

  const save = async (i: number) => {
    const row = rows[i]
    if (!row.service_type.trim() || !row.label.trim()) {
      setToast({ type: 'err', msg: '種別キーとメニュー名は必須です' }); return
    }
    setSaving(i)
    const payload = { ...row, store_id: storeId }
    const { data, error } = row.id
      ? await sb.from('reservation_settings').update(payload).eq('id', row.id).select().single()
      : await sb.from('reservation_settings').insert(payload).select().single()
    setSaving(null)
    if (error) { setToast({ type: 'err', msg: `保存に失敗しました: ${error.message}` }); return }
    update(i, data as ResvSetting)
    setToast({ type: 'ok', msg: '保存しました' })
  }

  const remove = async (i: number) => {
    const row = rows[i]
    if (row.id) {
      const { error } = await sb.from('reservation_settings').delete().eq('id', row.id)
      if (error) { setToast({ type: 'err', msg: `削除に失敗しました: ${error.message}` }); return }
    }
    setRows(prev => prev.filter((_, idx) => idx !== i))
    setToast({ type: 'ok', msg: '削除しました' })
  }

  const INPUT = 'w-full border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-indigo-500 bg-white'

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="sticky top-0 z-40 bg-gradient-to-r from-indigo-700 to-violet-700">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => router.push(`/${storeId}/admin/settings/staff`)}
            className="p-1.5 rounded-lg hover:bg-white/15 text-white/90 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <h1 className="flex-1 text-white font-black text-base flex items-center gap-1.5">
            <CalendarClock size={18} />採寸予約設定
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4 pb-28 space-y-4">
        <p className="text-xs text-gray-500 leading-relaxed px-1">
          採寸メニューごとに、曜日別の受付可能枠数・受付時間帯・所要時間を設定します。<br />
          この設定が1件もない場合は、平日2枠・土曜3枠の仮設定で動作します。
        </p>

        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <label className="block text-[11px] font-bold text-gray-500 mb-1">試着室の実数</label>
          <div className="flex items-center gap-2">
            <input type="text" inputMode="numeric" value={rooms}
              onChange={e => setRooms(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="例: 3"
              className="w-20 border border-gray-300 rounded-xl px-3 py-2 text-sm text-center" />
            <button onClick={saveRooms} disabled={roomsSaving}
              className="px-4 py-2 rounded-xl bg-indigo-600 text-white font-bold text-sm disabled:opacity-60">
              {roomsSaving ? '保存中…' : '保存'}
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 leading-relaxed">
            設定→シフト管理の人員設計や、お客様LINEの混雑表示にも使われます。<br />
            下の「採寸メニューを追加」を押したとき、曜日別枠数の初期値としても使われます（あとから曜日ごとに調整できます）。
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center text-gray-400 text-sm py-8 bg-white rounded-2xl border border-gray-200">
            採寸メニューが未設定です。<br />下のボタンから追加してください。
          </div>
        ) : (
          <div className="space-y-4">
            {rows.map((row, i) => (
              <div key={row.id ?? `new-${i}`} className="bg-white rounded-2xl border border-gray-200 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">種別キー（例: uniform）</label>
                    <input className={INPUT} value={row.service_type}
                      onChange={e => update(i, { service_type: e.target.value })}
                      disabled={!!row.id} placeholder="uniform" />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">メニュー名</label>
                    <input className={INPUT} value={row.label}
                      onChange={e => update(i, { label: e.target.value })} placeholder="制服採寸" />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">所要時間(分)</label>
                    <input className={INPUT} type="number" min={5} step={5} value={row.duration_min}
                      onChange={e => update(i, { duration_min: Number(e.target.value) || 0 })} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">受付開始</label>
                    <input className={INPUT} type="time" value={row.start_time}
                      onChange={e => update(i, { start_time: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1">受付終了</label>
                    <input className={INPUT} type="time" value={row.end_time}
                      onChange={e => update(i, { end_time: e.target.value })} />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 mb-1.5">曜日ごとの同時受付枠数（試着室の数など）</label>
                  <div className="grid grid-cols-7 gap-1.5">
                    {WEEKDAYS.map(w => (
                      <div key={String(w.key)} className="text-center">
                        <p className="text-[10px] text-gray-400 mb-0.5">{w.label}</p>
                        <input type="number" min={0} className="w-full border border-gray-300 rounded-lg px-1 py-1.5 text-center text-sm"
                          value={row[w.key] as number}
                          onChange={e => update(i, { [w.key]: Number(e.target.value) || 0 } as Partial<ResvSetting>)} />
                      </div>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">0にするとその曜日は受付を締め切ります</p>
                </div>

                <label className="flex items-center gap-2 text-xs font-bold text-gray-600">
                  <input type="checkbox" checked={row.is_active}
                    onChange={e => update(i, { is_active: e.target.checked })} />
                  有効にする
                </label>

                <div className="flex gap-2 pt-1">
                  <button onClick={() => save(i)} disabled={saving === i}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-sm disabled:opacity-60">
                    {saving === i ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    保存
                  </button>
                  <button onClick={() => remove(i)}
                    className="px-4 py-2.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm border border-red-200">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <button onClick={addRow}
          className="w-full flex items-center justify-center gap-1.5 py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-bold text-sm active:scale-[0.99] transition-all">
          <Plus size={16} />採寸メニューを追加
        </button>
      </div>
    </div>
  )
}

export default function Page() {
  const storeId = useParams<{ storeId: string }>()?.storeId ?? ''
  return (
    <FeatureGuard storeId={storeId} feature="reservation">
      <ReservationSettingsPage />
    </FeatureGuard>
  )
}
