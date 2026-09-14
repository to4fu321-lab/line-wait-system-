'use client'

import { StoreNameBadge } from './StoreNameBadge'
import { FixNoticeBanner } from './FixNoticeBanner'

// 電話モード専用の常設バー。左に店舗名、右に完了お知らせのベルを置く。
// position:fixedで個別に重ねると各ページ独自のヘッダーと衝突していたため、
// 実際にスペースを取る1本の帯として画面最上部に固定し、ページ本体はその下から
// 始まるようにする（衝突しようがない構造にする）。
export function AdminTopBar() {
  return (
    <div className="sticky top-0 z-40 flex items-center justify-between gap-2 bg-gray-900 px-3"
      style={{ paddingTop: 'calc(0.375rem + env(safe-area-inset-top))', paddingBottom: '0.375rem' }}>
      <StoreNameBadge />
      <FixNoticeBanner variant="inline" />
    </div>
  )
}
