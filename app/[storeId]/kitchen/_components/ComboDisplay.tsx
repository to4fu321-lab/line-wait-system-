'use client'

import { useEffect, useRef, useState } from 'react'

interface Props {
  combo:    number
  maxCombo: number
}

const LEVELS = [
  { min: 0,  flames: '🔥',       numCls: 'text-5xl',  comboCls: 'text-sm',   color: 'text-amber-400',  glow: ''                              },
  { min: 5,  flames: '🔥🔥',     numCls: 'text-6xl',  comboCls: 'text-base', color: 'text-orange-400', glow: 'drop-shadow-[0_0_8px_#f97316]'  },
  { min: 10, flames: '🔥🔥🔥',   numCls: 'text-7xl',  comboCls: 'text-lg',   color: 'text-red-400',    glow: 'drop-shadow-[0_0_12px_#f87171]' },
  { min: 20, flames: '🔥🔥🔥🔥', numCls: 'text-8xl',  comboCls: 'text-xl',   color: 'text-red-300',    glow: 'drop-shadow-[0_0_18px_#fca5a5]' },
]

function getLevel(combo: number) {
  return [...LEVELS].reverse().find(l => combo >= l.min) ?? LEVELS[0]
}

export default function ComboDisplay({ combo, maxCombo }: Props) {
  const [bumping,  setBumping]  = useState(false)
  const [flicker,  setFlicker]  = useState(false)
  const prevCombo = useRef(combo)

  useEffect(() => {
    if (combo > 0 && combo !== prevCombo.current) {
      setBumping(true)
      const t1 = setTimeout(() => setBumping(false), 250)
      if (combo >= 10) {
        setFlicker(true)
        const t2 = setTimeout(() => setFlicker(false), 400)
        prevCombo.current = combo
        return () => { clearTimeout(t1); clearTimeout(t2) }
      }
      prevCombo.current = combo
      return () => clearTimeout(t1)
    }
    prevCombo.current = combo
  }, [combo])

  const lv = getLevel(combo)

  if (combo === 0) {
    return (
      <div className="min-w-[80px]">
        <div className="text-[10px] text-zinc-600 uppercase tracking-widest font-bold leading-none mb-1">
          最高コンボ
        </div>
        <div className="text-base text-zinc-500 font-black leading-none">
          {maxCombo > 0 ? `${maxCombo} COMBO` : '---'}
        </div>
      </div>
    )
  }

  return (
    <div className={`min-w-[80px] flex flex-col items-start select-none transition-transform duration-150 origin-left ${
      bumping ? 'scale-125' : 'scale-100'
    } ${flicker ? 'animate-pulse' : ''}`}>
      <div className="text-xl leading-none -mb-1">{lv.flames}</div>
      <div className={`font-black tabular-nums leading-none ${lv.numCls} ${lv.color} ${lv.glow}`}>
        {combo}
      </div>
      <div className={`font-black leading-none tracking-wider ${lv.comboCls} ${lv.color} opacity-80`}>
        COMBO!
      </div>
    </div>
  )
}
