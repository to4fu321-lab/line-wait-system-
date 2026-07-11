/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 型エラー・lintエラーはビルド失敗として扱う（品質ゲート）。
  // 以前は ignoreBuildErrors: true だったが、型エラーが本番に到達しうるため撤廃。
  async redirects() {
    return [
      // 旧 /admin/repair は CRM 画面へ統合済み（旧クライアント側リダイレクトの置き換え）
      {
        source: '/:storeId/admin/repair',
        destination: '/:storeId/admin/crm',
        permanent: false,
      },
    ]
  },
}

export default nextConfig
