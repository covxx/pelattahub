import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { SystemHealthDashboard } from "@/components/admin/SystemHealthDashboard"
import { getSystemHealth } from "@/app/actions/health"

// Force dynamic rendering to prevent caching
export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function SystemHealthPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Allow ADMIN, MANAGER, and SRJLABS roles (consistent with health actions)
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER" && session.user.role !== "SRJLABS") {
    redirect("/dashboard")
  }

  // Fetch health data
  const health = await getSystemHealth()

  return <SystemHealthDashboard initialHealth={health} />
}


