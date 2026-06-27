import type { Metadata } from 'next'
import { cache } from 'react'
import { headers } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getStoreTheme, getColorPreset, themeCssVars } from '@/config/themes'
import { ThemeProvider } from '@/lib/theme-context'

export const dynamic = 'force-dynamic'

type Props = {
  children: React.ReactNode
  params:   { storeId: string }
}

const fetchStoreData = cache(async (storeId: string) => {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      { global: { fetch: (input, init) => fetch(input as RequestInfo, { ...init, cache: 'no-store' }) } }
    )
    const { data, error } = await supabase.from('stores').select('name').eq('id', storeId).single()
    console.log("[layout/fetch] storeId:", storeId, "/ error:", error?.message ?? null, "/ stores.name:", data?.name)
    if (!error && data) {
      return { name: data.name ?? null, themeColor: null }
    }
    return { name: null, themeColor: null }
  } catch (e) {
    console.log("[layout/fetch] CATCH storeId:", storeId, "/ error:", String(e))
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

  const reqHeaders = headers()
  const requestUrl = reqHeaders.get('x-invoke-path') ?? reqHeaders.get('referer') ?? `/${params.storeId}`
  console.log("[layout] params.storeId:", params.storeId, "/ stores.name(DB):", name, "/ theme.storeName:", resolvedTheme.storeName, "/ requestURL:", requestUrl)

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
