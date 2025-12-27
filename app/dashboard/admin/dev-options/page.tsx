import { redirect } from "next/navigation"
import { DevOptionsClient } from "@/components/admin/DevOptionsClient"
import { getDevStats } from "@/app/actions/dev-options"
import { requireAdmin } from "@/lib/auth-helpers"

export default async function DevOptionsPage() {
  // Security Check: Only ADMIN and SRJLABS roles can access
  try {
    await requireAdmin()
  } catch {
    redirect("/dashboard/inventory")
  }

  const stats = await getDevStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Development Options</h1>
        <p className="text-muted-foreground mt-2">
          Dangerous operations for testing and development. Use with extreme caution.
        </p>
      </div>

      <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4">
        <h2 className="text-lg font-semibold text-destructive mb-2">
          ⚠️ Warning: Destructive Operations
        </h2>
        <p className="text-sm text-muted-foreground">
          All operations on this page will permanently delete data from the database.
          This cannot be undone. Only use in development or testing environments.
        </p>
      </div>

      <DevOptionsClient initialStats={stats} />
    </div>
  )
}


