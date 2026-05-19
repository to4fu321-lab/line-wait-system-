export default function RootPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-6">🎓</div>
        <h1 className="text-3xl font-black text-gray-800 mb-3">順番待ちシステム</h1>
        <p className="text-gray-500 text-lg mb-8">
          店舗のQRコードを読み取るか、<br />
          スタッフから案内されたURLにアクセスしてください。
        </p>
        <div className="bg-white rounded-2xl border border-gray-200 p-5 text-left text-sm text-gray-600 space-y-2">
          <p className="font-bold text-gray-800 mb-3">URLの形式</p>
          <p>📱 お客様受付：<code className="bg-gray-100 px-1 rounded">/{'{'}店舗ID{'}'}</code></p>
          <p>🔧 スタッフ管理：<code className="bg-gray-100 px-1 rounded">/{'{'}店舗ID{'}'}/admin</code></p>
        </div>
      </div>
    </div>
  )
}
