import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ConditionalDashboardNav } from "@/components/dashboard/ConditionalDashboardNav"
import { ConditionalContentArea } from "@/components/dashboard/ConditionalContentArea"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Conditionally render sidebar and header based on route */}
      <ConditionalDashboardNav user={session.user} />
      
      {/* Main Content Area - Adjust padding based on sidebar visibility */}
      <ConditionalContentArea>
        {children}
      </ConditionalContentArea>
    </div>
  )
}

