'use client'

import { useEffect, useState } from 'react'

interface Particle {
  id:    number
  dx:    number
  dy:    number
  emoji: string
  delay: number
  size:  number
}

interface Burst {
  key: number
  particles: Particle[]
}

const EMOJIS = ['⭐', '✨', '🌟', '💫', '🎉', '⚡', '✨', '🌟']

function makeBurst(): Burst {
  const count = 14
  const particles: Particle[] = Array.from({ length: count }, (_, i) => {
    const angle    = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.4
    const distance = 70 + Math.random() * 90
    return {
      id:    i,
      dx:    Math.cos(angle) * distance,
      dy:    Math.sin(angle) * distance,
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      delay: Math.floor(Math.random() * 80),
      size:  18 + Math.floor(Math.random() * 14),
    }
  })
  return { key: Date.now(), particles }
}

interface Props {
  /** インクリメントするたびにバーストを1回発火 */
  trigger: number
}

export default function StarBurst({ trigger }: Props) {
  const [bursts, setBursts] = useState<Burst[]>([])

  useEffect(() => {
    if (trigger === 0) return
    const burst = makeBurst()
    setBursts(prev => [...prev, burst])
    const t = setTimeout(() => setBursts(prev => prev.filter(b => b.key !== burst.key)), 900)
    return () => clearTimeout(t)
  }, [trigger])

  if (bursts.length === 0) return null

  return (
    <>
      <style>{`
        @keyframes sb-particle {
          0%   { transform: translate(0px, 0px) scale(1.4); opacity: 1; }
          60%  { opacity: 0.9; }
          100% { transform: translate(var(--sb-dx), var(--sb-dy)) scale(0.2); opacity: 0; }
        }
        @keyframes sb-flash {
          0%   { opacity: 0.6; transform: scale(1); }
          100% { opacity: 0;   transform: scale(2.5); }
        }
      `}</style>

      <div className="fixed inset-0 z-[100] pointer-events-none flex items-center justify-center">
        {bursts.map(burst => (
          <div key={burst.key} className="absolute" style={{ top: '38%', left: '50%' }}>

            {/* 中央フラッシュ */}
            <div
              className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-yellow-300/60"
              style={{ animation: 'sb-flash 0.4s ease-out forwards' }}
            />

            {/* パーティクル */}
            {burst.particles.map(p => (
              <div
                key={p.id}
                className="absolute -translate-x-1/2 -translate-y-1/2 select-none"
                style={{
                  fontSize: p.size,
                  lineHeight: 1,
                  animationName: 'sb-particle',
                  animationDuration: '0.75s',
                  animationTimingFunction: 'ease-out',
                  animationDelay: `${p.delay}ms`,
                  animationFillMode: 'forwards',
                  ['--sb-dx' as string]: `${p.dx}px`,
                  ['--sb-dy' as string]: `${p.dy}px`,
                }}
              >
                {p.emoji}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
