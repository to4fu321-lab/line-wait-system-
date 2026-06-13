'use client'

import SimpleMaster from '../_components/SimpleMaster'

export default function TemplatesMasterPage() {
  return (
    <SimpleMaster
      table="message_templates"
      title="定型文テンプレート"
      emoji="💬"
      headerGrad="from-teal-600 to-emerald-600"
      primaryKey="title"
      secondaryKeys={['body']}
      emptyHint="LINE通知文・注意事項・備考の定型を登録します"
      fields={[
        { key: 'title',    label: 'テンプレ名', required: true, placeholder: '例: 入荷のご連絡' },
        { key: 'category', label: '用途', type: 'select', options: [
          { value: 'general',     label: '汎用' },
          { value: 'line_notify', label: 'LINE通知文' },
          { value: 'repair_note', label: 'お直し注意事項' },
          { value: 'memo',        label: '備考・メモ' },
        ] },
        { key: 'body',     label: '本文', type: 'textarea', required: true, placeholder: '本文を入力（コピペで使えます）' },
      ]}
    />
  )
}
