import { redirect } from 'next/navigation'

export default function SettingsPage({ params }: { params: { storeId: string } }) {
  redirect(`/${params.storeId}/admin/settings/staff`)
}
