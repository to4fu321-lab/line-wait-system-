import type { Metadata } from 'next'
import { getStoreTheme } from '@/config/themes'

type Props = {
  children: React.ReactNode
  params:   { storeId: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const theme = getStoreTheme(params.storeId)
  return {
    title: `お客様登録 | ${theme.storeName}`,
  }
}

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children
}
