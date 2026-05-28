'use client'

import { useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { COLOR_PRESETS, buildCustomThemeColors } from '@/config/themes'

// カラーファミリーの順序（themes.ts の FAMILIES と対応）
const FAMILY_NAMES = ['インディゴ', 'バイオレット', 'ブルー', 'スカイ', 'ティール', 'エメラルド', 'ライム', 'イエロー', 'オレンジ', 'レッド', 'ローズ', 'フクシア', 'グレー']

interface Props {
  storeId:      string
  currentColor: string | null
  onSaved:      (newColor: string) => void
  dark?:        boolean  // スーパー管理はdark背景、会社管理はzinc背景
}

function isValidHex(v: string) { return /^#[0-9a-f]{6}$/i.test(v) }

export default function ColorPicker({ storeId, currentColor, onSaved, dark = false }: Props) {
  const initCustom = currentColor?.startsWith('custom:') ? currentColor.slice(7) : '#'
  const [selected,   setSelected]   = useState<string>(currentColor ?? 'indigo-600')
  const [customHex,  setCustomHex]  = useState<string>(initCustom)
  const [saving,     setSaving]     = useState(false)
  const [saved,      setSaved]      = useState(false)
  const [errMsg,     setErrMsg]     = useState<string | null>(null)

  const applyCustom = () => {
    if (!isValidHex(customHex)) return
    setSelected(`custom:${customHex}`)
  }

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

      {/* カスタムHEX入力 */}
      <div className={`mt-3 pt-3 border-t ${border}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${labelCl}`}>カスタムカラー</p>
        <div className="flex gap-2 items-center">
          <div className="relative w-7 h-7 rounded-full shrink-0 border border-white/20 overflow-hidden">
            {isValidHex(customHex)
              ? <div className="w-full h-full" style={{ backgroundColor: customHex }} />
              : <div className="w-full h-full bg-gradient-to-br from-red-400 via-yellow-400 to-blue-500" />
            }
            {selected.startsWith('custom:') && selected === `custom:${customHex}` && (
              <span className="absolute inset-0 rounded-full ring-2 ring-white ring-offset-1 ring-offset-transparent" />
            )}
          </div>
          <input
            value={customHex}
            onChange={e => setCustomHex(e.target.value)}
            placeholder="#RRGGBB"
            maxLength={7}
            className={`flex-1 bg-transparent border ${border} rounded-lg px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-white/40`}
          />
          <button
            onClick={applyCustom}
            disabled={!isValidHex(customHex)}
            className="px-3 py-1 rounded-lg text-xs font-bold bg-white/10 hover:bg-white/20 disabled:opacity-30 text-white transition-all"
          >
            適用
          </button>
        </div>
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
