'use client'

import { useState, useEffect } from 'react'

export function useSimpleMode(storeId: string) {
  const [isSimpleMode, setIsSimpleMode] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !storeId) return
    setIsSimpleMode(localStorage.getItem(`simple-mode-${storeId}`) === 'true')
    setIsLoaded(true)
  }, [storeId])

  function toggle() {
    const next = !isSimpleMode
    setIsSimpleMode(next)
    if (typeof window !== 'undefined') {
      next
        ? localStorage.setItem(`simple-mode-${storeId}`, 'true')
        : localStorage.removeItem(`simple-mode-${storeId}`)
    }
  }

  return { isSimpleMode, isLoaded, toggle }
}
