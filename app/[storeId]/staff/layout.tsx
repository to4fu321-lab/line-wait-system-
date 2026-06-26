// スタッフ用ポータル（管理ナビなし・店舗PINの裏に置かない最小レイアウト）
export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[100dvh] bg-gray-50">{children}</div>
}
