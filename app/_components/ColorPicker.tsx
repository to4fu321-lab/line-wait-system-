'use client'

import { useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { COLOR_PRESETS } from '@/config/themes'

// カラーファミリーの順序（themes.ts の FAMILIES と対応）
const FAMILY_NAMES = ['インディゴ', 'バイオレット', 'ブルー', 'ティール', 'エメラルド', 'ローズ', 'オレンジ', 'グレー']

interface Props {
  storeId:      string
  currentColor: string | null
  onSaved:      (newColor: string) => void
  dark?:        boolean  // スーパー管理はdark背景、会社管理はzinc背景
}

export default function ColorPicker({ storeId, currentColor, onSaved, dark = false }: Props) {
  const [selected, setSelected] = useState<string>(currentColor ?? 'indigo-600')
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState(false)
  const [errMsg,   setErrMsg]   = useState<string | null>(null)

  const bg      = dark ? 'bg-gray-700/60' : 'bg-zinc-800/60'
  const border  = dark ? 'border-gray-600' : 'border-zinc-700'
  const labelCl = dark ? 'text-gray-400' : 'text-zinc-400'

  const save = async () => {
    setSaving(true)
    setErrMsg(null)
    const res = await fetch('/api/stores/theme', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storeId, themeColor: selected }),
    })
    setSaving(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setErrMsg(json.error ?? '保存失敗。SQLマイグレーションが未実行の可能性があります')
      return
    }
    setSaved(true)
    onSaved(selected)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className={`rounded-xl border ${border} ${bg} px-3 py-3 mt-2`}>
      <p className={`text-[10px] font-bold uppercase tracking-wider mb-2 ${labelCl}`}>
        テーマカラー ― 薄 → 濃
      </p>

      <div className="space-y-1.5">
        {FAMILY_NAMES.map(family => {
          const presets = COLOR_PRESETS.filter(p => p.family === family)
          return (
            <div key={family} className="flex items-center gap-2">
              <span className={`text-[10px] w-16 shrink-0 ${labelCl}`}>{family}</span>
              <div className="flex gap-2">
                {presets.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setSelected(p.key)}
                    className="relative w-7 h-7 rounded-full transition-transform active:scale-90"
                    style={{ backgroundColor: p.hex }}
                    title={`${family} ${p.shade}`}
                  >
                    {selected === p.key && (
                      <span className="absolute inset-0 rounded-full ring-2 ring-white ring-offset-1 ring-offset-transparent" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {errMsg && (
        <p className="mt-2 text-xs text-red-400 bg-red-950/40 border border-red-700/40 rounded-lg px-2 py-1.5">{errMsg}</p>
      )}
      <button
        onClick={save}
        disabled={saving || saved}
        className="mt-3 w-full py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white"
      >
        {saving ? (
          <><Loader2 size={13} className="animate-spin" />保存中…</>
        ) : saved ? (
          <><Check size={13} />保存しました</>
        ) : (
          'このカラーで保存'
        )}
      </button>
    </div>
  )
}
