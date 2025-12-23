"use client"

import { usePathname } from "next/navigation"
import { DashboardNav } from "./DashboardNav"
import { DashboardHeader } from "./DashboardHeader"
import { MobileHeader } from "./MobileHeader"

interface ConditionalDashboardNavProps {
  user: {
    name?: string | null
    email?: string | null
    role?: string
  }
}

export function ConditionalDashboardNav({ user }: ConditionalDashboardNavProps) {
  const pathname = usePathname()
  const isAdminRoute = pathname?.startsWith("/dashboard/admin") ?? false

  if (isAdminRoute) {
    return null
  }

  return (
    <>
      {/* Mobile Header - Only visible on mobile (below md breakpoint) */}
      <div className="block md:hidden">
        <MobileHeader user={user} />
      </div>

      {/* Desktop Sidebar - Hidden on mobile, visible on md and up */}
      <DashboardNav user={user} />
      
      {/* Desktop Header - Hidden on mobile, visible on md and up */}
      <div className="hidden md:block">
        <DashboardHeader user={user} />
      </div>
    </>
  )
}
