'use client'

import SimpleMaster from '../_components/SimpleMaster'

export default function SizesMasterPage() {
  return (
    <SimpleMaster
      table="size_presets"
      title="サイズマスタ"
      emoji="📏"
      headerGrad="from-sky-600 to-cyan-600"
      primaryKey="label"
      secondaryKeys={['category']}
      emptyHint="共通で使うサイズ表記を登録します"
      fields={[
        { key: 'label',    label: 'サイズ表記', required: true, placeholder: '例: 150 / M / W64' },
        { key: 'category', label: '区分', type: 'select', options: [
          { value: 'general',  label: '共通' },
          { value: 'tops',     label: 'トップス' },
          { value: 'bottoms',  label: 'ボトムス' },
          { value: 'shoes',    label: 'シューズ' },
          { value: 'other',    label: 'その他' },
        ] },
      ]}
    />
  )
}
