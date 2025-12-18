import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { DashboardNav } from "@/components/dashboard/DashboardNav"
import { DashboardHeader } from "@/components/dashboard/DashboardHeader"
import { MobileHeader } from "@/components/dashboard/MobileHeader"

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
      {/* Mobile Header - Only visible on mobile (below md breakpoint) */}
      <div className="block md:hidden">
        <MobileHeader user={session.user} />
      </div>

      {/* Desktop Sidebar - Hidden on mobile, visible on md and up */}
      <DashboardNav user={session.user} />
      
      {/* Main Content Area */}
      <div className="md:pl-64">
        {/* Desktop Header - Hidden on mobile, visible on md and up */}
        <div className="hidden md:block">
          <DashboardHeader user={session.user} />
        </div>
        
        {/* Page Content */}
        <main className="py-4 px-4 md:py-6 md:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  )
}

