'use client'

import { createContext, useContext } from 'react'
import type { StoreTheme } from '@/config/themes'

const ThemeContext = createContext<StoreTheme | null>(null)

interface Props {
  theme:    StoreTheme
  children: React.ReactNode
}

export function ThemeProvider({ theme, children }: Props) {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useStoreTheme(): StoreTheme {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useStoreTheme must be used inside <ThemeProvider>')
  }
  return ctx
}

