import { NextResponse } from 'next/server'
import { getStoreTheme } from '@/config/themes'

export const dynamic = 'force-dynamic'

// 店舗ごとの管理画面PWAマニフェスト。start_url/scope を自店舗の管理画面に
// 固定することで、ホーム画面ショートカットが常に自店舗のデータに戻るようにする。
// (Next.js の静的 manifest.ts 規約は動的セグメント配下では出力されないため、
//  Route Handler で直接 application/manifest+json を返す)
export async function GET(_req: Request, { params }: { params: { storeId: string } }) {
  const { storeName } = getStoreTheme(params.storeId)
  const adminUrl = `/${params.storeId}/admin`

  return NextResponse.json(
    {
      name: `${storeName} 管理画面`,
      short_name: `${storeName}管理`,
      description: `${storeName} 順番待ち受付・管理システム`,
      start_url: adminUrl,
      scope: adminUrl,
      display: 'standalone',
      orientation: 'portrait-primary',
      background_color: '#09090b',
      theme_color: '#09090b',
      lang: 'ja',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    { headers: { 'Content-Type': 'application/manifest+json' } },
  )
}
