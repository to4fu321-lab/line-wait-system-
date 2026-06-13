'use client'

import SimpleMaster from '../_components/SimpleMaster'

export default function CustomerTagsMasterPage() {
  return (
    <SimpleMaster
      table="customer_tags"
      title="顧客タグマスタ"
      emoji="🏷️"
      headerGrad="from-rose-600 to-pink-600"
      primaryKey="name"
      secondaryKeys={['description']}
      emptyHint="CRMで使う顧客タグを登録します"
      fields={[
        { key: 'name',        label: 'タグ名', required: true, placeholder: '例: VIP / 兄弟あり / 卒業予定' },
        { key: 'color',       label: '表示色', type: 'color' },
        { key: 'description', label: '説明', type: 'textarea', placeholder: 'どんな顧客に付けるタグか' },
      ]}
    />
  )
}
