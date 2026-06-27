import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

const LP_PUBLIC = process.env.NEXT_PUBLIC_LP_PUBLIC === '1'
const BRAND = 'ミセプラ'
const START = '/start'
const TRIAL_DAYS = 30

export const metadata: Metadata = {
  title: `${BRAND}｜電話のかけ直しゼロ。学生服店の順番案内・仕上がり連絡をLINEで`,
  description: '手書きはそのままで大丈夫。電話のかけ直しと順番待ちのご案内だけ、LINEでラクに。まるでもう一人のベテランスタッフが増えたような安心感。学生服専門店向け。30日間無料。',
  robots: { index: false, follow: false },
}

export default function LandingPage({ searchParams }: { searchParams?: { preview?: string } }) {
  if (!LP_PUBLIC && searchParams?.preview !== '1') notFound()

  return (
    <main className="relative min-h-screen overflow-x-hidden bg-stone-50 text-zinc-900 antialiased">
      {/* ===== Global background ===== */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-stone-50 via-white to-indigo-50/30" />
      </div>

      {/* ===== Nav ===== */}
      <div className="sticky top-0 z-50 border-b border-stone-200 bg-white/90 backdrop-blur-xl">
        <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <span className="flex items-center gap-2.5 text-lg font-black tracking-tight text-zinc-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-600 text-base text-white shadow-md shadow-indigo-500/30">
              ミ
            </span>
            {BRAND}
          </span>
          <a
            href={START}
            className="inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-colors hover:bg-indigo-700 active:scale-95"
          >
            {TRIAL_DAYS}日間 無料で試す <Arrow />
          </a>
        </header>
      </div>

      {/* ===== Hero ===== */}
      <section className="relative">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 pb-16 pt-14 lg:grid-cols-[1.15fr_0.85fr] lg:pb-24 lg:pt-20">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-1.5 text-sm font-bold text-indigo-700">
              学生服専門店のためのサービス
            </span>

            <h1 className="mt-5 text-[2rem] font-black leading-[1.25] tracking-tight text-zinc-900 sm:text-[2.6rem]">
              手書きの温かさは、<br />
              <span className="text-indigo-600">そのままに。</span>
              <br />
              <span className="text-[1.6rem] sm:text-[2rem]">
                電話のかけ直しと<br />
                順番待ちの案内だけ<br />
                ラクになりました。
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-lg text-[17px] leading-[1.85] text-zinc-600 lg:mx-0">
              採寸票も伝票も、手書きのままで大丈夫です。<br />
              お客様への「仕上がりました」の連絡と、<br />
              順番待ちのご案内だけをLINEでスマートに。
            </p>

            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
              <a
                href={START}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-indigo-600 px-8 py-4 text-lg font-bold text-white shadow-xl shadow-indigo-500/25 transition-colors hover:bg-indigo-700 active:scale-[0.98] sm:w-auto"
              >
                {TRIAL_DAYS}日間 無料で試してみる <Arrow />
              </a>
            </div>
            <p className="mt-3 text-center text-sm text-zinc-400 lg:text-left">
              クレジットカード不要 ／ メール登録なし ／ 今の手書きと並行OK
            </p>
          </div>

          <div className="relative mx-auto w-full max-w-[15rem]">
            <div aria-hidden className="absolute inset-0 -z-10 translate-y-8 scale-90 rounded-[3rem] bg-indigo-400/25 blur-3xl" />
            <div className="animate-phone-float">
              <PhoneFrame>
                <MockContactScreen />
              </PhoneFrame>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Empathy ===== */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-5">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
              業界への理解
            </p>
            <h2 className="mt-3 text-balance text-[1.75rem] font-black leading-snug tracking-tight text-zinc-900 sm:text-[2.25rem]">
              アナログ手書き9割の業界を、<br />
              私たちはよく知っています。
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-[1.9] text-zinc-600">
              採寸票も、お直しの伝票も、受付帳も——手書きの方が正確で、安心できる。<br />
              長年積み上げてきたやり方を、無理やり変える必要はまったくありません。<br />
              <strong className="font-bold text-zinc-900">
                ミセプラがお手伝いするのは、そのうちの「面倒なところ」だけです。
              </strong>
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            <div className="rounded-3xl border-2 border-stone-200 bg-stone-50 p-7">
              <p className="text-sm font-black text-stone-500">手書きのまま使い続けるもの ✎</p>
              <ul className="mt-5 space-y-3.5">
                {[
                  '採寸票・サイズの記録',
                  'お直しの伝票・内容のメモ',
                  'お客様との会話・接客',
                  '商品の選び方・アドバイス',
                ].map(t => (
                  <li key={t} className="flex items-center gap-3 text-[15px] font-medium text-zinc-600">
                    <span className="text-stone-300 text-lg">—</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border-2 border-indigo-200 bg-indigo-50 p-7">
              <p className="text-sm font-black text-indigo-600">ミセプラがサポートする「面倒なところ」</p>
              <ul className="mt-5 space-y-3.5">
                {[
                  '順番待ちのご案内（自動）',
                  '仕上がりのLINE連絡（ワンタップ）',
                  '「まだですか？」の電話が来なくなる',
                  'お客様情報のまとめ管理',
                ].map(t => (
                  <li key={t} className="flex items-center gap-3 text-[15px] font-medium text-zinc-800">
                    <Check />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Pain Points ===== */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="text-balance text-center text-[1.75rem] font-black leading-snug tracking-tight text-zinc-900 sm:text-[2.25rem]">
            こんなお悩み、<br className="sm:hidden" />
            ありませんか？
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-zinc-200 bg-white p-7 shadow-sm">
              <p className="text-xs font-black tracking-widest text-zinc-400">今のお悩み</p>
              <ul className="mt-5 space-y-4">
                {[
                  '電話してもなかなか繋がらず、何度もかけ直している',
                  '「もう仕上がってますか？」と来店されて、まだ準備中…',
                  '繁忙期は1人では対応しきれず、お客様を待たせてしまう',
                  '連絡先が散らばって、次のシーズンのフォローができない',
                ].map(t => (
                  <li key={t} className="flex items-start gap-3 text-[15px] text-zinc-500">
                    <Cross />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative overflow-hidden rounded-3xl border border-indigo-200 bg-white p-7 shadow-lg shadow-indigo-100">
              <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-indigo-100/60 blur-2xl" />
              <p className="relative text-xs font-black tracking-widest text-indigo-600">
                ミセプラを使うと
              </p>
              <ul className="relative mt-5 space-y-4">
                {[
                  '仕上がったらLINEで自動お知らせ。電話不要に',
                  '「仕上がりました」をLINEで先にお伝えできる',
                  '順番待ちはシステムが自動でご案内してくれる',
                  'お客様情報がまとまり、次シーズンもつながれる',
                ].map(t => (
                  <li key={t} className="flex items-start gap-3 text-[15px] font-medium text-zinc-800">
                    <Check />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== AIアシスタント＝ベテラン店員 ===== */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-5">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">
              AIアシスタント
            </p>
            <h2 className="mt-3 text-balance text-[1.75rem] font-black leading-snug tracking-tight text-zinc-900 sm:text-[2.25rem]">
              まるで、もう一人の<br />
              ベテラン店員が増えたような<br />
              <span className="text-indigo-600">安心感。</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-[1.9] text-zinc-600">
              「AIアシスタント」という難しい言葉は置いておきましょう。<br />
              ミセプラは、お店の混雑状況を自動で把握して、<br />
              お客様に「今◯番目です」「仕上がりましたよ」と<br />
              あなたの代わりに丁寧にご案内してくれる、<br />
              <strong className="font-bold text-zinc-900">頼れるサポーターです。</strong>
            </p>
            <p className="mx-auto mt-3 max-w-2xl text-[16px] leading-[1.9] text-zinc-500">
              あなたは採寸や接客に集中できます。<br />
              細かい連絡や順番管理は、ミセプラにおまかせください。
            </p>
          </div>

          <div className="mt-12 grid gap-5 sm:grid-cols-3">
            {[
              {
                num: '01',
                title: '順番待ちを自動でご案内',
                desc: 'お客様がQRコードをスマホで読むと、自動で「◯番目です」とLINEに届きます。受付の手間がぐっと減ります。',
              },
              {
                num: '02',
                title: '仕上がりはLINEで一発通知',
                desc: '一覧画面からお名前を選んでタップするだけ。「仕上がりました」のメッセージが届きます。電話不要です。',
              },
              {
                num: '03',
                title: '次のシーズンもつながれる',
                desc: 'お客様の情報が自動で蓄積。次の制服シーズンや買い替えのときも、忘れられないお店になれます。',
              },
            ].map(({ num, title, desc }) => (
              <div
                key={num}
                className="rounded-3xl border border-zinc-200 bg-stone-50 p-6 shadow-sm"
              >
                <span className="text-4xl font-black text-indigo-100">{num}</span>
                <p className="mt-2 text-lg font-black text-zinc-900">{title}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== How Simple ===== */}
      <section className="py-16">
        <div className="mx-auto max-w-5xl px-5">
          <h2 className="text-balance text-center text-[1.75rem] font-black leading-snug tracking-tight text-zinc-900 sm:text-[2.25rem]">
            使い始めるのも、<br className="sm:hidden" />
            とても簡単です。
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-[16px] leading-relaxed text-zinc-500">
            難しいIT設定は一切ありません。今日から始められます。
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-3">
            {[
              {
                n: '1',
                title: 'お店の名前を入力するだけ',
                desc: 'お店の名前を入力するだけで、すぐにお店専用の画面ができます。難しい設定は一切不要です。',
              },
              {
                n: '2',
                title: 'QRコードを印刷して置く',
                desc: 'システムが自動でQRコードを作ります。印刷してレジの横や入口に置くだけ。それだけです。',
              },
              {
                n: '3',
                title: 'あとは自動でサポート',
                desc: 'お客様がQRを読むと自動で受付完了。仕上がり連絡はワンタップ。繁忙期も安心です。',
              },
            ].map(({ n, title, desc }) => (
              <div key={n} className="rounded-3xl border border-white/70 bg-white p-6 shadow-lg shadow-zinc-900/5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-xl font-black text-white shadow-md shadow-indigo-500/25">
                  {n}
                </div>
                <p className="mt-4 text-lg font-black text-zinc-900">{title}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-zinc-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== Trust / Reassurance ===== */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-5xl px-5">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-balance text-[1.75rem] font-black leading-snug tracking-tight text-zinc-900 sm:text-[2.25rem]">
              「全部デジタルに変えなきゃ」<br />
              <span className="text-indigo-600">そんな必要は、ありません。</span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-[16px] leading-[1.9] text-zinc-600">
              ミセプラは、今の手書きのやり方と並行して使えます。<br />
              「まずは仕上がり連絡だけ試してみよう」<br />
              その気軽な一歩から始めて、まったく構いません。
            </p>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              '手書きの帳簿・伝票は今まで通り使えます',
              'システムへの"全部移行"は必要ありません',
              '画面は大きく・シンプル。スマホが得意でなくても安心',
              '合わなければ、いつでも・違約金なしでやめられます',
            ].map(t => (
              <div key={t} className="flex items-center gap-4 rounded-2xl border border-zinc-200 bg-stone-50 p-5">
                <Check />
                <span className="text-[15px] font-medium text-zinc-700">{t}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="px-5 py-16">
        <div className="relative mx-auto max-w-4xl overflow-hidden rounded-[2.5rem] bg-indigo-700 px-6 py-14 text-center shadow-2xl shadow-indigo-900/30">
          <div aria-hidden className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-indigo-500/30 blur-3xl" />
          <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-blue-500/30 blur-3xl" />
          <div className="relative">
            <p className="text-base font-bold text-indigo-200">
              クレジットカード不要 ・ メール登録なし ・ 今の手書きと並行OK
            </p>
            <h2 className="mt-3 text-balance text-[1.75rem] font-black text-white sm:text-[2.25rem]">
              まず、{TRIAL_DAYS}日間。<br />
              無料でお試しください。
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[16px] leading-[1.9] text-indigo-100">
              難しい設定は一切ありません。<br />
              お店の名前を入れるだけで、今日から使えます。
            </p>
            <a
              href={START}
              className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-10 py-4 text-lg font-bold text-indigo-700 shadow-xl shadow-black/20 transition-transform hover:scale-[1.03] active:scale-95"
            >
              無料で試してみる <Arrow />
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-2 px-5 py-6 text-xs text-zinc-400 sm:flex-row sm:justify-between">
          <span className="font-black text-zinc-700">{BRAND}</span>
          <span className="text-center sm:text-right">
            学生服専門店向け ／ 順番案内 × 仕上がりLINE連絡 × お客様管理
          </span>
        </div>
      </footer>
    </main>
  )
}

/* ---- parts ---- */
function Arrow() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function Check() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm shadow-indigo-500/30">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    </span>
  )
}

function Cross() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-zinc-300 text-zinc-400">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      >
        <path d="M6 6l12 12M18 6 6 18" />
      </svg>
    </span>
  )
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full rounded-[2.25rem] border border-zinc-700/50 bg-zinc-900 p-2 shadow-2xl shadow-indigo-900/30 ring-1 ring-white/10">
      <div className="absolute left-1/2 top-2 z-10 h-4 w-24 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
      <div className="overflow-hidden rounded-[1.75rem] bg-zinc-50">{children}</div>
    </div>
  )
}

function MockContactScreen() {
  return (
    <div className="flex h-[25rem] flex-col text-left">
      <div className="bg-indigo-600 px-3.5 pb-3.5 pt-6 text-white">
        <p className="text-[10px] font-bold text-white/70">お渡し待ち</p>
        <p className="text-sm font-black">3件 連絡できます</p>
      </div>
      <div className="flex-1 space-y-2 overflow-hidden p-3">
        <div className="rounded-xl bg-white p-2.5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-800">田中さま</span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black text-emerald-700">
              仕上がり済
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-400">スラックス 裾上げ</p>
          <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-[#06C755] py-2 text-[11px] font-black text-white">
            <LineIcon />
            LINEで「仕上がり」連絡
          </div>
        </div>
        <div className="rounded-xl bg-white p-2.5 shadow-sm opacity-90">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-zinc-800">佐藤さま</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[9px] font-black text-zinc-500">
              送信済み・既読
            </span>
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-400">ブレザー 補修</p>
        </div>
      </div>
      <div className="p-3">
        <div className="rounded-xl bg-zinc-900 py-2.5 text-center text-xs font-black text-white">
          まとめて連絡する
        </div>
      </div>
    </div>
  )
}

function LineIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3C6.5 3 2 6.6 2 11.1c0 4 3.6 7.4 8.5 8 .3.07.8.22.9.5.08.27.05.68.03.95l-.14.86c-.04.25-.2 1 .88.55 1.08-.46 5.8-3.42 7.9-5.85C21.4 14.9 22 13.1 22 11.1 22 6.6 17.5 3 12 3z" />
    </svg>
  )
}
