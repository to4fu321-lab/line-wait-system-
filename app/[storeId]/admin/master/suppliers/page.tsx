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
        { key: 'name',           label: '仕入先名',   required: true, placeholder: '例: トンボ / ○○被服' },
        { key: 'kana',           label: 'フリガナ',   placeholder: 'トンボ' },
        { key: 'tel',            label: '電話番号',   type: 'tel' },
        { key: 'email',          label: 'メール',     type: 'email' },
        { key: 'contact_person', label: '担当者' },
        { key: 'lead_time_days', label: '標準納期(日)', type: 'number', placeholder: '7' },
        { key: 'order_method',   label: '発注方法', type: 'select', options: [
          { value: 'web',   label: 'Web' },
          { value: 'fax',   label: 'FAX' },
          { value: 'phone', label: '電話' },
          { value: 'email', label: 'メール' },
          { value: 'other', label: 'その他' },
        ] },
        { key: 'order_url',      label: '発注先URL / FAX番号', full: true, placeholder: 'https://... または FAX番号' },
        { key: 'min_lot',        label: '最低ロット', type: 'number', placeholder: '1' },
        { key: 'notes',          label: 'メモ',       type: 'textarea' },
      ]}
    />
  )
}
