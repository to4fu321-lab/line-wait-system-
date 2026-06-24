import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// 作り込み中は非公開。公開するときは Vercel 環境変数 NEXT_PUBLIC_LP_PUBLIC=1 を設定。
const LP_PUBLIC = process.env.NEXT_PUBLIC_LP_PUBLIC === '1'

const BRAND = 'みせサポ' // TODO: 正式なサービス名に差し替え
const CONTACT = 'mailto:to4fu321@gmail.com?subject=無料体験の相談' // TODO: 公開用の連絡先に差し替え

export const metadata: Metadata = {
  title: `${BRAND}｜仕上がり連絡がワンタップ。学生服店の受付システム`,
  description: 'お客様への「仕上がりました」の連絡がワンタップ。電話の繋がらないストレスゼロ。受付・お直しもスマホ1台で、再来店までつながる。学生服専門店・呉服店・洋品店へ。',
  robots: { index: false, follow: false },
}

export default function LandingPage({ searchParams }: { searchParams?: { preview?: string } }) {
  if (!LP_PUBLIC && searchParams?.preview !== '1') notFound()

  return (
    <main className="min-h-screen bg-white text-zinc-900 antialiased">
      {/* Nav */}
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
        <span className="text-[17px] font-black tracking-tight">{BRAND}</span>
        <a href={CONTACT} className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-black active:scale-95">
          無料体験を申し込む
        </a>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-100">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 -z-10 h-[34rem] w-[34rem] rounded-full bg-indigo-100 blur-[120px]" />
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div className="text-center lg:text-left">
            <p className="text-sm font-bold tracking-wide text-indigo-600">学生服専門店のための受付・連絡システム（呉服店・洋品店にも）</p>
            <h1 className="mt-4 text-[2.3rem] font-black leading-[1.12] tracking-tight sm:text-[3.1rem]">
              「仕上がりました」の連絡が、<br />
              <span className="text-indigo-600">ワンタップ。</span>
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-zinc-600 lg:mx-0">
              電話が繋がらない、何度もかけ直す——そんな手間はもう要りません。
              LINEでサッとお知らせ。受付もお直しもスマホ1台でラクになり、
              <strong className="font-bold text-zinc-900">お客様の再来店まで自然につながります。</strong>
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
              <a href={CONTACT} className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-8 py-4 font-bold text-white shadow-lg shadow-zinc-900/15 transition-all hover:bg-black active:scale-[0.98] sm:w-auto">
                無料で体験する <Arrow />
              </a>
              <span className="text-sm text-zinc-500">初期費用なし・専用機器なし・今の紙と並行でOK</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[16rem]">
            <div className="absolute inset-0 -z-10 translate-y-6 scale-90 rounded-[3rem] bg-indigo-200/40 blur-2xl" />
            <PhoneFrame><MockContactScreen /></PhoneFrame>
          </div>
        </div>
      </section>

      {/* 連絡の Before / After（主役）*/}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-center text-2xl font-black tracking-tight sm:text-[2rem]">
          お客様への連絡、これだけ変わります。
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-7">
            <p className="text-xs font-black tracking-widest text-zinc-400">これまで（お電話）</p>
            <ul className="mt-5 space-y-4">
              {[
                'かけても繋がらない。何度もかけ直す',
                '留守電・折り返し待ちで時間がかかる',
                '営業時間や相手の都合が気になる',
                '伝えた内容が残らず「言った言わない」',
              ].map(t => (
                <li key={t} className="flex items-start gap-3 text-[15px] text-zinc-500">
                  <Cross /><span className="line-through decoration-zinc-300">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border-2 border-indigo-200 bg-white p-7 shadow-xl shadow-indigo-100">
            <p className="text-xs font-black tracking-widest text-indigo-600">これから（ワンタップ）</p>
            <ul className="mt-5 space-y-4">
              {[
                '一覧から選んでワンタップで送信完了',
                'LINEで確実に届く。お客様は好きな時間に確認',
                '受付時にそのまま登録、連絡もその場で',
                '送った履歴が残る。再来店のきっかけにも',
              ].map(t => (
                <li key={t} className="flex items-start gap-3 text-[15px] font-medium text-zinc-800">
                  <Check /><span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 3つの価値（②ラク・③再来店）*/}
      <section className="border-y border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 sm:grid-cols-3">
          {[
            ['とにかくラク', '連絡も受付もお直し管理もワンタップ。1人でも、繁忙期に人が増えても、同じ画面でまわる。'],
            ['確実につながる', '電話の「繋がらない」ストレスがゼロ。お客様も、好きな時間に受け取れて助かる。'],
            ['再来店につながる', 'LINEでお客様とつながり、次の制服シーズンや買い替えのときも、忘れられないお店に。'],
          ].map(([t, d], i) => (
            <div key={t}>
              <span className="text-3xl font-black text-indigo-200">0{i + 1}</span>
              <p className="mt-2 text-lg font-black">{t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA（無料体験）*/}
      <section className="px-5 py-16">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-zinc-900 px-6 py-14 text-center">
          <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/40 blur-3xl" />
          <div className="relative">
            <p className="text-sm font-bold text-indigo-300">かんたん導入・初期費用なし</p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">まずは、無料体験から。</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-300">
              お店のやり方に合わせて設定します。今の紙と並行で、無理なく試せます。
            </p>
            <a href={CONTACT} className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-bold text-zinc-900 transition-transform hover:scale-[1.02] active:scale-95">
              無料で体験する <Arrow />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-xs text-zinc-400">
          <span className="font-black text-zinc-700">{BRAND}</span>
          <span>学生服専門店のための受付・連絡システム</span>
        </div>
      </footer>
    </main>
  )
}

/* ---- parts ---- */
function Arrow() {
  return <svg className="transition-transform group-hover:translate-x-0.5" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
}
function Check() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </span>
  )
}
function Cross() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-400">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </span>
  )
}
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full rounded-[2.25rem] border border-zinc-200 bg-zinc-900 p-2 shadow-2xl shadow-zinc-900/25">
      <div className="absolute left-1/2 top-2 z-10 h-4 w-24 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
      <div className="overflow-hidden rounded-[1.75rem] bg-zinc-50">{children}</div>
    </div>
  )
}
/* モック: 仕上がり連絡（ワンタップ送信）*/
function MockContactScreen() {
  return (
    <div className="flex h-[25rem] flex-col text-left">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 pb-3.5 pt-6 text-white">
        <p className="text-[10px] font-bold text-white/70">お渡し待ち</p>
        <p className="text-sm font-black">3件 連絡できます</p>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden p-3">
        <div className="rounded-xl bg-white p-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-800">田中さま</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">仕上がり済</span>
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-400">スラックス 裾上げ</p>
          <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#06C755] py-2 text-[11px] font-black text-white">
            <Line />LINEで「仕上がり」連絡
          </div>
        </div>
        <div className="rounded-xl bg-white p-2.5 shadow-sm opacity-90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-800">佐藤さま</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-black text-zinc-500">送信済み・既読</span>
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-400">ブレザー 補修</p>
        </div>
      </div>
      <div className="p-3"><div className="rounded-xl bg-zinc-900 py-2.5 text-center text-xs font-black text-white">まとめて連絡する</div></div>
    </div>
  )
}
function Line() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.6 7.4 8.5 8 .3.07.8.22.9.5.08.27.05.68.03.95l-.14.86c-.04.25-.2 1 .88.55 1.08-.46 5.8-3.42 7.9-5.85C21.4 14.9 22 13.1 22 11.1 22 6.6 17.5 3 12 3z" /></svg>
}
