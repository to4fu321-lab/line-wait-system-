import type { Metadata } from 'next'
import AdminLayoutClient from './AdminLayoutClient'

type Props = {
  children: React.ReactNode
  params:   { storeId: string }
}

// 全店舗共通の public/manifest.json (start_url: "/") をそのまま使うと、
// ホーム画面に追加したショートカットが必ずサイトルート(→LP)を開いてしまい、
// 自店舗の管理画面に戻れなくなる（＝顧客・登録データが無い別画面に見える）。
// /[storeId]/admin 配下だけは店舗別の manifest に差し替える。
export function generateMetadata({ params }: Props): Metadata {
  return {
    manifest: `/${params.storeId}/admin/manifest.webmanifest`,
  }
}

export default function AdminLayout({ children }: Props) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
