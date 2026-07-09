import { redirect } from 'next/navigation'

// ルート(/)はサービス紹介LP(/lp)へ誘導する。
// サンプル店舗の案内画面は不要になったため廃止。
export default function RootPage() {
  redirect('/lp')
}
