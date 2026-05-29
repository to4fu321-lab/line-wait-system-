'use client'

import { useEffect, useState } from 'react'

export default function ElapsedTimer({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState('')

  useEffect(() => {
    const update = () => {
      const sec = Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000)
      const m   = Math.floor(sec / 60).toString().padStart(2, '0')
      const s   = (sec % 60).toString().padStart(2, '0')
      setElapsed(`${m}:${s}`)
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [createdAt])

  return <span className="font-mono tabular-nums">{elapsed}</span>
}
