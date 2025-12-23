"use client"

import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"

interface ConditionalContentAreaProps {
  children: React.ReactNode
}

export function ConditionalContentArea({ children }: ConditionalContentAreaProps) {
  const pathname = usePathname()
  const isAdminRoute = pathname?.startsWith("/dashboard/admin") ?? false

  return (
    <div className={cn("w-full", !isAdminRoute && "md:pl-64")}>
      {/* Page Content */}
      <main className="w-full py-4 px-4 md:py-6 md:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
