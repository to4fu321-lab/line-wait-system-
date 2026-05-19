export default function OldAdminPage() {
  return (
    <div className="min-h-screen bg-gray-800 flex flex-col items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">🔄</div>
        <h1 className="text-2xl font-black text-white mb-3">URLが変わりました</h1>
        <p className="text-gray-400 mb-6">
          多店舗対応により、管理画面のURLが変更されました。
        </p>
        <div className="bg-gray-700 rounded-2xl p-5 text-left text-sm text-gray-300">
          <p className="font-bold text-white mb-2">新しいURL</p>
          <code className="text-blue-400">/{'{'}店舗ID{'}'}/admin</code>
          <p className="mt-3 text-gray-400 text-xs">
            店舗IDはSupabaseの stores テーブルで確認できます。
          </p>
        </div>
      </div>
    </div>
  )
}
