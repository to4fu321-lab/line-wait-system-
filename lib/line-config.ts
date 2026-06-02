export type BizType = 'uniform' | 'takeout'

export function storeBizType(businessType: string | null | undefined): BizType {
  return businessType === 'takeout' ? 'takeout' : 'uniform'
}

// Client + Server: NEXT_PUBLIC_ vars available in both environments
export function getLiffId(biz: BizType = 'uniform'): string {
  if (biz === 'takeout') {
    return process.env.NEXT_PUBLIC_LIFF_ID_TAKEOUT || process.env.NEXT_PUBLIC_LIFF_ID || ''
  }
  return process.env.NEXT_PUBLIC_LIFF_ID_UNIFORM || process.env.NEXT_PUBLIC_LIFF_ID || ''
}

export function getLiffBaseUrl(biz: BizType = 'uniform'): string {
  const id = getLiffId(biz)
  return id ? `https://liff.line.me/${id}` : ''
}

// Server-only: non-NEXT_PUBLIC_ vars (undefined on client)
export function getLineToken(biz: BizType = 'uniform'): string {
  if (biz === 'takeout') {
    return process.env.LINE_CHANNEL_ACCESS_TOKEN_TAKEOUT || process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
  }
  return process.env.LINE_CHANNEL_ACCESS_TOKEN_UNIFORM || process.env.LINE_CHANNEL_ACCESS_TOKEN || ''
}

export function getLineSecret(biz: BizType = 'uniform'): string {
  if (biz === 'takeout') {
    return process.env.LINE_CHANNEL_SECRET_TAKEOUT || process.env.LINE_CHANNEL_SECRET || ''
  }
  return process.env.LINE_CHANNEL_SECRET_UNIFORM || process.env.LINE_CHANNEL_SECRET || ''
}
