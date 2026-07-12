import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// 作り込み中は非公開。公開するときは Vercel 環境変数 NEXT_PUBLIC_LP_PUBLIC=1 を設定。
const LP_PUBLIC = process.env.NEXT_PUBLIC_LP_PUBLIC === '1'

const BRAND = 'ミセプラ'
const START = '/start'   // 無料体験：その場で店舗を発行し即ログイン
const TRIAL_DAYS = 30

// dev/preview環境でのみ管理画面への直リンクを出す動作確認用ショートカット。
// 本番(production)では絶対に表示しない（実店舗のURLを公開LPに晒さないため）。
const IS_PRODUCTION = process.env.VERCEL_ENV === 'production'
const DEV_ADMIN_STORE_ID = 'befb5519-e488-4c6f-983f-f18b577ed7ad' // ひものや

export const metadata: Metadata = {
  title: `${BRAND}｜仕上がり連絡がワンタップ。学生服店の受付システム`,
  description: 'お客様への「仕上がりました」の連絡がワンタップ。電話の繋がらないストレスゼロ。受付・お直しもスマホ1台で、再来店までつながる。学生服専門店のためのトータルDX。30日間無料・今すぐ使えます。',
  robots: { index: false, follow: false },
}

export default function LandingPage() {
  // searchParams(?preview=1)による裏口は使わない。これがあるだけでNext.jsが
  // このページを動的(毎リクエストSSR)扱いにし、コールドスタートで初回表示が
  // 数秒遅くなっていたため撤廃。非公開にしたい間は環境変数だけで制御する
  // (Vercelのプレビュー環境ではNEXT_PUBLIC_LP_PUBLICを未設定のままにすればよい)。
  if (!LP_PUBLIC) notFound()

  return (
    // bg-zinc-50: 全体レイアウトのbodyが黒(zinc-950・管理画面用)のため、
    // LP自身に明るい下地を持たせないと描画完了までの間 真っ黒な画面が見える
    <main className="relative min-h-screen overflow-x-hidden bg-zinc-50 text-zinc-900 antialiased">
      {/* ===== [DEV専用] 管理画面ショートカット（本番では非表示） ===== */}
      {!IS_PRODUCTION && (
        <a
          href={`/${DEV_ADMIN_STORE_ID}/admin`}
          className="fixed bottom-4 right-4 z-[60] rounded-full bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl shadow-black/30 transition-transform hover:scale-105 active:scale-95"
        >
          🛠️ [DEV] 管理画面へ
        </a>
      )}

      {/* ===== Global atmospheric background ===== */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-50 via-white to-indigo-50/60" />
        <div className="absolute -left-40 top-[-10rem] h-[40rem] w-[40rem] animate-float-slow rounded-full bg-indigo-300/40 blur-[140px]" />
        <div className="absolute -right-40 top-[20rem] h-[38rem] w-[38rem] animate-float-slower rounded-full bg-violet-300/40 blur-[140px]" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[34rem] w-[34rem] animate-float-slow rounded-full bg-sky-200/40 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(99,102,241,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.07) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
          }}
        />
      </div>

      {/* ===== Floating glass nav ===== */}
      <div className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
        <header className="mx-auto flex h-14 max-w-5xl items-center justify-between rounded-2xl border border-white/60 bg-white/60 px-4 shadow-lg shadow-indigo-900/5 backdrop-blur-xl sm:px-5">
          <span className="flex items-center gap-2 text-[17px] font-black tracking-tight text-zinc-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-sm text-white shadow-md shadow-indigo-500/30">ミ</span>
            {BRAND}
          </span>
          <a
            href={START}
            className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/40 active:scale-95"
          >
            無料で始める <Arrow />
          </a>
        </header>
      </div>

      {/* ===== Hero ===== */}
      <section className="relative">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-5 pb-16 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-20">
          <div className="animate-rise-in text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/70 px-3.5 py-1.5 text-xs font-bold tracking-wide text-indigo-700 shadow-sm backdrop-blur-md">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-600" />
              </span>
              学生服専門店のための トータルDX
            </span>
            <h1 className="mt-5 text-[2.4rem] font-black leading-[1.1] tracking-tight text-zinc-900 sm:text-[3.25rem]">
              「仕上がりました」の連絡が、<br />
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent animate-gradient-pan">
                ワンタップ。
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-lg text-[17px] leading-relaxed text-zinc-600 lg:mx-0">
              電話が繋がらない、何度もかけ直す——そんな手間はもう要りません。
              LINEでサッとお知らせ。受付もお直しもスマホ1台でラクになり、
              <strong className="font-bold text-zinc-900">お客様の再来店まで自然につながります。</strong>
            </p>
            <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-400 lg:mx-0">
              <span className="font-bold text-zinc-500">ミセプラ</span>＝お店のぜんぶが集まる場所。
              <span className="whitespace-nowrap">Plaza・Platform・Plan・Plus</span> をひとつに。
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
              <a
                href={START}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-4 font-bold text-white shadow-xl shadow-indigo-500/30 transition-all hover:shadow-2xl hover:shadow-indigo-500/45 active:scale-[0.98] sm:w-auto"
              >
                {TRIAL_DAYS}日間 無料で始める <Arrow />
              </a>
              <span className="text-sm text-zinc-500">クレカ不要・メール登録なし・今すぐ使えます</span>
            </div>
          </div>

          <div className="animate-rise-in relative mx-auto w-full max-w-[16rem] [animation-delay:150ms]">
            <div aria-hidden className="absolute inset-0 -z-10 translate-y-8 scale-90 rounded-[3rem] bg-gradient-to-br from-indigo-400/50 to-violet-400/50 blur-3xl" />
            <div className="animate-phone-float">
              <PhoneFrame><MockContactScreen /></PhoneFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 連絡の Before / After（主役）===== */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-balance text-center text-2xl font-black tracking-tight text-zinc-900 sm:text-[2rem]">
          お客様への連絡、これだけ変わります。
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/70 bg-white/50 p-7 shadow-lg shadow-zinc-900/5 backdrop-blur-xl">
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
          <div className="relative overflow-hidden rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-white/90 to-indigo-50/80 p-7 shadow-2xl shadow-indigo-200/50 backdrop-blur-xl">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-400/30 blur-2xl" />
            <p className="relative text-xs font-black tracking-widest text-indigo-600">これから（ワンタップ）</p>
            <ul className="relative mt-5 space-y-4">
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

      {/* ===== 3つの価値（②ラク・③再来店）===== */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            ['とにかくラク', '連絡も受付もお直し管理もワンタップ。1人でも、繁忙期に人が増えても、同じ画面でまわる。'],
            ['確実につながる', '電話の「繋がらない」ストレスがゼロ。お客様も、好きな時間に受け取れて助かる。'],
            ['再来店につながる', 'LINEでお客様とつながり、次の制服シーズンや買い替えのときも、忘れられないお店に。'],
          ].map(([t, d], i) => (
            <div
              key={t}
              className="group rounded-3xl border border-white/70 bg-white/55 p-6 shadow-lg shadow-zinc-900/5 backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-200/50"
            >
              <span className="bg-gradient-to-br from-indigo-500 to-violet-500 bg-clip-text text-3xl font-black text-transparent">
                0{i + 1}
              </span>
              <p className="mt-2 text-lg font-black text-zinc-900">{t}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA（無料体験）===== */}
      <section className="px-5 py-16">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-950 px-6 py-14 text-center shadow-2xl shadow-indigo-900/30">
          <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 animate-float-slow rounded-full bg-indigo-500/40 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 animate-float-slower rounded-full bg-violet-500/40 blur-3xl" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          <div className="relative">
            <p className="text-sm font-bold text-indigo-300">クレカ不要・メール登録なし・今すぐ使える</p>
            <h2 className="mt-2 text-balance text-2xl font-black text-white sm:text-3xl">{TRIAL_DAYS}日間、無料ではじめる。</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-zinc-300">
              お店の名前を入れるだけ。すぐに使えるお店の画面ができます。今の紙と並行で、無理なく試せます。
            </p>
            <a
              href={START}
              className="group mt-8 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-bold text-zinc-900 shadow-xl shadow-black/20 transition-transform hover:scale-[1.03] active:scale-95"
            >
              今すぐ無料で始める <Arrow />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/60 bg-white/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-5 py-6 text-xs text-zinc-400 sm:flex-row sm:justify-between">
          <span className="font-black text-zinc-700">{BRAND}</span>
          <span className="text-center sm:text-right">学生服専門店のためのトータルDX ／ 店 × Plaza・Platform・Plan・Plus</span>
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
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/40">
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
    <div className="relative mx-auto w-full rounded-[2.25rem] border border-zinc-700/50 bg-zinc-900 p-2 shadow-2xl shadow-indigo-900/40 ring-1 ring-white/10">
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
