import webpush from 'web-push'

/**
 * VAPID公開鍵は base64url デコードで必ず65バイト（0x04 + X(32) + Y(32)）、
 * 秘密鍵は32バイトになる。Vercelの環境変数に空白・改行混入などで
 * 壊れた値が入っていると webpush.setVapidDetails() が例外を投げ、
 * ビルド時の "Collecting page data" フェーズでアプリ全体のビルドが落ちる。
 * ここで事前検証し、不正な場合は例外を投げず通知機能だけを無効化する。
 */
function decodedLength(key: string): number {
  try {
    return Buffer.from(key, 'base64url').length
  } catch {
    return -1
  }
}

let ready = false
let warned = false

export function setupWebPush(subject: string, publicKey: string, privateKey: string): boolean {
  const validKeys = !!publicKey && !!privateKey
    && decodedLength(publicKey) === 65
    && decodedLength(privateKey) === 32
  if (!validKeys) {
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
