'use client'

export default function StoreError({
  error,
}: {
  error: Error & { digest?: string }
}) {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">⚠️</div>
        <h1 className="text-xl font-black text-white mb-3">エラーが発生しました</h1>
        <p className="text-red-400 text-sm font-mono bg-gray-800 rounded-xl p-4 text-left break-all">
          {error.message || 'Unknown error'}
        </p>
        {error.digest && (
          <p className="text-gray-500 text-xs mt-2">digest: {error.digest}</p>
        )}
      </div>
    </div>
  )
}
