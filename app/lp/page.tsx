import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// 作り込み中は非公開。公開するときは Vercel 環境変数 NEXT_PUBLIC_LP_PUBLIC=1 を設定。
const LP_PUBLIC = process.env.NEXT_PUBLIC_LP_PUBLIC === '1'

const BRAND = 'みせサポ' // TODO: 正式なサービス名に差し替え
const CONTACT = 'mailto:to4fu321@gmail.com?subject=店舗運営システムの相談' // TODO: 公開用の連絡先に差し替え

export const metadata: Metadata = {
  title: `${BRAND}｜制服・お直し店のための店舗運営システム`,
  description:
    '順番待ち・お直し管理・予約・顧客管理をスマホ1台で。学生服・呉服・スーツ・婦人服のお店のための店舗運営システム。手書き伝票も写真でそのままデータ化。',
  robots: { index: false, follow: false },
  openGraph: {
    title: `${BRAND}｜制服・お直し店のための店舗運営システム`,
    description: '順番待ち・お直し管理・予約・顧客管理をスマホ1台で。紙の伝票も写真でデータ化。',
    type: 'website',
  },
}

export default function LandingPage({ searchParams }: { searchParams?: { preview?: string } }) {
  // 非公開。ただし ?preview=1 はレビュー用に表示（noindex・どこからもリンクなし）
  if (!LP_PUBLIC && searchParams?.preview !== '1') notFound()

  return (
    <main className="min-h-screen bg-white text-zinc-900 antialiased selection:bg-indigo-200/60">
      {/* ===== Nav ===== */}
      <header className="sticky top-0 z-40 border-b border-zinc-100/80 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <a href="#top" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[17px] font-black tracking-tight">{BRAND}</span>
          </a>
          <nav className="hidden items-center gap-8 text-sm font-semibold text-zinc-500 md:flex">
            <a href="#features" className="transition-colors hover:text-zinc-900">機能</a>
            <a href="#how" className="transition-colors hover:text-zinc-900">使い方</a>
            <a href="#plans" className="transition-colors hover:text-zinc-900">プラン</a>
            <a href="#faq" className="transition-colors hover:text-zinc-900">FAQ</a>
          </nav>
          <a href="#contact"
            className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-black hover:shadow-md active:scale-95">
            相談する
          </a>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section id="top" className="relative overflow-hidden">
        {/* gradient mesh */}
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -left-32 -top-32 h-[36rem] w-[36rem] rounded-full bg-indigo-300/30 blur-[120px]" />
          <div className="absolute -right-40 top-10 h-[32rem] w-[32rem] rounded-full bg-fuchsia-300/25 blur-[120px]" />
          <div className="absolute bottom-0 left-1/3 h-[28rem] w-[28rem] rounded-full bg-violet-300/20 blur-[120px]" />
        </div>

        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          {/* copy */}
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white/60 px-3.5 py-1.5 text-xs font-bold text-indigo-700 backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
              学生服 / 呉服 / スーツ / 婦人服のお店へ
            </span>
            <h1 className="mt-6 text-[2.5rem] font-black leading-[1.08] tracking-tight sm:text-6xl">
              お店の受付・お直しを<br />
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
                スマホ1台で。
              </span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-zinc-600 sm:text-lg lg:mx-0">
              順番待ち・お直し管理・採寸予約・顧客管理をまるごと。
              手書きの伝票も<span className="font-bold text-zinc-900">写真でそのままデータ化</span>。
              紙とエクセルの手間を、現場が迷わない画面に置き換えます。
            </p>
            <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:items-start">
              <a href="#contact"
                className="group inline-flex w-full items-center justify-center gap-2 rounded-full bg-zinc-900 px-7 py-4 font-bold text-white shadow-lg shadow-zinc-900/15 transition-all hover:bg-black hover:shadow-xl active:scale-[0.98] sm:w-auto">
                無料トライアルを相談する
                <ArrowRight />
              </a>
              <a href="#features"
                className="inline-flex w-full items-center justify-center rounded-full border-2 border-zinc-200 px-7 py-4 font-bold text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 sm:w-auto">
                機能を見る
              </a>
            </div>
            <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-zinc-500 lg:justify-start">
              <Check2 label="初期費用なしで開始" />
              <Check2 label="専用機器は不要" />
              <Check2 label="紙と並行でOK" />
            </div>
          </div>

          {/* phone mock */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="absolute inset-0 -z-10 translate-y-6 scale-95 rounded-[3rem] bg-gradient-to-br from-indigo-500/20 to-fuchsia-500/20 blur-2xl" />
            <PhoneFrame>
              <MockRepairScreen />
            </PhoneFrame>
          </div>
        </div>
      </section>

      {/* ===== 価値の帯 ===== */}
      <section className="border-y border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-none px-5 py-10 sm:grid-cols-3">
          {[
            ['受付〜お渡しを一元管理', '誰の・何が・いつまでが一目で'],
            ['紙からの移行もスムーズ', '写真OCRで手書きもそのまま'],
            ['繁忙期もすっきり', '順番待ち・スタッフ増員に対応'],
          ].map(([t, d]) => (
            <div key={t} className="px-4 py-2 text-center sm:text-left">
              <p className="text-lg font-black">{t}</p>
              <p className="mt-1 text-sm text-zinc-500">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== お悩み ===== */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <SectionHead eyebrow="課題" title="こんなお悩み、ありませんか？" />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {[
            [<IconNote key="i" />, '紙の伝票・台帳が探しにくい', '受付票やお直しメモが散らかり、進捗や納期が一目で分からない。'],
            [<IconClock key="i" />, '繁忙期の行列・対応の混乱', '入学シーズンに来店が集中。誰の番か、待ち時間が読めない。'],
            [<IconUsers key="i" />, 'スタッフ間の引き継ぎ漏れ', 'アルバイトが増える時期、受付内容や外注先の共有が難しい。'],
          ].map(([icon, t, d]) => (
            <div key={t as string} className="rounded-3xl border border-zinc-100 bg-white p-7 shadow-[0_1px_0_rgba(0,0,0,0.03)] transition-shadow hover:shadow-lg">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700">{icon}</div>
              <p className="mt-5 text-lg font-black">{t as string}</p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-500">{d as string}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 機能ハイライト（交互レイアウト）===== */}
      <section id="features" className="border-y border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-6xl px-5 py-24">
          <SectionHead eyebrow="主な機能" title="お店に必要な機能だけ、ON。" desc="使う機能は店舗ごとに選べます。まずは小さく、必要に応じて拡張。" />

          {/* highlight 1 */}
          <div className="mt-16 grid items-center gap-12 lg:grid-cols-2">
            <div>
              <Badge>お直し管理</Badge>
              <h3 className="mt-4 text-2xl font-black sm:text-3xl">受付からお渡しまで、迷わず一本道。</h3>
              <p className="mt-4 leading-relaxed text-zinc-600">
                服種・項目を選ぶだけで料金は自動計算。外注の加工業者もワンタップ選択。
                仕上がり予定・お渡し状況まで、案件ごとに追えます。
              </p>
              <ul className="mt-6 space-y-3">
                {['登録マスタから料金を自動計算', '加工業者（外注先）をワンタップ選択', '完了・お渡しをワンタップで管理'].map(t => (
                  <li key={t} className="flex items-start gap-3 text-sm font-medium text-zinc-700"><CheckBadge />{t}</li>
                ))}
              </ul>
            </div>
            <div className="relative mx-auto w-full max-w-xs">
              <PhoneFrame><MockRepairScreen /></PhoneFrame>
            </div>
          </div>

          {/* highlight 2 */}
          <div className="mt-24 grid items-center gap-12 lg:grid-cols-2">
            <div className="order-2 lg:order-1 relative mx-auto w-full max-w-xs">
              <PhoneFrame><MockQueueScreen /></PhoneFrame>
            </div>
            <div className="order-1 lg:order-2">
              <Badge>順番待ち ＆ 写真OCR</Badge>
              <h3 className="mt-4 text-2xl font-black sm:text-3xl">行列も、紙メモも、すっと片づく。</h3>
              <p className="mt-4 leading-relaxed text-zinc-600">
                受付→呼び出し→完了はワンタップ。LINEで呼び出し通知も。
                手書きのメモや伝票は<span className="font-bold text-zinc-900">撮影するだけ</span>で内容・お客様名を自動入力します。
              </p>
              <ul className="mt-6 space-y-3">
                {['番号発行・呼び出し・完了をワンタップ', 'LINEで呼び出し／完了をお知らせ', '手書きメモを撮影して自動データ化'].map(t => (
                  <li key={t} className="flex items-start gap-3 text-sm font-medium text-zinc-700"><CheckBadge />{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ===== 機能グリッド ===== */}
      <section className="mx-auto max-w-6xl px-5 py-24">
        <SectionHead eyebrow="できること" title="ひととおり、揃っています。" />
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            [<IconQueue key="i" />, '順番待ち', '受付・呼び出し・完了をワンタップ。'],
            [<IconScissors key="i" />, 'お直し管理', '受付〜お渡し。料金自動計算・外注先選択。'],
            [<IconCalendar key="i" />, '採寸・来店予約', '繁忙日の来店を分散して受付。'],
            [<IconUsers key="i" />, '顧客管理（CRM）', '電話番号だけでも登録。保護者＋お子様も。'],
            [<IconCamera key="i" />, '写真OCR', 'メモ・伝票を撮るだけで自動入力。'],
            [<IconReceipt key="i" />, 'かんたんレジ', '会計・釣銭・レシート/領収書（オプション）。'],
            [<IconCalendar key="i" />, 'スタッフ・シフト', '出退勤・希望・人件費まで（オプション）。'],
            [<IconChat key="i" />, 'LINE連携', '友だち登録から通知・再来店促進まで。'],
            [<IconSchool key="i" />, '学校規定・採寸連携', '学校ごとの規定品・サイズ・価格（オプション）。'],
          ].map(([icon, t, d]) => (
            <div key={t as string} className="group rounded-2xl border border-zinc-100 bg-white p-6 transition-all hover:-translate-y-0.5 hover:border-zinc-200 hover:shadow-lg">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-fuchsia-50 text-indigo-600">{icon}</div>
              <p className="mt-4 font-black">{t as string}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{d as string}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 使い方 ===== */}
      <section id="how" className="border-y border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-5xl px-5 py-24">
          <SectionHead eyebrow="使い方" title="はじめるのは、3ステップ。" />
          <div className="mt-14 grid gap-8 sm:grid-cols-3">
            {[
              ['01', 'お店の画面を開く', 'スマホ・タブレットのブラウザで店舗ページを開き、PINでログイン。'],
              ['02', '受付・お直しを登録', '画面の案内に沿って入力。写真OCRで紙メモもそのまま取り込み。'],
              ['03', '進捗・お渡しを管理', '完了・お渡し・予約をワンタップ管理。LINEで通知も。'],
            ].map(([n, t, d]) => (
              <div key={n} className="relative">
                <span className="text-5xl font-black text-transparent [-webkit-text-stroke:1.5px_rgb(199_210_254)]">{n}</span>
                <p className="mt-3 text-lg font-black">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-500">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== プラン ===== */}
      <section id="plans" className="mx-auto max-w-6xl px-5 py-24">
        <SectionHead eyebrow="プラン" title="お店に合わせて、ちょうどよく。" desc="機能は店舗ごとに個別ON/OFF。あとから追加もできます。料金はお気軽にご相談ください。" />
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['導入サンプル', 'まずは試したい', ['LINE友だち登録・連携', '完了通知'], false],
            ['シンプル', '小規模・お直し中心', ['お直し受付〜お渡し', '料金マスタ・顧客管理', '順番待ち・予約'], true],
            ['スタンダード', '発注・入荷も', ['シンプルの全機能', '発注・入荷待ち管理', '問合せ管理'], false],
            ['フル', '全部入り', ['スタンダードの全機能', '伝票OCR・学校規定', 'レジ・シフト 等'], false],
          ].map(([name, who, items, hot]) => (
            <div key={name as string}
              className={`relative flex flex-col rounded-3xl border p-6 ${hot ? 'border-indigo-300 bg-white shadow-xl shadow-indigo-100 ring-1 ring-indigo-200' : 'border-zinc-100 bg-white shadow-sm'}`}>
              {hot && <span className="absolute -top-3 left-6 rounded-full bg-indigo-600 px-3 py-1 text-[10px] font-black text-white">おすすめ</span>}
              <p className="text-lg font-black">{name as string}</p>
              <p className="mt-0.5 text-xs text-zinc-400">{who as string}</p>
              <ul className="mt-5 flex-1 space-y-2.5">
                {(items as string[]).map(it => (
                  <li key={it} className="flex items-start gap-2 text-sm text-zinc-600"><CheckBadge />{it}</li>
                ))}
              </ul>
              <a href="#contact"
                className={`mt-6 rounded-full px-4 py-2.5 text-center text-sm font-bold transition-colors ${hot ? 'bg-zinc-900 text-white hover:bg-black' : 'border-2 border-zinc-200 text-zinc-700 hover:border-zinc-900'}`}>
                相談する
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 導入の流れ ===== */}
      <section className="border-y border-zinc-100 bg-zinc-50/60">
        <div className="mx-auto max-w-3xl px-5 py-24">
          <SectionHead eyebrow="導入の流れ" title="ご相談から本採用まで。" />
          <ol className="mt-12 space-y-2">
            {[
              ['お問い合わせ', 'やりたいこと・お店の状況をお聞きします。'],
              ['店舗発行・初期設定', 'お店専用ページを発行し、料金マスタなどを準備。'],
              ['トライアル運用', 'まずは閑散期に紙と並行で。現場で試して効果を確認。'],
              ['本採用・拡張', '良ければ本採用。発注・レジ・シフト等を必要に応じ追加。'],
            ].map(([t, d], i, arr) => (
              <li key={t} className="flex gap-5">
                <div className="flex flex-col items-center">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-sm font-black text-white">{i + 1}</span>
                  {i < arr.length - 1 && <span className="my-1 w-px flex-1 bg-zinc-200" />}
                </div>
                <div className="pb-6">
                  <p className="font-black">{t}</p>
                  <p className="mt-1 text-sm text-zinc-500">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="mx-auto max-w-3xl px-5 py-24">
        <SectionHead eyebrow="FAQ" title="よくある質問" />
        <div className="mt-12 space-y-3">
          {[
            ['パソコンが苦手でも使えますか？', 'スマホ・タブレットのブラウザで、画面の案内に沿って進むだけ。紙と並行で少しずつ慣れていけます。'],
            ['今までの紙の伝票はどうなりますか？', '写真で撮るだけで内容を自動入力できます。いきなり紙をやめる必要はありません。'],
            ['繁忙期だけ使うこともできますか？', '可能です。アルバイトのスタッフ登録や順番待ちは、必要なときだけ活用できます。'],
            ['専用の機械は必要ですか？', '不要です。お手持ちのスマホ・タブレットでそのまま使えます。'],
            ['機能は途中で増やせますか？', 'はい。店舗ごとに機能を個別ON/OFFでき、あとから追加できます。'],
          ].map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-zinc-100 bg-white p-5 transition-colors hover:border-zinc-200">
              <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
                {q}
                <span className="ml-4 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-transform group-open:rotate-45">＋</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-zinc-500">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section id="contact" className="px-5 pb-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] bg-zinc-900 px-6 py-20 text-center">
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute -left-20 -top-20 h-72 w-72 rounded-full bg-indigo-500/30 blur-3xl" />
            <div className="absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-fuchsia-500/25 blur-3xl" />
          </div>
          <div className="relative">
            <h2 className="text-3xl font-black text-white sm:text-4xl">まずは無料トライアルから。</h2>
            <p className="mx-auto mt-4 max-w-xl text-balance text-zinc-300">
              お店の状況に合わせて、ぴったりの使い方をご提案します。お気軽にどうぞ。
            </p>
            <a href={CONTACT}
              className="mt-9 inline-flex items-center justify-center gap-2 rounded-full bg-white px-8 py-4 font-bold text-zinc-900 shadow-lg transition-transform hover:scale-[1.02] active:scale-[0.98]">
              メールで相談する <ArrowRight />
            </a>
          </div>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-zinc-100">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-10 text-sm text-zinc-400 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <Logo />
            <span className="font-black text-zinc-700">{BRAND}</span>
          </div>
          <p className="text-xs">制服・お直し店のための店舗運営システム</p>
          <p className="text-xs">Powered by LINE × Next.js</p>
        </div>
      </footer>
    </main>
  )
}

/* ============================================================
   パーツ
============================================================ */

function Logo() {
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-fuchsia-500 text-white shadow-md shadow-indigo-500/30">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9h18M3 9l1.5-4.5A2 2 0 0 1 6.4 3h11.2a2 2 0 0 1 1.9 1.5L21 9M5 9v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V9" />
      </svg>
    </span>
  )
}

function SectionHead({ eyebrow, title, desc }: { eyebrow: string; title: string; desc?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-indigo-600">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{title}</h2>
      {desc && <p className="mt-4 text-balance leading-relaxed text-zinc-500">{desc}</p>}
    </div>
  )
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-600">{children}</span>
}

function Check2({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgb(34 197 94)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
      {label}
    </span>
  )
}

function CheckBadge() {
  return (
    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600/10 text-indigo-600">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
    </span>
  )
}

function ArrowRight() {
  return <svg className="transition-transform group-hover:translate-x-0.5" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
}

/* 端末フレーム */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto w-full rounded-[2.5rem] border border-zinc-200 bg-zinc-900 p-2.5 shadow-2xl shadow-zinc-900/20">
      <div className="absolute left-1/2 top-2.5 z-10 h-5 w-28 -translate-x-1/2 rounded-b-2xl bg-zinc-900" />
      <div className="overflow-hidden rounded-[2rem] bg-zinc-50">
        {children}
      </div>
    </div>
  )
}

/* モック画面: お直し受付 */
function MockRepairScreen() {
  return (
    <div className="flex h-[30rem] flex-col text-left">
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-4 pb-4 pt-7 text-white">
        <p className="text-[10px] font-bold text-white/70">お直し受付</p>
        <p className="text-base font-black">内容を入力</p>
      </div>
      <div className="flex-1 space-y-2.5 overflow-hidden p-3.5">
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400">服種</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {['スラックス', 'スカート', '上着'].map((t, i) => (
              <span key={t} className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${i === 0 ? 'bg-amber-500 text-white' : 'bg-zinc-100 text-zinc-500'}`}>{t}</span>
            ))}
          </div>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400">項目</p>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-800">裾上げ（シングル）</span>
            <span className="text-sm font-black text-indigo-600">¥1,200</span>
          </div>
        </div>
        <div className="rounded-2xl bg-white p-3 shadow-sm">
          <p className="text-[10px] font-bold text-zinc-400">加工業者</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-zinc-700 px-2.5 py-1 text-[11px] font-bold text-white">内製</span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-500">○○リフォーム</span>
          </div>
        </div>
        <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/50 p-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold text-indigo-600">
            <IconCamera />メモを撮影して自動入力
          </p>
        </div>
      </div>
      <div className="p-3.5">
        <div className="rounded-2xl bg-indigo-600 py-3 text-center text-sm font-black text-white">受付する</div>
      </div>
    </div>
  )
}

/* モック画面: 順番待ち */
function MockQueueScreen() {
  return (
    <div className="flex h-[30rem] flex-col text-left">
      <div className="bg-gradient-to-r from-zinc-900 to-zinc-700 px-4 pb-4 pt-7 text-white">
        <p className="text-[10px] font-bold text-white/60">順番待ち</p>
        <p className="text-base font-black">本日 8組</p>
      </div>
      <div className="flex-1 space-y-2.5 overflow-hidden p-3.5">
        {[
          ['No.12', '田中さま', '呼び出し中', 'bg-emerald-500'],
          ['No.13', '佐藤さま', '待機', 'bg-zinc-300'],
          ['No.14', '鈴木さま', '待機', 'bg-zinc-300'],
        ].map(([no, name, st, dot], i) => (
          <div key={no} className={`flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ${i === 0 ? 'ring-2 ring-emerald-400' : ''}`}>
            <span className="text-sm font-black text-zinc-800">{no}</span>
            <span className="flex-1 text-sm text-zinc-600">{name}</span>
            <span className="flex items-center gap-1.5 text-[11px] font-bold text-zinc-500">
              <span className={`h-2 w-2 rounded-full ${dot}`} />{st}
            </span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 p-3.5">
        <div className="rounded-2xl bg-emerald-500 py-3 text-center text-sm font-black text-white">呼び出し</div>
        <div className="rounded-2xl bg-zinc-900 py-3 text-center text-sm font-black text-white">完了</div>
      </div>
    </div>
  )
}

/* ---- line icons ---- */
const sv = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
function IconNote() { return <svg {...sv}><path d="M4 4h11l5 5v11a0 0 0 0 1 0 0H4z" /><path d="M14 4v5h5M8 13h8M8 17h6" /></svg> }
function IconClock() { return <svg {...sv}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg> }
function IconUsers() { return <svg {...sv}><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0M16 4.5a3.2 3.2 0 0 1 0 6.5M21 20a6 6 0 0 0-4-5.7" /></svg> }
function IconQueue() { return <svg {...sv}><path d="M4 7h16M4 12h10M4 17h7" /></svg> }
function IconScissors() { return <svg {...sv}><circle cx="6" cy="6" r="2.6" /><circle cx="6" cy="18" r="2.6" /><path d="M20 4 8.5 15.5M14.5 14.5 20 20M8 8l4 4" /></svg> }
function IconCalendar() { return <svg {...sv}><rect x="3.5" y="5" width="17" height="16" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg> }
function IconCamera() { return <svg {...{ ...sv, width: 14, height: 14 }}><path d="M3 8a2 2 0 0 1 2-2h2l1.2-1.6a1 1 0 0 1 .8-.4h6a1 1 0 0 1 .8.4L19 6h0a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="12.5" r="3.2" /></svg> }
function IconReceipt() { return <svg {...sv}><path d="M6 3v18l2-1.2L10 21l2-1.2L14 21l2-1.2L18 21V3l-2 1.2L14 3l-2 1.2L10 3 8 4.2z" /><path d="M9 8h6M9 12h6" /></svg> }
function IconChat() { return <svg {...sv}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-5A8 8 0 1 1 21 12z" /></svg> }
function IconSchool() { return <svg {...sv}><path d="M12 4 2 9l10 5 10-5-10-5z" /><path d="M6 11.5V16c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-4.5" /></svg> }
