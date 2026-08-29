// ============================================================================
//  SMS 文面の組み立て（セグメント課金の最適化）
//
//  日本語を含むSMSは UCS-2 エンコードになり、1通=70文字。70文字を超えると
//  67文字ごとに分割され、その分だけ課金される（Twilioは1セグメント単位で課金）。
//  つまり71文字にした瞬間に料金が2倍になる。
//
//  文面は「必須部分＋任意の締め文」で組み立て、70文字に収まらなければ
//  締め文から順に落として1セグメントを死守する。
// ============================================================================

/** UCS-2 の1セグメント上限（分割時は67文字ごと） */
export const SMS_UCS2_SINGLE = 70
export const SMS_UCS2_MULTI  = 67
/** GSM-7（半角英数のみ）の場合 */
export const SMS_GSM7_SINGLE = 160
export const SMS_GSM7_MULTI  = 153

/** 日本語・絵文字など GSM-7 で表せない文字を含むか */
export function isUcs2(text: string): boolean {
  // 安全側に倒す: ASCII 以外が1文字でもあれば UCS-2 とみなす
  return /[^\x20-\x7E\r\n]/.test(text)
}

/**
 * 課金セグメント数。text.length は UTF-16 コード単位数＝UCS-2 の単位数なので、
 * サロゲートペア（絵文字）が2としてカウントされるのは意図どおり。
 */
export function smsSegments(text: string): number {
  if (!text) return 0
  const len = text.length
  const [single, multi] = isUcs2(text)
    ? [SMS_UCS2_SINGLE, SMS_UCS2_MULTI]
    : [SMS_GSM7_SINGLE, SMS_GSM7_MULTI]
  return len <= single ? 1 : Math.ceil(len / multi)
}

/**
 * 行を上から必須順に積み、1セグメントに収まる範囲で任意行を足す。
 * required は必ず入れる（超えても切らない＝情報の欠落より課金増を選ぶ）。
 */
export function fitToOneSegment(required: string[], optional: string[]): string {
  let text = required.filter(Boolean).join('\n')
  for (const line of optional) {
    if (!line) continue
    const next = `${text}\n${line}`
    if (smsSegments(next) > 1) break
    text = next
  }
  return text
}

export interface RepairSmsParts {
  kind:          'received' | 'completed'
  storeName?:    string | null
  customerName?: string | null
  /** 品名・種目（例: バドミントン / スラックス裾上げ） */
  itemName?:     string | null
  /** 依頼番号 */
  reqNo?:        string | null
  /** 受付時のみ: 仕上がり希望日 */
  desiredDate?:  string | null
}

/**
 * お直し／張替えの SMS 本文。1セグメント(70文字)に収まるよう組み立てる。
 *
 * 旧文面は見出し＋空行＋定型文で約78文字あり、常に2セグメント課金だった。
 * 「誰の・何が・どうなった・番号」を残し、挨拶と空行を削って半額にする。
 */
export function buildRepairSms(p: RepairSmsParts): string {
  const store = p.storeName?.trim() ? `【${p.storeName.trim()}】` : ''
  const name  = p.customerName?.trim() ?? ''
  const item  = p.itemName?.trim() || 'お預かり品'
  const no    = p.reqNo?.trim() ? ` No.${p.reqNo.trim()}` : ''

  if (p.kind === 'received') {
    return fitToOneSegment(
      [`${store}${item}をお預かりしました。`, `${name}様${no}`],
      [
        p.desiredDate ? `仕上がり予定 ${p.desiredDate}` : '',
        '仕上がり次第ご連絡します。',
      ],
    )
  }
  return fitToOneSegment(
    [`${store}${item}が仕上がりました。`, `${name}様${no}`],
    ['ご来店をお待ちしております。'],
  )
}
