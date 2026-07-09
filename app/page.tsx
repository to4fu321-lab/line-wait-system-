import Link from 'next/link'

const DEMO_STORE_ID = '00000000-0000-0000-0000-000000000010'
const DEMO_PIN = '0000'

export default function RootPage() {
  return (
    <main className="min-h-screen relative overflow-hidden">
      {/* 背景グラデーション（汎用） */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: `
            radial-gradient(circle at 20% 10%, rgba(99, 102, 241, 0.18), transparent 55%),
            radial-gradient(circle at 80% 90%, rgba(236, 72, 153, 0.12), transparent 55%),
            radial-gradient(circle at 50% 50%, rgba(124, 58, 237, 0.05), transparent 70%),
            #fafafa
          `,
        }}
      />

      <div className="max-w-md mx-auto px-6 py-14">
        <div className="text-center mb-10">
          <div
            className="w-16 h-16 mx-auto mb-5 rounded-3xl flex items-center justify-center text-3xl"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #ec4899)',
              boxShadow: '0 16px 40px -12px rgba(99, 102, 241, 0.5)',
            }}
          >
            <span className="text-white">🎫</span>
          </div>
          <h1 className="text-3xl font-black tracking-tight text-zinc-900 leading-tight">
            学生服販売店向け<br />店舗運営支援システム
          </h1>
          <p className="mt-3 text-zinc-500 text-sm leading-relaxed">
            制服店のDXをまるごとサポート<br />
            <span className="text-zinc-400 text-xs">受付 × 採寸 × お直し × 発注 × CRM × LINE通知</span>
          </p>
        </div>

        {/* ご利用方法 */}
        <div
          className="bg-white/70 backdrop-blur-2xl rounded-3xl border border-white/60 p-6 mb-6"
          style={{
            boxShadow: `
              0 24px 60px -20px rgba(99, 102, 241, 0.22),
              0 1px 0 0 rgb(255 255 255 / 0.65) inset
            `,
          }}
        >
          <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-4">
            ご利用方法
          </h2>
          <ol className="space-y-3 text-sm text-zinc-700">
            <Step n={1} text="店舗のQRコードをLINEで読み取り" />
            <Step n={2} text="店舗専用ページが開きます" />
            <Step n={3} text="サービスを選択して受付完了" />
          </ol>
        </div>

        {/* 体験（サンプル店舗） */}
        <div
          className="bg-white/70 backdrop-blur-2xl rounded-3xl border border-white/60 p-6 space-y-3"
          style={{
            boxShadow: `
              0 24px 60px -20px rgba(99, 102, 241, 0.18),
              0 1px 0 0 rgb(255 255 255 / 0.65) inset
            `,
          }}
        >
          <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest">
            サンプル店舗で試す
          </h2>

          <Link
            href={`/${DEMO_STORE_ID}?demo=1`}
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-white hover:bg-zinc-50 border border-zinc-200 transition-colors group"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
              🙋
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-900">お客様の操作画面を見る</p>
              <p className="text-[11px] text-zinc-400">受付・登録画面を体験モードで操作できます</p>
            </div>
            <span className="text-zinc-300 group-hover:text-zinc-500 transition-colors">→</span>
          </Link>

          <Link
            href={`/${DEMO_STORE_ID}/admin`}
            className="flex items-center gap-3 rounded-2xl px-4 py-3.5 bg-white hover:bg-zinc-50 border border-zinc-200 transition-colors group"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-white shrink-0"
              style={{ background: 'linear-gradient(135deg, #ec4899, #f97316)' }}>
              🏪
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-900">スタッフ管理画面を試す</p>
              <p className="text-[11px] text-zinc-400">PIN: <span className="font-mono font-bold text-zinc-600">{DEMO_PIN}</span> でログインできます</p>
            </div>
            <span className="text-zinc-300 group-hover:text-zinc-500 transition-colors">→</span>
          </Link>
        </div>

        <div className="mt-8 flex flex-col items-center gap-3">
          <p className="text-[11px] text-zinc-400">
            Powered by LINE × Next.js
          </p>
        </div>
      </div>
    </main>
  )
}

function Step({ n, text }: { n: number, text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="shrink-0 w-6 h-6 rounded-full text-xs font-black flex items-center justify-center text-white"
        style={{
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          boxShadow: '0 4px 12px -4px rgba(99, 102, 241, 0.6)',
        }}
      >
        {n}
      </span>
      <span className="leading-relaxed pt-0.5">{text}</span>
    </li>
  )
}
