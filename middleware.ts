import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || ''
  const isLine = /Line\//i.test(ua)

  if (!isLine) {
    // LINE以外 → 案内ページを表示（storeIdをクエリで渡す）
    const storeId = request.nextUrl.pathname.split('/')[1]
    return NextResponse.rewrite(
      new URL(`/open-in-line?storeId=${storeId}`, request.url)
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/:storeId([0-9a-f-]{36})'],
}
