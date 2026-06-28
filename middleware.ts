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
      const uuidMatch = decoded.match(/^\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/)
      if (uuidMatch) {
        // /line-home 経由にして多店舗選択を機能させる
        // liff.state を /line-home?to=<元パス> にすることで LIFF SDK も /line-home に留まる
        // 未登録ユーザーが QR コードで来た場合は to パラメータでその店舗へ遷移する
        const newLiffState = '/line-home?to=' + encodeURIComponent(decoded)
        const target = new URL('/line-home', request.url)
        const code = request.nextUrl.searchParams.get('code')
        const oauthState = request.nextUrl.searchParams.get('state')
        if (code) target.searchParams.set('code', code)
        if (oauthState) target.searchParams.set('state', oauthState)
        target.searchParams.set('liff.state', newLiffState)

// ★追加
target.searchParams.set('to', decoded)

return NextResponse.redirect(target)
      }
      if (decoded.startsWith('/line-home')) {
        // liff.state と OAuth params (code/state) を保持してリダイレクト
        // LIFF SDK が認証を完了できるよう auth context を引き継ぐ
        const target = new URL(decoded, request.url)
        const code = request.nextUrl.searchParams.get('code')
        const oauthState = request.nextUrl.searchParams.get('state')
        if (code) target.searchParams.set('code', code)
        if (oauthState) target.searchParams.set('state', oauthState)
        target.searchParams.set('liff.state', liffState)
        return NextResponse.redirect(target)
      }
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
