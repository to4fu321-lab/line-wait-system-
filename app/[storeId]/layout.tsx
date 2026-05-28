import type { Metadata } from 'next'
import { cache } from 'react'
import { createClient } from '@supabase/supabase-js'
import { getStoreTheme, themeCssVars } from '@/config/themes'
import { ThemeProvider } from '@/lib/theme-context'

type Props = {
  children: React.ReactNode
  params:   { storeId: string }
}

const fetchStoreName = cache(async (storeId: string): Promise<string | null> => {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
    )
    const { data } = await supabase.from('stores').select('name').eq('id', storeId).single()
    return data?.name ?? null
  } catch {
    return null
  }
})

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dbName = await fetchStoreName(params.storeId)
  const theme = getStoreTheme(params.storeId)
  const storeName = dbName || theme.storeName
  return {
    title:       `${storeName} 受付システム`,
    description: `${storeName} のWeb受付システム`,
  }
}

export default async function StoreLayout({ children, params }: Props) {
  const dbName = await fetchStoreName(params.storeId)
  const theme = getStoreTheme(params.storeId)
  const resolvedTheme = dbName ? { ...theme, storeName: dbName } : theme

  return (
    <ThemeProvider theme={resolvedTheme}>
      <div
        className="min-h-screen relative"
        style={{
          ...themeCssVars(theme),
          background: [
            `radial-gradient(circle at 0% 0%, rgb(${theme.colors.primaryRgb} / 0.18), transparent 55%)`,
            `radial-gradient(circle at 100% 100%, rgb(${theme.colors.accentRgb} / 0.12), transparent 55%)`,
            `radial-gradient(circle at 50% 50%, rgb(${theme.colors.primaryRgb} / 0.04), transparent 70%)`,
            '#fafafa',
          ].join(', '),
        } as React.CSSProperties}
      >
        {children}
      </div>
    </ThemeProvider>
  )
}
