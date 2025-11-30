import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SystemHealthDashboard } from "@/components/admin/SystemHealthDashboard"
import { getSystemHealth } from "@/app/actions/health"

export default async function SystemHealthPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN") {
    redirect("/dashboard")
  }

  // Fetch health data
  const health = await getSystemHealth()

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <SystemHealthDashboard initialHealth={health} />
    </div>
  )
}

