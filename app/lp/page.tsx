import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'

// 作り込み中は非公開。公開するときは Vercel 環境変数 NEXT_PUBLIC_LP_PUBLIC=1 を設定。
const LP_PUBLIC = process.env.NEXT_PUBLIC_LP_PUBLIC === '1'

export const metadata: Metadata = {
  title: '制服・お直し店のための店舗運営システム',
  description:
    '順番待ち・お直し管理・予約・顧客管理をスマホ1台で。学生服・呉服・スーツ・婦人服のお店のための、かんたん店舗運営システム。写真OCRで紙の伝票もそのままデータ化。',
  robots: { index: false, follow: false },
  openGraph: {
    title: '制服・お直し店のための店舗運営システム',
    description: '順番待ち・お直し管理・予約・顧客管理をスマホ1台で。紙の伝票も写真でデータ化。',
    type: 'website',
  },
}

// 紹介LP（公開・静的）。/lp で表示。ドメイン直下に差し替えも可能。
export default function LandingPage() {
  if (!LP_PUBLIC) notFound()
  return (
    <main className="min-h-screen bg-white text-zinc-900">
      {/* ===== ヘッダー ===== */}
      <header className="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-zinc-100">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <span className="font-black text-lg tracking-tight">🎫 みせサポ</span>
          <a href="#contact"
            className="px-4 py-2 rounded-full bg-zinc-900 text-white text-sm font-bold hover:bg-black transition-colors">
            お問い合わせ
          </a>
        </div>
      </header>

      {/* ===== ヒーロー ===== */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10" style={{
          background: 'radial-gradient(circle at 15% 0%, rgba(99,102,241,.16), transparent 55%), radial-gradient(circle at 90% 30%, rgba(236,72,153,.12), transparent 55%), #ffffff',
        }} />
        <div className="max-w-5xl mx-auto px-5 pt-16 pb-14 text-center">
          <p className="inline-block px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold mb-5">
            学生服 / 呉服 / スーツ / 婦人服のお店へ
          </p>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-tight">
            お店の受付・お直し・予約を<br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-indigo-600 to-pink-500 bg-clip-text text-transparent">スマホ1台</span>でかんたんに
          </h1>
          <p className="mt-5 text-zinc-600 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
            順番待ち・お直し管理・採寸予約・顧客管理をまるごと。
            手書きの伝票も<strong>写真でそのままデータ化</strong>。
            紙とエクセルの手間を、現場が迷わない画面に置き換えます。
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a href="#contact"
              className="px-7 py-3.5 rounded-full bg-zinc-900 text-white font-bold hover:bg-black transition-colors w-full sm:w-auto">
              無料トライアルを相談する
            </a>
            <a href="#features"
              className="px-7 py-3.5 rounded-full border-2 border-zinc-200 font-bold hover:border-zinc-400 transition-colors w-full sm:w-auto">
              機能を見る
            </a>
          </div>
          <p className="mt-4 text-xs text-zinc-400">初期費用なしのトライアルから始められます</p>
        </div>
      </section>

      {/* ===== デモ動画 ===== */}
      <section className="max-w-4xl mx-auto px-5 pb-4">
        <div className="aspect-video rounded-3xl border border-zinc-200 bg-zinc-50 flex flex-col items-center justify-center text-zinc-400">
          <span className="text-5xl mb-2">▶️</span>
          <p className="text-sm font-bold">デモ動画（準備中）</p>
          <p className="text-xs mt-1">お直し受付・順番待ちの操作を30秒で紹介</p>
        </div>
      </section>

      {/* ===== お悩み ===== */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <h2 className="text-center text-2xl sm:text-3xl font-black mb-10">こんなお悩み、ありませんか？</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            ['🗒️', '紙の伝票・台帳が探しにくい', '受付票やお直しメモが散らかり、進捗や納期が一目で分からない。'],
            ['⏳', '繁忙期の行列・お客様対応', '入学シーズンに来店が集中。誰の番か、待ち時間が読めず現場が混乱。'],
            ['🔁', 'スタッフ間の引き継ぎ漏れ', 'アルバイトが増える時期に、受付内容や外注先の共有がうまくいかない。'],
          ].map(([emoji, t, d]) => (
            <div key={t} className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-5">
              <div className="text-3xl mb-2">{emoji}</div>
              <p className="font-black mb-1">{t}</p>
              <p className="text-sm text-zinc-500 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 機能 ===== */}
      <section id="features" className="bg-zinc-50 border-y border-zinc-100">
        <div className="max-w-5xl mx-auto px-5 py-16">
          <h2 className="text-center text-2xl sm:text-3xl font-black mb-3">主な機能</h2>
          <p className="text-center text-zinc-500 text-sm mb-10">必要な機能だけONにして、お店に合わせて使えます。</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              ['🔢', '順番待ち', '受付→呼び出し→完了をワンタップ。LINEで呼び出し通知も。行列のストレスを解消。'],
              ['✂️', 'お直し管理', '受付からお渡しまで一元管理。料金は登録マスタから自動計算。外注先もワンタップ選択。'],
              ['📅', '採寸・来店予約', '繁忙日の来店を分散。予約状況をその場で確認。'],
              ['👥', '顧客管理（CRM）', '電話番号だけでも登録。学生服は保護者＋お子様（学校・学年）で管理。'],
              ['📷', '写真OCR', '手書きメモや伝票を撮影するだけで内容・お客様名を自動入力。紙からの移行もスムーズ。'],
              ['🧾', 'かんたんレジ', 'お直し・物販の会計、釣銭計算、レシート/領収書の発行まで（オプション）。'],
              ['📆', 'スタッフ・シフト', '出退勤・希望シフト・人件費もカバー（オプション）。繁忙期の増員もスムーズ。'],
              ['💬', 'LINE連携', '友だち登録から呼び出し・完了通知まで。お客様の再来店につなげます。'],
              ['🏫', '学校規定・採寸連携', '学校ごとの規定品・サイズ・価格を登録し、注文や採寸に活用（オプション）。'],
            ].map(([emoji, t, d]) => (
              <div key={t} className="rounded-2xl bg-white border border-zinc-100 p-5 shadow-sm">
                <div className="text-3xl mb-2">{emoji}</div>
                <p className="font-black mb-1">{t}</p>
                <p className="text-sm text-zinc-500 leading-relaxed">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== 使い方 ===== */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <h2 className="text-center text-2xl sm:text-3xl font-black mb-10">使い方は3ステップ</h2>
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            ['1', 'お店の画面を開く', 'スマホ・タブレットのブラウザで店舗ページを開き、PINでログイン。'],
            ['2', '受付・お直しを登録', '画面の案内に沿って入力するだけ。写真OCRで紙のメモもそのまま取り込み。'],
            ['3', '進捗・お渡しを管理', '完了・お渡し・予約をワンタップ管理。LINEでお客様に通知も。'],
          ].map(([n, t, d]) => (
            <div key={n} className="text-center">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-600 to-violet-500 text-white font-black text-xl flex items-center justify-center mx-auto mb-4">{n}</div>
              <p className="font-black mb-1">{t}</p>
              <p className="text-sm text-zinc-500 leading-relaxed">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== 料金プラン ===== */}
      <section id="plans" className="bg-zinc-50 border-y border-zinc-100">
        <div className="max-w-5xl mx-auto px-5 py-16">
          <h2 className="text-center text-2xl sm:text-3xl font-black mb-3">プラン</h2>
          <p className="text-center text-zinc-500 text-sm mb-10">お店の規模・やりたいことに合わせて選べます。料金はお気軽にご相談ください。</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              ['🌱', '導入サンプル', 'まずは試したい', ['LINE友だち登録・連携', '完了通知']],
              ['✂️', 'シンプル', '小規模・お直し中心', ['お直し受付〜お渡し', '料金マスタ・顧客管理', '順番待ち・予約']],
              ['📦', 'スタンダード', '発注・入荷も', ['シンプルの全機能', '発注・入荷待ち管理', '問合せ管理']],
              ['🚀', 'フル', '全部入り', ['スタンダードの全機能', '伝票OCR・学校規定', 'レジ・シフト 等']],
            ].map(([emoji, name, who, items], i) => (
              <div key={name as string} className={`rounded-2xl border p-5 bg-white ${i === 1 ? 'border-indigo-400 shadow-lg' : 'border-zinc-100 shadow-sm'}`}>
                {i === 1 && <p className="text-[10px] font-black text-indigo-600 mb-1">おすすめ</p>}
                <div className="text-3xl mb-1">{emoji}</div>
                <p className="font-black text-lg">{name}</p>
                <p className="text-xs text-zinc-400 mb-3">{who}</p>
                <ul className="space-y-1.5">
                  {(items as string[]).map(it => (
                    <li key={it} className="text-sm text-zinc-600 flex items-start gap-1.5">
                      <span className="text-indigo-500 mt-0.5">✓</span>{it}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-zinc-400 mt-6">※機能は店舗ごとに個別ON/OFFできます。あとから追加も可能です。</p>
        </div>
      </section>

      {/* ===== 導入の流れ ===== */}
      <section className="max-w-3xl mx-auto px-5 py-16">
        <h2 className="text-center text-2xl sm:text-3xl font-black mb-10">導入の流れ</h2>
        <ol className="space-y-4">
          {[
            ['お問い合わせ', 'やりたいこと・お店の状況をお聞きします。'],
            ['店舗発行・初期設定', 'お店専用ページを発行し、料金マスタなどを準備。'],
            ['トライアル運用', 'まずは閑散期に紙と並行で。現場で試して効果を確認。'],
            ['本採用・拡張', '良ければ本採用。発注・レジ・シフトなど必要に応じて追加。'],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-4 items-start">
              <span className="shrink-0 w-8 h-8 rounded-full bg-zinc-900 text-white font-black text-sm flex items-center justify-center">{i + 1}</span>
              <div>
                <p className="font-black">{t}</p>
                <p className="text-sm text-zinc-500">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ===== FAQ ===== */}
      <section className="bg-zinc-50 border-y border-zinc-100">
        <div className="max-w-3xl mx-auto px-5 py-16">
          <h2 className="text-center text-2xl sm:text-3xl font-black mb-10">よくある質問</h2>
          <div className="space-y-3">
            {[
              ['パソコンが苦手でも使えますか？', 'スマホ・タブレットのブラウザで、画面の案内に沿って進むだけ。紙と並行で少しずつ慣れていけます。'],
              ['今までの紙の伝票はどうなりますか？', '写真で撮るだけで内容を自動入力できます。いきなり紙をやめる必要はありません。'],
              ['繁忙期だけ使うこともできますか？', '可能です。アルバイトのスタッフ登録や順番待ちは、必要なときだけ活用できます。'],
              ['専用の機械は必要ですか？', '不要です。お手持ちのスマホ・タブレットでそのまま使えます。'],
              ['機能は途中で増やせますか？', 'はい。店舗ごとに機能を個別ON/OFFでき、あとから追加できます。'],
            ].map(([q, a]) => (
              <details key={q} className="group rounded-2xl bg-white border border-zinc-100 p-4">
                <summary className="font-bold cursor-pointer list-none flex items-center justify-between">
                  {q}<span className="text-zinc-400 group-open:rotate-45 transition-transform">＋</span>
                </summary>
                <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA / お問い合わせ ===== */}
      <section id="contact" className="max-w-3xl mx-auto px-5 py-20 text-center">
        <h2 className="text-2xl sm:text-3xl font-black mb-3">まずは無料トライアルから</h2>
        <p className="text-zinc-600 mb-8">お店の状況に合わせて、ぴったりの使い方をご提案します。</p>
        {/* TODO: 連絡先を実際の問い合わせ先（メール/LINE/フォーム）に差し替えてください */}
        <a href="mailto:to4fu321@gmail.com?subject=店舗運営システムの相談"
          className="inline-block px-8 py-4 rounded-full bg-zinc-900 text-white font-bold hover:bg-black transition-colors">
          メールで相談する
        </a>
      </section>

      {/* ===== フッター ===== */}
      <footer className="border-t border-zinc-100">
        <div className="max-w-5xl mx-auto px-5 py-8 text-center text-xs text-zinc-400">
          <p>🎫 みせサポ — 制服・お直し店のための店舗運営システム</p>
          <p className="mt-1">Powered by LINE × Next.js</p>
        </div>
      </footer>
    </main>
  )
}
