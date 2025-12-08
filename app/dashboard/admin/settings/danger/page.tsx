import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DangerZone } from "@/components/admin/DangerZone"

export default async function DangerZonePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Strictly require ADMIN role (not MANAGER)
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Danger Zone</h2>
        <p className="text-muted-foreground">
          Irreversible database operations. Admin access required.
        </p>
      </div>

      <DangerZone />
    </div>
  )
}

