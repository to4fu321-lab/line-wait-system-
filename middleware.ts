import { NextRequest, NextResponse } from 'next/server'

const STORE_ID = '00000000-0000-0000-0000-000000000010'

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || ''
  const isLine = /Line\//i.test(ua)
  const path = request.nextUrl.pathname

  // トップページ(/)をLINEで開いた → 店舗受付ページへリダイレクト
  if (path === '/' && isLine) {
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
