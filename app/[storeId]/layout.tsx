import type { Metadata } from 'next'
import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getStoreTheme, getColorPreset, themeCssVars } from '@/config/themes'
import { ThemeProvider } from '@/lib/theme-context'

type Props = {
  children: React.ReactNode
  params:   { storeId: string }
}

const fetchStoreData = cache(async (storeId: string) => {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )
    const { data } = await supabase.from('stores').select('name, theme_color').eq('id', storeId).single()
    return { name: data?.name ?? null, themeColor: data?.theme_color ?? null }
  } catch {
    return { name: null, themeColor: null }
  }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await fetchStoreData(params.storeId)
  const base = getStoreTheme(params.storeId)
  const storeName = name || base.storeName
  return {
    title:       `${storeName} 受付システム`,
    description: `${storeName} のWeb受付システム`,
  }
}

export default async function StoreLayout({ children, params }: Props) {
  const { name, themeColor } = await fetchStoreData(params.storeId)
  const base = getStoreTheme(params.storeId)
  const resolvedTheme = {
    ...base,
    ...(name        ? { storeName: name }                  : {}),
    ...(themeColor  ? { colors: getColorPreset(themeColor) ?? base.colors } : {}),
  }

  return (
    <ThemeProvider theme={resolvedTheme}>
      <div
        className="min-h-screen relative"
        style={{
          ...themeCssVars(resolvedTheme),
          background: [
            `radial-gradient(circle at 0% 0%, rgb(${resolvedTheme.colors.primaryRgb} / 0.18), transparent 55%)`,
            `radial-gradient(circle at 100% 100%, rgb(${resolvedTheme.colors.accentRgb} / 0.12), transparent 55%)`,
            `radial-gradient(circle at 50% 50%, rgb(${resolvedTheme.colors.primaryRgb} / 0.04), transparent 70%)`,
            '#fafafa',
          ].join(', '),
        } as React.CSSProperties}
      >
        {children}
      </div>
    </ThemeProvider>
  )
}
