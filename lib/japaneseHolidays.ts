// ============================================================
// 日本の祝日判定
//
//  予約カレンダーで「この日は祝日」と分かるようにするためだけの用途。
//  外部APIに依存すると通信断でカレンダーが壊れるので、計算で求める。
//  祝日法の改正で変わりうる部分（春分・秋分、ハッピーマンデー）も
//  式で持つ。過去の一時的な移動（五輪年など）までは追わない。
// ============================================================

export interface Holiday { date: string; name: string }

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`

/** その月の n 回目の月曜日の日にち */
function nthMonday(year: number, month: number, nth: number): number {
  const firstDow = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  // 1日の曜日から最初の月曜(1)までの差
  const firstMonday = 1 + ((8 - firstDow) % 7)
  return firstMonday + (nth - 1) * 7
}

/** 春分の日（近似式・1980〜2099年で実用上一致する） */
function vernalEquinox(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

/** 秋分の日（同上） */
function autumnalEquinox(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4))
}

/** 指定年の祝日（振替休日・国民の休日を含む）を日付順で返す */
export function holidaysOfYear(year: number): Holiday[] {
  const base: Holiday[] = [
    { date: ymd(year, 1, 1),   name: '元日' },
    { date: ymd(year, 1, nthMonday(year, 1, 2)),  name: '成人の日' },
    { date: ymd(year, 2, 11),  name: '建国記念の日' },
    { date: ymd(year, 2, 23),  name: '天皇誕生日' },
    { date: ymd(year, 3, vernalEquinox(year)),    name: '春分の日' },
    { date: ymd(year, 4, 29),  name: '昭和の日' },
    { date: ymd(year, 5, 3),   name: '憲法記念日' },
    { date: ymd(year, 5, 4),   name: 'みどりの日' },
    { date: ymd(year, 5, 5),   name: 'こどもの日' },
    { date: ymd(year, 7, nthMonday(year, 7, 3)),  name: '海の日' },
    { date: ymd(year, 8, 11),  name: '山の日' },
    { date: ymd(year, 9, nthMonday(year, 9, 3)),  name: '敬老の日' },
    { date: ymd(year, 9, autumnalEquinox(year)),  name: '秋分の日' },
    { date: ymd(year, 10, nthMonday(year, 10, 2)), name: 'スポーツの日' },
    { date: ymd(year, 11, 3),  name: '文化の日' },
    { date: ymd(year, 11, 23), name: '勤労感謝の日' },
  ].sort((a, b) => a.date.localeCompare(b.date))

  const byDate = new Map(base.map(h => [h.date, h]))

  // 振替休日: 祝日が日曜なら、その後の最初の平日を休みにする
  for (const h of base) {
    const d = new Date(h.date + 'T00:00:00Z')
    if (d.getUTCDay() !== 0) continue
    do { d.setUTCDate(d.getUTCDate() + 1) }
    while (byDate.has(d.toISOString().slice(0, 10)))
    byDate.set(d.toISOString().slice(0, 10), { date: d.toISOString().slice(0, 10), name: '振替休日' })
  }

  // 国民の休日: 祝日に前後を挟まれた平日（実際には敬老の日と秋分の日の間だけ）
  for (const h of base) {
    const d = new Date(h.date + 'T00:00:00Z')
    d.setUTCDate(d.getUTCDate() + 2)
    const after = d.toISOString().slice(0, 10)
    d.setUTCDate(d.getUTCDate() - 1)
    const between = d.toISOString().slice(0, 10)
    const bd = new Date(between + 'T00:00:00Z')
    if (byDate.has(after) && !byDate.has(between) && bd.getUTCDay() !== 0) {
      byDate.set(between, { date: between, name: '国民の休日' })
    }
  }

  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date))
}

/** YYYY-MM-DD が祝日ならその名前、違えば null */
export function holidayName(date: string): string | null {
  const year = Number(date.slice(0, 4))
  if (!Number.isFinite(year)) return null
  return holidaysOfYear(year).find(h => h.date === date)?.name ?? null
}

/** 指定年月(1-based)の祝日を { 'YYYY-MM-DD': '名前' } で返す */
export function holidayMapOfMonth(year: number, month: number): Record<string, string> {
  const prefix = `${year}-${pad(month)}-`
  const out: Record<string, string> = {}
  for (const h of holidaysOfYear(year)) {
    if (h.date.startsWith(prefix)) out[h.date] = h.name
  }
  return out
}
