import type { Metadata } from 'next'
import { getStoreTheme, themeCssVars } from '@/config/themes'
import { ThemeProvider } from '@/lib/theme-context'

type Props = {
  children: React.ReactNode
  params:   { storeId: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const theme = getStoreTheme(params.storeId)
  return {
    title:       `${theme.storeName} 受付システム`,
    description: `${theme.storeName} のWeb受付システム`,
  }
}

export default function StoreLayout({ children, params }: Props) {
  const theme = getStoreTheme(params.storeId)

  return (
    <ThemeProvider theme={theme}>
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
