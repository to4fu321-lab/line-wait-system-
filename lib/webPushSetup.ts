import webpush from 'web-push'

/**
 * web-push ライブラリは VAPID キーを「URL-safe Base64（-_のみ、+/=を含まない）」
 * かつデコード後の長さが正しい（公開鍵65バイト・秘密鍵32バイト）ことを要求する。
 * Vercelの環境変数にコピペ時の空白・改行が混入したり、通常のBase64（+/=）が
 * 入っていると webpush.setVapidDetails() が例外を投げ、ビルド時の
 * "Collecting page data" フェーズでアプリ全体のビルドが落ちる。
 * ここで web-push と同じ基準で事前検証し、末尾の空白・改行は自動で除去した上で、
 * それでも不正な場合は例外を投げず通知機能だけを無効化する。
 */
const URL_SAFE_BASE64 = /^[A-Za-z0-9\-_]+$/

function isValidVapidKey(key: string, expectedBytes: number): boolean {
  if (!URL_SAFE_BASE64.test(key)) return false
  try {
    return Buffer.from(key, 'base64url').length === expectedBytes
  } catch {
    return false
  }
}

let ready = false
let warned = false

export function setupWebPush(subject: string, rawPublicKey: string, rawPrivateKey: string): boolean {
  // コピペで混入しがちな前後の空白・改行を除去（値そのものの文字化けまでは救えない）
  const publicKey  = rawPublicKey.trim()
  const privateKey = rawPrivateKey.trim()

  const validKeys = isValidVapidKey(publicKey, 65) && isValidVapidKey(privateKey, 32)
  if (!validKeys) {
    if (!warned) {
      warned = true
      console.warn('[webPushSetup] VAPIDキーが未設定または不正な形式のため、プッシュ通知は無効です（NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY を確認してください。URL-safe Base64（-_のみ、空白・改行・+/=を含まない）である必要があります）')
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
