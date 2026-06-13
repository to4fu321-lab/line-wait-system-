'use client'

import SimpleMaster from '../_components/SimpleMaster'

export default function SuppliersMasterPage() {
  return (
    <SimpleMaster
      table="suppliers"
      title="メーカー・仕入先マスタ"
      emoji="🏭"
      headerGrad="from-amber-600 to-orange-600"
      primaryKey="name"
      secondaryKeys={['contact_person', 'tel']}
      emptyHint="発注先のメーカー・仕入先を登録します"
      fields={[
        { key: 'name',           label: '仕入先名',   required: true, placeholder: '例: ○○被服' },
        { key: 'kana',           label: 'フリガナ',   placeholder: 'マルマルヒフク' },
        { key: 'tel',            label: '電話番号',   type: 'tel' },
        { key: 'email',          label: 'メール',     type: 'email' },
        { key: 'contact_person', label: '担当者' },
        { key: 'lead_time_days', label: '標準納期(日)', type: 'number', placeholder: '7' },
        { key: 'notes',          label: 'メモ',       type: 'textarea' },
      ]}
    />
  )
}
