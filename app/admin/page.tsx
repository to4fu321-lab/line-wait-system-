'use client'

import { Store } from 'lucide-react'

// ============================================================
// スタッフ画面 直接入口（廃止）
//
// 以前はここで全店舗の一覧を表示し、選択して /{storeId}/admin へ
// 遷移していたが、認証前に他店舗の存在を誰でも閲覧・選択できてしまう
// 問題があったため一覧表示をやめた。各店舗のスタッフは、店舗ごとに
// 発行されたブックマーク/QRコードのURL（/{storeId}/admin）から
// 直接アクセスすること。
// ============================================================
export default function StaffEntryPage() {
  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center justify-center gap-3 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-100 border border-indigo-200 flex items-center justify-center mb-2">
        <Store size={28} className="text-indigo-600" />
      </div>
      <p className="text-gray-800 font-bold text-lg">店舗ごとの管理画面URLからアクセスしてください</p>
      <p className="text-gray-400 text-sm max-w-xs">
        お店のブックマークまたはQRコードから管理画面（/店舗ID/admin）を開いてください。URLが分からない場合は運営にお問い合わせください。
      </p>
    </div>
  )
}
