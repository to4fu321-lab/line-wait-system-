'use client'

import { useParams } from 'next/navigation'
import SimpleMaster from '../_components/SimpleMaster'
import { FeatureGuard } from '@/app/_components/FeatureGuard'

// お直し加工業者（外注先）マスタ。受付モーダルでワンタップ選択できる。
export default function RepairVendorsMasterPage() {
  const storeId = useParams<{ storeId: string }>()?.storeId ?? ''
  return (
    <FeatureGuard storeId={storeId} feature="repairs_master">
    <SimpleMaster
      table="repair_vendors"
      title="お直し加工業者"
      emoji="🧵"
      headerGrad="from-rose-600 to-pink-600"
      primaryKey="name"
      secondaryKeys={['tel', 'note']}
      ocrMapping={{ nameKey: 'name', telKey: 'tel' }}
      emptyHint="お直しを外注する加工業者を登録します（受付でワンタップ選択できます）"
      fields={[
        { key: 'name', label: '業者名',   required: true, placeholder: '例: ○○リフォーム / 自社工房' },
        { key: 'kana', label: 'フリガナ', placeholder: 'マルマルリフォーム' },
        { key: 'tel',  label: '電話番号', type: 'tel' },
        { key: 'note', label: 'メモ',     type: 'textarea', placeholder: '対応内容・納期の目安など' },
      ]}
    />
    </FeatureGuard>
  )
}
