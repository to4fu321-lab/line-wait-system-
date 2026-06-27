import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import Script from 'next/script'
import SwRegister from './sw-register'
import './globals.css'

export const metadata: Metadata = {
  title: '店舗運営支援システム',
  description: '学生服販売店向け 店舗運営支援システム — 受付・採寸・お直し・発注・CRM・LINE通知をまるごとサポート',
  robots: 'noindex,nofollow',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '店舗運営支援システム',
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
        {/* DEBUG: eruda mobile console — remove after log capture */}
        <Script src="https://cdn.jsdelivr.net/npm/eruda" strategy="afterInteractive" />
        <Script id="eruda-init" strategy="afterInteractive">{`eruda.init()`}</Script>
      </body>
    </html>
  )
}
