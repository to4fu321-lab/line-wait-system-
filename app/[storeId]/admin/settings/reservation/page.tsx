'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ChevronLeft, Copy, Loader2, X, Clock, Users, CheckCheck, Plus, Minus,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Toast } from '@/app/_components/Toast'

interface ReservationSetting {
  id: string
  service_type: string
  label: string
  duration_min: number
  start_time: string
  end_time: string
  is_active: boolean
  slots_sun: number
  slots_mon: number
  slots_tue: number
  slots_wed: number
  slots_thu: number
  slots_fri: number
  slots_sat: number
}

const WEEKDAYS = [
  { key: 'slots_sun' as const, label: '日', label_full: '日曜日' },
  { key: 'slots_mon' as const, label: '月', label_full: '月曜日' },
  { key: 'slots_tue' as const, label: '火', label_full: '火曜日' },
  { key: 'slots_wed' as const, label: '水', label_full: '水曜日' },
  { key: 'slots_thu' as const, label: '木', label_full: '木曜日' },
  { key: 'slots_fri' as const, label: '金', label_full: '金曜日' },
  { key: 'slots_sat' as const, label: '土', label_full: '土曜日' },
] as const

type WeekdayKey = typeof WEEKDAYS[number]['key']

const sb = supabase as any

export default function ReservationSettingsPage() {
  const { storeId } = useParams<{ storeId: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)
  const [settings, setSettings] = useState<ReservationSetting[]>([])
  const [applyMode, setApplyMode] = useState<{ settingId: string; sourceDay: WeekdayKey } | null>(null)
  const [selectedDays, setSelectedDays] = useState<Set<WeekdayKey>>(new Set())

  useEffect(() => {
    if (!storeId) return
    ;(async () => {
      setLoading(true)
      const { data } = await sb.from('reservation_settings')
        .select('*')
        .eq('store_id', storeId)
        .order('service_type', { ascending: true })
      setSettings((data ?? []) as ReservationSetting[])
      setLoading(false)
    })()
  }, [storeId])

  const showToast = (type: 'ok' | 'err', msg: string) => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const updateSetting = useCallback((id: string, updates: Partial<ReservationSetting>) => {
    setSettings(prev =>
      prev.map(s => s.id === id ? { ...s, ...updates } : s)
    )
  }, [])

  const handleSave = async () => {
    if (!storeId) return
    setSaving(true)
    try {
      const { error } = await sb.from('reservation_settings')
        .upsert(settings.map(s => ({
          ...s,
          store_id: storeId,
        })))
      if (error) {
        showToast('err', `保存に失敗しました: ${error.message}`)
      } else {
        showToast('ok', '保存しました')
      }
    } catch (e: any) {
      showToast('err', `エラーが発生しました: ${e.message}`)
    } finally {
      setSaving(false)
    }
  }

  const applyToAllDays = (settingId: string, sourceDay: WeekdayKey) => {
    const setting = settings.find(s => s.id === settingId)
    if (!setting) return
    const sourceValue = setting[sourceDay]
    const updates: Partial<ReservationSetting> = {}
    for (const wd of WEEKDAYS) {
      updates[wd.key] = sourceValue
    }
    updateSetting(settingId, updates)
    showToast('ok', `${sourceDay}の値(${sourceValue}件)をすべての曜日に適用しました`)
  }

  const confirmApplyToSelectedDays = (settingId: string, sourceDay: WeekdayKey) => {
    setApplyMode({ settingId, sourceDay })
    setSelectedDays(new Set())
  }

  const doApplyToSelectedDays = () => {
    if (!applyMode) return
    const setting = settings.find(s => s.id === applyMode.settingId)
    if (!setting) return
    const sourceValue = setting[applyMode.sourceDay]
    const updates: Partial<ReservationSetting> = {}
    for (const day of Array.from(selectedDays)) {
      updates[day] = sourceValue
    }
    updateSetting(applyMode.settingId, updates)
    showToast('ok', `${applyMode.sourceDay}の値(${sourceValue}件)を${selectedDays.size}つの曜日に適用しました`)
    setApplyMode(null)
    setSelectedDays(new Set())
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-indigo-600" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/${storeId}/admin/settings/staff`}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft size={20} className="text-gray-700" />
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">採寸予約枠の設定</h1>
            <p className="text-xs text-gray-600">サービスごとの曜日別受付枠数を設定</p>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {settings.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
            <AlertCircle size={32} className="mx-auto text-gray-400 mb-3" />
            <p className="text-gray-600 text-sm">採寸予約サービスが登録されていません</p>
            <p className="text-gray-500 text-xs mt-2">計測時間と営業時間を先に設定してください</p>
          </div>
        ) : (
          settings.map(setting => (
            <div key={setting.id} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
              {/* サービス情報 */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-gray-900">{setting.label}</h3>
                  {!setting.is_active && (
                    <span className="text-[10px] font-bold px-2 py-1 bg-gray-100 text-gray-600 rounded">非表示</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {setting.start_time}〜{setting.end_time}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} /> 所要時間{setting.duration_min}分
                  </span>
                </div>
              </div>

              {/* 曜日別スロット入力 */}
              <div className="grid grid-cols-2 gap-3">
                {WEEKDAYS.map(wd => (
                  <div key={wd.key} className="space-y-1">
                    <label className="text-xs font-bold text-gray-700">{wd.label_full}</label>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateSetting(setting.id, { [wd.key]: Math.max(0, setting[wd.key] - 1) })}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        <Minus size={16} className="text-gray-700" />
                      </button>
                      <input
                        type="number"
                        min="0"
                        max="99"
                        value={setting[wd.key]}
                        onChange={e => updateSetting(setting.id, { [wd.key]: Math.max(0, parseInt(e.target.value) || 0) })}
                        className="w-12 border border-gray-300 rounded-lg px-2 py-2 text-center font-bold text-gray-900 focus:outline-none focus:border-indigo-500"
                      />
                      <button
                        onClick={() => updateSetting(setting.id, { [wd.key]: Math.min(99, setting[wd.key] + 1) })}
                        className="p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                      >
                        <Plus size={16} className="text-gray-700" />
                      </button>
                      <span className="text-xs text-gray-600 flex-1">件</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* ソース曜日選択（コピー元） */}
              <div className="border-t border-gray-200 pt-4">
                <p className="text-xs font-bold text-gray-700 mb-2">クイック適用: コピー元の曜日を選択</p>
                <div className="flex flex-wrap gap-2">
                  {WEEKDAYS.map(wd => (
                    <button
                      key={wd.key}
                      onClick={() => {
                        if (applyMode?.settingId === setting.id && applyMode.sourceDay === wd.key) {
                          setApplyMode(null)
                        } else {
                          setApplyMode({ settingId: setting.id, sourceDay: wd.key })
                        }
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-bold transition-colors ${
                        applyMode?.settingId === setting.id && applyMode.sourceDay === wd.key
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {wd.label}({setting[wd.key]})
                    </button>
                  ))}
                </div>
              </div>

              {/* コピー元が選択されている場合のアクション */}
              {applyMode?.settingId === setting.id && (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
                  <p className="text-sm font-bold text-indigo-900">
                    {WEEKDAYS.find(d => d.key === applyMode.sourceDay)?.label_full}の値 <span className="font-black text-indigo-600">{setting[applyMode.sourceDay]}</span> を適用
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => applyToAllDays(setting.id, applyMode.sourceDay)}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                    >
                      <Copy size={14} /> すべての曜日に適用
                    </button>
                    <button
                      onClick={() => confirmApplyToSelectedDays(setting.id, applyMode.sourceDay)}
                      className="flex-1 bg-indigo-100 hover:bg-indigo-200 text-indigo-700 font-bold py-2.5 rounded-lg text-sm transition-colors"
                    >
                      特定の曜日に適用
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 保存ボタン */}
      {settings.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4">
          <div className="max-w-2xl mx-auto">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-3.5 rounded-2xl transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <CheckCheck size={18} />}
              {saving ? '保存中...' : '変更を保存'}
            </button>
          </div>
        </div>
      )}

      {/* 特定曜日選択モーダル */}
      {applyMode && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="w-full bg-white rounded-t-3xl p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">適用する曜日を選択</h2>
              <button
                onClick={() => setApplyMode(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X size={20} className="text-gray-700" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {WEEKDAYS.map(wd => (
                <button
                  key={wd.key}
                  onClick={() => {
                    const newSelected = new Set(selectedDays)
                    if (newSelected.has(wd.key)) {
                      newSelected.delete(wd.key)
                    } else {
                      newSelected.add(wd.key)
                    }
                    setSelectedDays(newSelected)
                  }}
                  className={`p-4 rounded-lg font-bold text-center transition-all ${
                    selectedDays.has(wd.key)
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {wd.label_full}
                </button>
              ))}
            </div>

            <button
              onClick={doApplyToSelectedDays}
              disabled={selectedDays.size === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-bold py-3.5 rounded-2xl transition-colors"
            >
              {selectedDays.size}つの曜日に適用
            </button>
          </div>
        </div>
      )}

      {/* トースト */}
      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}

function AlertCircle({ size, className }: { size: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"></circle>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  )
}
