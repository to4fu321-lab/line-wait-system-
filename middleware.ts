import { NextRequest, NextResponse } from 'next/server'

const LIFF_ID = process.env.NEXT_PUBLIC_LIFF_ID || '2010126882-aUahQStD'

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || ''
  const isLine = /Line\//i.test(ua)

  // LINE以外のブラウザからお客様ページにアクセスした場合はLIFFへリダイレクト
  if (!isLine) {
    return NextResponse.redirect(`https://liff.line.me/${LIFF_ID}`)
  }

  return NextResponse.next()
}

export const config = {
  // /{storeId} のみ対象（admin・API・ルートは除外）
  matcher: ['/:storeId([0-9a-f-]{36})'],
}
