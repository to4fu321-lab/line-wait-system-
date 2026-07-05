import webpush from 'web-push'

/**
 * VAPID公開鍵は base64url デコードで必ず65バイト（0x04 + X(32) + Y(32)）になる。
 * Vercelの環境変数に空白・改行混入などで壊れた値が入っていると
 * webpush.setVapidDetails() が例外を投げ、ビルド時の
 * "Collecting page data" フェーズでアプリ全体のビルドが落ちる。
 * ここで事前検証し、不正な場合は例外を投げず通知機能だけを無効化する。
 */
function isValidVapidPublicKey(key: string): boolean {
  try {
    return Buffer.from(key, 'base64url').length === 65
  } catch {
    return false
  }
}

let ready = false
let warned = false

export function setupWebPush(subject: string, publicKey: string, privateKey: string): boolean {
  if (!publicKey || !privateKey || !isValidVapidPublicKey(publicKey)) {
    if (!warned) {
      warned = true
      console.warn('[webPushSetup] VAPIDキーが未設定または不正な形式のため、プッシュ通知は無効です（NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY を確認してください）')
    }
    return false
  }
  if (!ready) {
    webpush.setVapidDetails(subject, publicKey, privateKey)
    ready = true
  }
  return true
}

export { webpush }
