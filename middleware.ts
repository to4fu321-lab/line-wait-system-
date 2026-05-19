import { NextRequest, NextResponse } from 'next/server'

const STORE_ID = '00000000-0000-0000-0000-000000000010'

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || ''
  const isLine = /Line\//i.test(ua)
  const path = request.nextUrl.pathname

  if (path === '/' && isLine) {
    // liff.state に storeId が含まれていればそちらへリダイレクト（多店舗対応）
    const liffState = request.nextUrl.searchParams.get('liff.state')
    if (liffState) {
      const match = decodeURIComponent(liffState).match(/^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)
      if (match) {
        return NextResponse.redirect(new URL(`/${match[1]}`, request.url))
      }
    }
    return NextResponse.redirect(new URL(`/${STORE_ID}`, request.url))
  }

  // 店舗ページをLINE以外のブラウザで開いた → 案内ページへ
  if (!isLine) {
    return NextResponse.rewrite(new URL('/open-in-line', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/', '/:storeId([0-9a-f-]{36})'],
}
