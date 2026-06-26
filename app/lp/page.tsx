import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// 作り込み中は非公開。公開するときは Vercel 環境変数 NEXT_PUBLIC_LP_PUBLIC=1 を設定。
const LP_PUBLIC = process.env.NEXT_PUBLIC_LP_PUBLIC === '1'

const BRAND = 'ミセプラ'
const START = '/start'   // 無料体験：その場で店舗を発行し即ログイン
const TRIAL_DAYS = 30

export const metadata: Metadata = {
  title: `${BRAND}｜手書きの良さはそのまま。順番待ちと連絡だけ、らくに。`,
  description: '学生服店のための受付システム。今までの手書きはそのまま残せます。面倒な順番待ちの管理と「仕上がりました」のご連絡だけを、らくにします。まるでベテランの店員さんがもう一人増えたように、混雑とご案内をそっとお手伝い。30日間無料でお試しいただけます。',
  robots: { index: false, follow: false },
}

export default function LandingPage({ searchParams }: { searchParams?: { preview?: string } }) {
  if (!LP_PUBLIC && searchParams?.preview !== '1') notFound()

  return (
    <main className="relative min-h-screen overflow-x-hidden text-zinc-900 antialiased">
      {/* ===== Global atmospheric background ===== */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-50/60 via-white to-indigo-50/50" />
        <div className="absolute -left-40 top-[-10rem] h-[40rem] w-[40rem] animate-float-slow rounded-full bg-indigo-200/40 blur-[140px]" />
        <div className="absolute -right-40 top-[20rem] h-[38rem] w-[38rem] animate-float-slower rounded-full bg-amber-200/40 blur-[140px]" />
        <div className="absolute bottom-[-12rem] left-1/3 h-[34rem] w-[34rem] animate-float-slow rounded-full bg-sky-200/40 blur-[140px]" />
        <div
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(99,102,241,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.06) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 0%, black 40%, transparent 100%)',
          }}
        />
      </div>

      {/* ===== Floating glass nav ===== */}
      <div className="sticky top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
        <header className="mx-auto flex h-16 max-w-5xl items-center justify-between rounded-2xl border border-white/60 bg-white/70 px-4 shadow-lg shadow-indigo-900/5 backdrop-blur-xl sm:px-5">
          <span className="flex items-center gap-2 text-[19px] font-black tracking-tight text-zinc-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-base text-white shadow-md shadow-indigo-500/30">ミ</span>
            {BRAND}
          </span>
          <a
            href={START}
            className="group inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-3 text-[15px] font-bold text-white shadow-lg shadow-indigo-500/25 transition-all hover:shadow-xl hover:shadow-indigo-500/40 active:scale-95"
          >
            無料で試してみる <Arrow />
          </a>
        </header>
      </div>

      {/* ===== Hero ===== */}
      <section className="relative">
        <div className="mx-auto grid max-w-5xl items-center gap-12 px-5 pb-16 pt-12 lg:grid-cols-[1.1fr_0.9fr] lg:pb-24 lg:pt-20">
          <div className="animate-rise-in text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/80 px-4 py-2 text-[14px] font-bold tracking-wide text-indigo-700 shadow-sm backdrop-blur-md">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-indigo-600" />
              </span>
              学生服専門店のための、やさしい受付システム
            </span>
            <h1 className="mt-6 text-[2.3rem] font-black leading-[1.18] tracking-tight text-zinc-900 sm:text-[3.1rem]">
              今までの手書きは、<br className="hidden sm:block" />
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 bg-clip-text text-transparent animate-gradient-pan">そのままで大丈夫。</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-[19px] leading-[1.85] text-zinc-700 lg:mx-0">
              長年つづけてきた手書きの台帳には、お店の温かみがあります。
              ぜんぶをパソコンに変える必要はありません。
              <strong className="font-bold text-zinc-900">「順番待ちの管理」と「お客様へのご連絡」だけ</strong>を、
              らくにする道具です。
            </p>
            <div className="mt-8 flex flex-col items-center gap-3.5 sm:flex-row lg:items-start">
              <a
                href={START}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-8 py-5 text-[18px] font-bold text-white shadow-xl shadow-indigo-500/30 transition-all hover:shadow-2xl hover:shadow-indigo-500/45 active:scale-[0.98] sm:w-auto"
              >
                {TRIAL_DAYS}日間 無料でためす <Arrow />
              </a>
              <span className="text-[15px] text-zinc-500">クレジットカード不要・むずかしい登録なし</span>
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

      {/* ===== 業界の現実への共感 ===== */}
      <section className="mx-auto max-w-3xl px-5 py-12">
        <div className="rounded-3xl border border-white/70 bg-white/60 p-8 text-center shadow-lg shadow-zinc-900/5 backdrop-blur-xl sm:p-10">
          <p className="text-[15px] font-black tracking-widest text-amber-600">この業界のこと、わかっています</p>
          <p className="mt-4 text-balance text-[22px] font-black leading-[1.6] text-zinc-900 sm:text-[26px]">
            学生服のお店は、いまも<br className="sm:hidden" />
            <span className="text-indigo-700">9割が手書き</span>だと言われます。
          </p>
          <p className="mx-auto mt-5 max-w-xl text-[17px] leading-[1.9] text-zinc-600">
            それは、決して遅れているからではありません。
            お客様の顔を見て、手で書きとめる——その丁寧さが、信頼を支えてきました。
            だから私たちは「ぜんぶ変えましょう」とは言いません。
            <strong className="font-bold text-zinc-900">今のやり方を残しながら、困っているところだけ</strong>、そっとお手伝いします。
          </p>
        </div>
      </section>

      {/* ===== 安心のハイブリッド提案 ===== */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-balance text-center text-[26px] font-black leading-snug tracking-tight text-zinc-900 sm:text-[2rem]">
          手書きの良さは、残します。<br className="sm:hidden" />
          面倒なところだけ、らくに。
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-center text-[17px] leading-relaxed text-zinc-600">
          無理にやり方を変えなくて大丈夫。今の台帳と一緒に、すこしずつ使えます。
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-amber-200/70 bg-gradient-to-br from-amber-50/80 to-white/70 p-8 shadow-lg shadow-amber-100/40 backdrop-blur-xl">
            <p className="text-[15px] font-black tracking-widest text-amber-700">そのまま残すもの</p>
            <ul className="mt-6 space-y-5">
              {[
                '手書きの台帳や、お客様との会話',
                'お店ならではの、丁寧なご対応',
                '長年つちかった、お客様との信頼',
              ].map(t => (
                <li key={t} className="flex items-start gap-3 text-[17px] font-medium text-zinc-800">
                  <Heart /><span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-white/90 to-indigo-50/80 p-8 shadow-2xl shadow-indigo-200/50 backdrop-blur-xl">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-400/30 blur-2xl" />
            <p className="relative text-[15px] font-black tracking-widest text-indigo-600">らくにするところ</p>
            <ul className="relative mt-6 space-y-5">
              {[
                '混み合う日の「順番待ち」の管理',
                'お客様への「仕上がりました」のご連絡',
                'なかなか電話が繋がらない、かけ直しの手間',
              ].map(t => (
                <li key={t} className="flex items-start gap-3 text-[17px] font-medium text-zinc-800">
                  <Check /><span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ===== AIアシスタント＝もう一人のベテラン店員 ===== */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/60 p-8 shadow-xl shadow-indigo-100/40 backdrop-blur-xl sm:p-12">
          <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr]">
            <div className="order-2 mx-auto w-full max-w-[15rem] lg:order-1">
              <div className="animate-phone-float">
                <PhoneFrame><MockAssistantScreen /></PhoneFrame>
              </div>
            </div>
            <div className="order-1 text-center lg:order-2 lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200/70 bg-white/80 px-4 py-2 text-[14px] font-bold text-indigo-700 shadow-sm">
                やさしいお手伝い役
              </span>
              <h2 className="mt-5 text-balance text-[26px] font-black leading-snug tracking-tight text-zinc-900 sm:text-[2rem]">
                まるで、ベテランの店員さんが<br className="hidden sm:block" />
                <span className="text-indigo-700">もう一人、増えたみたいに。</span>
              </h2>
              <p className="mx-auto mt-6 max-w-xl text-[18px] leading-[1.9] text-zinc-700 lg:mx-0">
                むずかしいことは、何も覚えなくて大丈夫です。
                お店が混んできたら「そろそろ田中さまのご案内を」とそっと教えてくれて、
                お客様へのご連絡も、ボタンひとつで代わりに準備してくれます。
                <strong className="font-bold text-zinc-900">人手が足りない忙しい日も、いつもそばで支えてくれる</strong>——
                そんな、頼れるお手伝い役です。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 連絡の Before / After ===== */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-balance text-center text-[26px] font-black tracking-tight text-zinc-900 sm:text-[2rem]">
          お客様へのご連絡が、こんなにらくに。
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <div className="rounded-3xl border border-white/70 bg-white/50 p-8 shadow-lg shadow-zinc-900/5 backdrop-blur-xl">
            <p className="text-[15px] font-black tracking-widest text-zinc-400">これまで（お電話）</p>
            <ul className="mt-6 space-y-5">
              {[
                'かけても繋がらず、何度もかけ直す',
                '留守番電話や折り返し待ちで、時間がかかる',
                'お客様のご都合や、時間帯が気になる',
                '伝えたことが残らず、行きちがいになる',
              ].map(t => (
                <li key={t} className="flex items-start gap-3 text-[16px] text-zinc-500">
                  <Cross /><span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="relative overflow-hidden rounded-3xl border border-indigo-200/80 bg-gradient-to-br from-white/90 to-indigo-50/80 p-8 shadow-2xl shadow-indigo-200/50 backdrop-blur-xl">
            <div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-400/30 blur-2xl" />
            <p className="relative text-[15px] font-black tracking-widest text-indigo-600">これから（ボタンひとつ）</p>
            <ul className="relative mt-6 space-y-5">
              {[
                '一覧から選んで、ボタンひとつでご連絡',
                'LINEで確実に届き、お客様は好きな時間に確認',
                '受付のときに登録すれば、連絡もその場で',
                '送った記録が残り、次のご来店のきっかけにも',
              ].map(t => (
                <li key={t} className="flex items-start gap-3 text-[16px] font-medium text-zinc-800">
                  <Check /><span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ===== 3つのうれしいこと ===== */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="grid gap-5 sm:grid-cols-3">
          {[
            ['とにかく、らく', 'むずかしい操作はありません。受付も、順番待ちも、お直しの管理も、おなじ画面で見られます。'],
            ['お客様に、確実に届く', '電話の「繋がらない」がなくなります。お客様も、ご都合のよい時間に受け取れて安心です。'],
            ['また来てもらえる', 'LINEでつながるから、次の制服シーズンや買い替えのときも、忘れられないお店になります。'],
          ].map(([t, d], i) => (
            <div
              key={t}
              className="group rounded-3xl border border-white/70 bg-white/55 p-7 shadow-lg shadow-zinc-900/5 backdrop-blur-xl transition-all hover:-translate-y-1 hover:shadow-xl hover:shadow-indigo-200/50"
            >
              <span className="bg-gradient-to-br from-indigo-500 to-violet-500 bg-clip-text text-4xl font-black text-transparent">
                0{i + 1}
              </span>
              <p className="mt-3 text-[20px] font-black text-zinc-900">{t}</p>
              <p className="mt-2 text-[16px] leading-relaxed text-zinc-600">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA（無料体験）===== */}
      <section className="px-5 py-16">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-zinc-950 px-6 py-16 text-center shadow-2xl shadow-indigo-900/30">
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
            <p className="text-[15px] font-bold text-indigo-300">クレジットカード不要・むずかしい登録なし</p>
            <h2 className="mt-3 text-balance text-[26px] font-black leading-snug text-white sm:text-[2.25rem]">まずは{TRIAL_DAYS}日間、<br className="sm:hidden" />無料でためしてみませんか。</h2>
            <p className="mx-auto mt-5 max-w-md text-[17px] leading-[1.9] text-zinc-300">
              お店の名前を入れるだけで、すぐにお使いいただけます。
              今までの手書きと一緒に、無理なくお試しください。
            </p>
            <a
              href={START}
              className="group mt-9 inline-flex items-center gap-2 rounded-full bg-white px-9 py-5 text-[18px] font-bold text-zinc-900 shadow-xl shadow-black/20 transition-transform hover:scale-[1.03] active:scale-95"
            >
              今すぐ無料ではじめる <Arrow />
            </a>
            <p className="mt-5 text-[14px] text-zinc-400">わからないことは、いつでもお気軽にご相談ください。</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-white/60 bg-white/40 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-5 py-7 text-[13px] text-zinc-400 sm:flex-row sm:justify-between">
          <span className="font-black text-zinc-700">{BRAND}</span>
          <span className="text-center sm:text-right">学生服専門店のための、やさしい受付システム</span>
        </div>
      </footer>
    </main>
  )
}

/* ---- parts ---- */
function Arrow() {
  return <svg className="transition-transform group-hover:translate-x-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
}
function Check() {
  return (
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/40">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </span>
  )
}
function Cross() {
  return (
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-400">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </span>
  )
}
function Heart() {
  return (
    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-amber-500 text-white shadow-sm shadow-amber-400/40">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-10-9.2C.5 8.4 2.2 5 5.6 5c2 0 3.4 1.2 4.4 2.5C11 6.2 12.4 5 14.4 5 17.8 5 19.5 8.4 22 11.8 19.5 16.4 12 21 12 21z" /></svg>
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
/* モック: 仕上がり連絡（ボタンひとつ送信）*/
function MockContactScreen() {
  return (
    <div className="flex h-[25rem] flex-col text-left">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 pb-3.5 pt-6 text-white">
        <p className="text-[10px] font-bold text-white/70">お渡し待ち</p>
        <p className="text-sm font-black">3件 ご連絡できます</p>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden p-3">
        <div className="rounded-xl bg-white p-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-800">田中さま</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">仕上がり済</span>
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-400">スラックス 裾上げ</p>
          <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#06C755] py-2 text-[11px] font-black text-white">
            <Line />LINEで「仕上がり」ご連絡
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
      <div className="p-3"><div className="rounded-xl bg-zinc-900 py-2.5 text-center text-xs font-black text-white">まとめてご連絡する</div></div>
    </div>
  )
}
/* モック: AIアシスタントのそっとしたお知らせ */
function MockAssistantScreen() {
  return (
    <div className="flex h-[25rem] flex-col text-left">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-3.5 pb-3.5 pt-6 text-white">
        <p className="text-[10px] font-bold text-white/70">お手伝い役より</p>
        <p className="text-sm font-black">いまのお店のようす</p>
      </div>
      <div className="flex-1 space-y-2.5 overflow-hidden p-3">
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-[9px] font-black text-white">ミ</span>
            <span className="text-[10px] font-black text-zinc-500">お手伝い役</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-700">
            いま少し混んできました。<br />そろそろ <span className="font-bold text-indigo-700">田中さま</span> のご案内を。
          </p>
        </div>
        <div className="rounded-xl bg-white p-3 shadow-sm">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-[9px] font-black text-white">ミ</span>
            <span className="text-[10px] font-black text-zinc-500">お手伝い役</span>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-700">
            佐藤さまの仕上がりのご連絡、<br />準備しておきました。
          </p>
          <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#06C755] py-1.5 text-[10px] font-black text-white">
            <Line />このまま送る
          </div>
        </div>
      </div>
      <div className="p-3"><div className="rounded-xl bg-zinc-900 py-2.5 text-center text-xs font-black text-white">おまかせする</div></div>
    </div>
  )
}
function Line() {
  return <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.6 7.4 8.5 8 .3.07.8.22.9.5.08.27.05.68.03.95l-.14.86c-.04.25-.2 1 .88.55 1.08-.46 5.8-3.42 7.9-5.85C21.4 14.9 22 13.1 22 11.1 22 6.6 17.5 3 12 3z" /></svg>
}
