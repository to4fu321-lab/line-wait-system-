import { NextRequest, NextResponse } from 'next/server'

const STORE_ID = '00000000-0000-0000-0000-000000000010'

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || ''
  const isLine = /Line\//i.test(ua)
  const path = request.nextUrl.pathname

  if (path === '/' && isLine) {
    // liff.state に storeId が含まれていればそちらへリダイレクト（多店舗対応）
    // サブパス・クエリパラメータも含めてそのまま転送する
    const liffState = request.nextUrl.searchParams.get('liff.state')
    if (liffState) {
      const decoded = decodeURIComponent(liffState)
      const match = decoded.match(/^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)
      if (match) {
        // /{storeId}/crm-register や /{storeId}?mode=crm_register も正しく転送
        return NextResponse.redirect(new URL(decoded, request.url))
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
  matcher: ['/', '/:storeId([0-9a-f-]{36})', '/:storeId([0-9a-f-]{36})/crm-register'],
}
