import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// 作り込み中は非公開。公開するときは Vercel 環境変数 NEXT_PUBLIC_LP_PUBLIC=1 を設定。
const LP_PUBLIC = process.env.NEXT_PUBLIC_LP_PUBLIC === '1'

const BRAND = 'みせサポ' // TODO: 正式なサービス名に差し替え
const CONTACT = 'mailto:to4fu321@gmail.com?subject=店舗運営システムの相談' // TODO: 公開用の連絡先に差し替え

export const metadata: Metadata = {
  title: `${BRAND}｜お店の受付・お直しをスマホ1台で`,
  description: '順番待ち・お直し管理・予約・顧客管理をスマホ1台で。手書き伝票も写真でデータ化。',
  robots: { index: false, follow: false },
}

export default function LandingPage({ searchParams }: { searchParams?: { preview?: string } }) {
  if (!LP_PUBLIC && searchParams?.preview !== '1') notFound()

  const features = [
    [<IconQueue key="i" />, '順番待ち', '受付・呼び出し・完了'],
    [<IconScissors key="i" />, 'お直し管理', '受付〜お渡し・料金自動'],
    [<IconCalendar key="i" />, '予約', '採寸・来店の受付'],
    [<IconUsers key="i" />, '顧客管理', '電話番号だけでも登録'],
    [<IconCamera key="i" />, '写真OCR', 'メモを撮って自動入力'],
    [<IconChat key="i" />, 'LINE通知', '呼び出し・完了を連絡'],
  ] as const

  return (
    <main className="min-h-screen bg-white text-zinc-900 antialiased">
      {/* Nav */}
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <span className="flex items-center gap-2.5">
          <Logo /><span className="text-[17px] font-black tracking-tight">{BRAND}</span>
        </span>
        <a href={CONTACT} className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-black active:scale-95">相談する</a>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-indigo-300/30 blur-[110px]" />
          <div className="absolute -right-24 top-0 h-96 w-96 rounded-full bg-fuchsia-300/25 blur-[110px]" />
        </div>

        <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-10 pt-6 lg:grid-cols-[1fr_0.8fr] lg:pb-16 lg:pt-10">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/60 px-3.5 py-1.5 text-xs font-bold text-indigo-700">
              学生服 / 呉服 / スーツ / 婦人服のお店へ
            </span>
            <h1 className="mt-5 text-[2.25rem] font-black leading-[1.1] tracking-tight sm:text-5xl">
              お店の受付・お直しを<br />
              <span className="bg-gradient-to-r from-indigo-600 to-fuchsia-500 bg-clip-text text-transparent">スマホ1台で。</span>
            </h1>
            <p className="mx-auto mt-5 max-w-md text-balance leading-relaxed text-zinc-600 lg:mx-0">
              順番待ち・お直し・予約・顧客管理をまるごと。
              手書きの伝票も<span className="font-bold text-zinc-900">写真でそのままデータ化</span>。
            </p>
            <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
              <a href={CONTACT} className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-7 py-3.5 font-bold text-white shadow-lg shadow-zinc-900/15 transition-all hover:bg-black active:scale-[0.98] sm:w-auto">
                無料で相談する <ArrowRight />
              </a>
              <span className="text-xs text-zinc-500">初期費用なし・専用機器不要・紙と並行OK</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[15rem]">
            <div className="absolute inset-0 -z-10 translate-y-5 scale-95 rounded-[2.5rem] bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 blur-2xl" />
            <PhoneFrame><MockRepairScreen /></PhoneFrame>
          </div>
        </div>
      </section>

      {/* Features（ひと目） */}
      <section className="mx-auto max-w-5xl px-5 pb-14">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {features.map(([icon, t, d]) => (
            <div key={t} className="rounded-2xl border border-zinc-100 bg-white p-4 shadow-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-fuchsia-50 text-indigo-600">{icon}</div>
              <p className="mt-3 text-sm font-black">{t}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-14">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-zinc-900 px-6 py-12 text-center">
          <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/30 blur-3xl" />
          <div className="relative">
            <h2 className="text-2xl font-black text-white sm:text-3xl">まずは無料トライアルから。</h2>
            <p className="mx-auto mt-3 max-w-md text-sm text-zinc-300">お店に合わせた使い方をご提案します。</p>
            <a href={CONTACT} className="mt-7 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 font-bold text-zinc-900 transition-transform hover:scale-[1.02] active:scale-95">
              メールで相談する <ArrowRight />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-xs text-zinc-400">
          <span className="flex items-center gap-2"><Logo /><span className="font-black text-zinc-700">{BRAND}</span></span>
          <span>Powered by LINE × Next.js</span>
        </div>
      </footer>
    </main>
  )
}

/* ---- parts ---- */
function Logo() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-white shadow-md shadow-indigo-500/30">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9h18M3 9l1.5-4.5A2 2 0 0 1 6.4 3h11.2a2 2 0 0 1 1.9 1.5L21 9M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
      </svg>
    </span>
  )
}
function ArrowRight() {
  return <svg className="transition-transform group-hover:translate-x-0.5" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
}
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full rounded-[2.25rem] border border-zinc-200 bg-zinc-900 p-2 shadow-2xl shadow-zinc-900/20">
      <div className="absolute left-1/2 top-2 z-10 h-4 w-24 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
      <div className="overflow-hidden rounded-[1.75rem] bg-zinc-50">{children}</div>
    </div>
  )
}
function MockRepairScreen() {
  return (
    <div className="flex h-[24rem] flex-col text-left">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 pb-3.5 pt-6 text-white">
        <p className="text-[10px] font-bold text-white/70">お直し受付</p>
        <p className="text-sm font-black">内容を入力</p>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden p-3">
        <div className="rounded-xl bg-white p-2.5 shadow-sm">
          <p className="text-[9px] font-bold text-zinc-400">服種</p>
          <div className="mt-1.5 flex gap-1">
            {['スラックス', 'スカート', '上着'].map((t, i) => (
              <span key={t} className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${i === 0 ? 'bg-amber-500 text-white' : 'bg-zinc-100 text-zinc-500'}`}>{t}</span>
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-white p-2.5 shadow-sm">
          <p className="text-[9px] font-bold text-zinc-400">項目</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-800">裾上げ（シングル）</span>
            <span className="text-xs font-black text-indigo-600">¥1,200</span>
          </div>
        </div>
        <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600"><IconCamera />メモを撮影して自動入力</p>
        </div>
      </div>
      <div className="p-3"><div className="rounded-xl bg-indigo-600 py-2.5 text-center text-xs font-black text-white">受付する</div></div>
    </div>
  )
}

const sv = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
function IconQueue() { return <svg {...sv}><path d="M4 7h16M4 12h10M4 17h7" /></svg> }
function IconScissors() { return <svg {...sv}><circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="18" r="2.6" /><path d="M20 4 8.5 15.5M14.5 14.5 20 20M8 8l4 4" /></svg> }
function IconCalendar() { return <svg {...sv}><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg> }
function IconUsers() { return <svg {...sv}><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.2 3.2 0 0 1 0 6.5M21 20a6 6 0 0 0-4-5.7" /></svg> }
function IconCamera() { return <svg {...{ ...sv, width: 14, height: 14 }}><path d="M3 8a2 2 0 0 1 2-2h2l1.2-1.6a1 1 0 0 1 .8-.4h6a1 1 0 0 1 .8.4L19 6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="12.5" r="3.2" /></svg> }
function IconChat() { return <svg {...sv}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-5A8 8 0 1 1 21 12z" /></svg> }
