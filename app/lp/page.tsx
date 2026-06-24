import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// 作り込み中は非公開。公開するときは Vercel 環境変数 NEXT_PUBLIC_LP_PUBLIC=1 を設定。
const LP_PUBLIC = process.env.NEXT_PUBLIC_LP_PUBLIC === '1'

const BRAND = 'みせサポ' // TODO: 正式なサービス名に差し替え
const CONTACT = 'mailto:to4fu321@gmail.com?subject=店舗運営システムの相談' // TODO: 公開用の連絡先に差し替え

export const metadata: Metadata = {
  title: `${BRAND}｜紙の受付票から卒業。制服・お直し店の受付システム`,
  description: 'お直しの「どこいった？」「言った言わない」をなくす。受付からお渡しまでスマホ1台。手書きメモは撮るだけで取り込み。',
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
          相談する（無料）
        </a>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden border-b border-zinc-100">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 -z-10 h-[34rem] w-[34rem] rounded-full bg-indigo-100 blur-[120px]" />
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-14 lg:grid-cols-[1.1fr_0.9fr] lg:py-20">
          <div className="text-center lg:text-left">
            <p className="text-sm font-bold tracking-wide text-indigo-600">制服・お直しのお店のための受付システム</p>
            <h1 className="mt-4 text-[2.35rem] font-black leading-[1.12] tracking-tight sm:text-[3.25rem]">
              「あのお直し、<br className="sm:hidden" />どこいった？」を、<br />
              <span className="text-indigo-600">もう言わせない。</span>
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-zinc-600 lg:mx-0">
              受付・お直し・お渡しを<strong className="font-bold text-zinc-900">スマホ1台</strong>に。
              <br className="hidden sm:block" />
              <strong className="font-bold text-zinc-900">誰の・何のお直しが・いつ仕上がるか</strong>が、ひと目で分かる。
              手書きのメモは<strong className="font-bold text-zinc-900">撮るだけ</strong>で取り込み。
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
              <a href={CONTACT} className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-8 py-4 font-bold text-white shadow-lg shadow-zinc-900/15 transition-all hover:bg-black active:scale-[0.98] sm:w-auto">
                無料で相談する <Arrow />
              </a>
              <span className="text-sm text-zinc-500">初期費用なし・専用機器なし・今の紙と並行でOK</span>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[16rem]">
            <div className="absolute inset-0 -z-10 translate-y-6 scale-90 rounded-[3rem] bg-indigo-200/40 blur-2xl" />
            <PhoneFrame><MockRepairScreen /></PhoneFrame>
          </div>
        </div>
      </section>

      {/* Before / After（何が解決するか）*/}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-center text-2xl font-black tracking-tight sm:text-[2rem]">
          紙とエクセルの「あの大変さ」、まるごと無くなります。
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {/* Before */}
          <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-7">
            <p className="text-xs font-black tracking-widest text-zinc-400">これまで</p>
            <ul className="mt-5 space-y-4">
              {[
                '手書きの受付票が山積み。どこに何があるか分からない',
                'お直しの納期・お渡し忘れで「言った言わない」のトラブル',
                '入学シーズンは行列で大混乱。誰の番かも分からない',
                'アルバイトへの引き継ぎは口頭。ミスが起きる',
              ].map(t => (
                <li key={t} className="flex items-start gap-3 text-[15px] text-zinc-500">
                  <Cross /><span className="line-through decoration-zinc-300">{t}</span>
                </li>
              ))}
            </ul>
          </div>
          {/* After */}
          <div className="rounded-3xl border-2 border-indigo-200 bg-white p-7 shadow-xl shadow-indigo-100">
            <p className="text-xs font-black tracking-widest text-indigo-600">これから</p>
            <ul className="mt-5 space-y-4">
              {[
                '受付はスマホで30秒。手書きメモは写真で取り込むだけ',
                '仕上がり予定・お渡し・入金がひと目。取りこぼしゼロ',
                '順番待ちで呼び出しもラク。1人でも繁忙期がまわる',
                '画面を見れば誰でも分かる。引き継ぎが要らない',
              ].map(t => (
                <li key={t} className="flex items-start gap-3 text-[15px] font-medium text-zinc-800">
                  <Check /><span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 3つの価値 */}
      <section className="border-y border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto grid max-w-5xl gap-10 px-5 py-16 sm:grid-cols-3">
          {[
            ['取りこぼさない', 'お直しの納期・お渡し・入金がひと目。「あれどうなった？」が消える。'],
            ['1人でもまわる', '受付・順番待ち・予約をスマホで。繁忙期にアルバイトが増えても同じ画面。'],
            ['紙からすぐ移行', '手書きメモは撮るだけでデータ化。今までのやり方を急に変えなくていい。'],
          ].map(([t, d], i) => (
            <div key={t}>
              <span className="text-3xl font-black text-indigo-200">0{i + 1}</span>
              <p className="mt-2 text-lg font-black">{t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 py-16">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-zinc-900 px-6 py-14 text-center">
          <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/40 blur-3xl" />
          <div className="relative">
            <h2 className="text-2xl font-black text-white sm:text-3xl">まずは、繁忙期前に試してみませんか。</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-300">
              お店のやり方に合わせて設定します。閑散期に紙と並行で、無理なく始められます。
            </p>
            <a href={CONTACT} className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-bold text-zinc-900 transition-transform hover:scale-[1.02] active:scale-95">
              無料で相談する <Arrow />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-zinc-100">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-6 text-xs text-zinc-400">
          <span className="font-black text-zinc-700">{BRAND}</span>
          <span>制服・お直し店のための受付システム</span>
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
function MockRepairScreen() {
  return (
    <div className="flex h-[25rem] flex-col text-left">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 pb-3.5 pt-6 text-white">
        <p className="text-[10px] font-bold text-white/70">お直し受付・田中さま</p>
        <p className="text-sm font-black">仕上がり 6/28（あと2日）</p>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden p-3">
        <div className="rounded-xl bg-white p-2.5 shadow-sm">
          <p className="text-[9px] font-bold text-zinc-400">内容</p>
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-800">スラックス 裾上げ</span>
            <span className="text-xs font-black text-indigo-600">¥1,200</span>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 rounded-xl bg-emerald-50 p-2.5 text-center"><p className="text-[9px] font-bold text-emerald-600">状態</p><p className="text-xs font-black text-emerald-700">仕上がり済</p></div>
          <div className="flex-1 rounded-xl bg-amber-50 p-2.5 text-center"><p className="text-[9px] font-bold text-amber-600">お渡し</p><p className="text-xs font-black text-amber-700">未</p></div>
        </div>
        <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/50 p-2.5">
          <p className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-600"><Cam />メモを撮って自動入力</p>
        </div>
      </div>
      <div className="p-3"><div className="rounded-xl bg-indigo-600 py-2.5 text-center text-xs font-black text-white">お渡し完了にする</div></div>
    </div>
  )
}
function Cam() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2l1.2-1.6a1 1 0 0 1 .8-.4h6a1 1 0 0 1 .8.4L19 6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="12.5" r="3.2" /></svg>
}
