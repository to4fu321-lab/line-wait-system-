import Link from 'next/link'
import { listStoreThemes } from '@/config/themes'

export default function RootPage() {
  const stores = listStoreThemes()

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

        {/* デモ用：登録店舗一覧 */}
        {stores.length > 0 && (
          <div
            className="bg-white/70 backdrop-blur-2xl rounded-3xl border border-white/60 p-5"
            style={{
              boxShadow: `
                0 24px 60px -20px rgba(99, 102, 241, 0.18),
                0 1px 0 0 rgb(255 255 255 / 0.65) inset
              `,
            }}
          >
            <h2 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3">
              デモ店舗
            </h2>
            <div className="space-y-2">
              {stores.map(s => (
                <Link
                  key={s.storeId}
                  href={`/${s.storeId}`}
                  className="flex items-center gap-3 rounded-2xl px-3 py-2.5 hover:bg-white/80 transition-colors group"
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-xl text-white shrink-0"
                    style={{
                      background: `linear-gradient(135deg, ${s.colors.primary}, ${s.colors.accent})`,
                      boxShadow: `0 6px 16px -6px rgb(${s.colors.primaryRgb} / 0.5)`,
                    }}
                  >
                    {s.logoEmoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate">{s.storeName}</p>
                    <p className="text-[11px] text-zinc-500 truncate">{s.tagline}</p>
                  </div>
                  <span className="text-zinc-300 group-hover:text-zinc-500 transition-colors">→</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            href="/super-admin"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100/60 transition-colors"
          >
            <span>🏢</span>
            <span>総管理ダッシュボード</span>
            <span className="text-zinc-300">→</span>
          </Link>
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
