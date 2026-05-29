'use client'

interface Props {
  combo:    number
  maxCombo: number
}

const FLAME_LEVELS = [
  { min: 0,  size: 'text-2xl', color: 'text-zinc-500' },
  { min: 3,  size: 'text-3xl', color: 'text-amber-400' },
  { min: 5,  size: 'text-4xl', color: 'text-orange-400' },
  { min: 10, size: 'text-5xl', color: 'text-red-400' },
  { min: 20, size: 'text-6xl', color: 'text-red-300' },
]

function getFlameLevel(combo: number) {
  return [...FLAME_LEVELS].reverse().find(l => combo >= l.min) ?? FLAME_LEVELS[0]
}

export default function ComboDisplay({ combo, maxCombo }: Props) {
  const level = getFlameLevel(combo)

  if (combo === 0) {
    return (
      <div className="min-w-[80px]">
        <div className="text-xs text-zinc-600">最高コンボ</div>
        <div className="text-sm text-zinc-500 font-bold">
          {maxCombo > 0 ? `${maxCombo} COMBO` : '---'}
        </div>
      </div>
    )
  }

  return (
    <div className="min-w-[80px]">
      <div className={`${level.size} leading-none animate-bounce`}>🔥</div>
      <div className={`text-base font-black ${level.color}`}>{combo} COMBO!</div>
    </div>
  )
}
