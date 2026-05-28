import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import SwRegister from './sw-register'
import './globals.css'

export const metadata: Metadata = {
  title: '受付システム',
  description: 'Web受付システム',
  robots: 'noindex,nofollow',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '受付システム',
  },
  icons: {
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#09090b',
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="bg-zinc-950">
        {children}
        <SwRegister />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
