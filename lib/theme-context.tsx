'use client'

import { createContext, useContext, type CSSProperties } from 'react'
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

/**
 * テーマカラーを CSS 変数として返す。layout などの最上位 div に渡す。
 * 子コンポーネントから var(--theme-primary) などで参照可能。
 */
export function themeCssVars(theme: StoreTheme): CSSProperties {
  return {
    '--theme-primary':       theme.colors.primary,
    '--theme-primary-dark':  theme.colors.primaryDark,
    '--theme-primary-light': theme.colors.primaryLight,
    '--theme-primary-rgb':   theme.colors.primaryRgb,
    '--theme-accent':        theme.colors.accent,
    '--theme-accent-rgb':    theme.colors.accentRgb,
  } as CSSProperties
}
