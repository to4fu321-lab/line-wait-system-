import { NextRequest, NextResponse } from 'next/server'

const STORE_ID = process.env.NEXT_PUBLIC_DEFAULT_STORE_ID || ''

export function middleware(request: NextRequest) {
  const ua = request.headers.get('user-agent') || ''
  const isLine = /Line\//i.test(ua)
  const path = request.nextUrl.pathname

  // 管理系パスはLINEチェックなしで常に通過（スマホブラウザからもアクセス可）
  if (
    path.startsWith('/super-admin') ||
    path.startsWith('/company/') ||
    path.startsWith('/api/') ||
    path.includes('/admin') ||
    path.includes('/login')
  ) {
    return NextResponse.next()
  }

  // ── LINEブラウザ共通: liff.state を最優先処理 ──────────────────────
  // LIFF endpoint URL が /storeId に設定されている場合でも正しくルーティングできるよう
  // path に関わらず liff.state を検出したらそちらへリダイレクト
  if (isLine) {
    const liffState = request.nextUrl.searchParams.get('liff.state')
    if (liffState) {
      const decoded = decodeURIComponent(liffState)
      const code = request.nextUrl.searchParams.get('code')
      const oauthState = request.nextUrl.searchParams.get('state')
      const uuidMatch = decoded.match(/^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)

      if (uuidMatch) {
        // 店舗ディープリンク（QR等）→ その店舗ページへ。OAuth params も保持
        const target = new URL(decoded, request.url)
        if (code) target.searchParams.set('code', code)
        if (oauthState) target.searchParams.set('state', oauthState)
        target.searchParams.set('liff.state', liffState)
        return NextResponse.redirect(target)
      }

      // 店舗UUID以外（/line-home... / ?action=... / 空）は「必ず」ハブへ吸い込む。
      // これにより LIFFエンドポイントURLが本店(/00000000...)等へ誤設定されていても
      // 本店ページに着地せず、店舗選択ハブで正しくルーティングできる。
      const target = new URL('/line-home', request.url)
      const actionMatch = decoded.match(/[?&]action=([^&]+)/)
      if (actionMatch) target.searchParams.set('action', actionMatch[1])
      if (code) target.searchParams.set('code', code)
      if (oauthState) target.searchParams.set('state', oauthState)
      target.searchParams.set('liff.state', liffState)
      return NextResponse.redirect(target)
    }
  }

  // ── ① LINEブラウザで / にアクセス ─────────────────────
  // liff.state なし → 店舗選択ページへ
  if (path === '/' && isLine) {
    return NextResponse.redirect(new URL('/line-home', request.url))
  }

  // ── ② 非LINEブラウザで / にアクセス ────────────────────
  // LIFF URLを直接貼った場合 (?liff.state=...) は案内ページへ
  // それ以外はサービス紹介LPをそのまま表示
  if (path === '/' && !isLine) {
    const liffState = request.nextUrl.searchParams.get('liff.state')
    if (liffState) {
      const dest = new URL('/open-in-line', request.url)
      const decoded = decodeURIComponent(liffState)
      const match = decoded.match(/^(\/[0-9a-f-]{36}(?:\/[a-z-]+)?)/)
      if (match) dest.searchParams.set('to', match[1])
      return NextResponse.redirect(dest)
    }
    return NextResponse.next()
  }

  // ── ③ 店舗ページを非LINEブラウザで開いた → 案内ページへ ─
  if (!isLine) {
    const dest = new URL('/open-in-line', request.url)
    dest.searchParams.set('to', path)
    return NextResponse.redirect(dest)
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/',
    '/:storeId([0-9a-f-]{36})',
    '/:storeId([0-9a-f-]{36})/home',
    '/:storeId([0-9a-f-]{36})/queue',
    '/:storeId([0-9a-f-]{36})/repair',
    '/:storeId([0-9a-f-]{36})/onboarding',
    '/:storeId([0-9a-f-]{36})/crm-register',
  ],
}
