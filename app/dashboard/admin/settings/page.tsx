import { getCompanySettings } from "@/app/actions/settings"
import { SettingsForm } from "@/components/admin/SettingsForm"

export default async function SettingsPage() {
  const settings = await getCompanySettings()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">System Settings</h2>
        <p className="text-muted-foreground">
          Configure company information for labels and receipts
        </p>
      </div>

      <SettingsForm initialSettings={settings} />
    </div>
  )
}


