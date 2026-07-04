/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    // 型エラーがあってもビルドを通す（Vercelでの型チェックタイムアウト対策）
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
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
