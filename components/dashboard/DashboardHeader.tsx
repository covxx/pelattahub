"use client"

import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { signOut } from "next-auth/react"

interface DashboardHeaderProps {
  user: {
    name?: string | null
    email?: string | null
  }
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  const handleSignOut = async () => {
    await signOut({ callbackUrl: "/login" })
  }

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="flex flex-1 items-center">
          {/* You can add breadcrumbs or page title here */}
        </div>
        
        <div className="flex items-center gap-x-4 lg:gap-x-6">
          {/* User info - hidden on mobile, shown in sidebar */}
          <div className="hidden lg:block lg:h-6 lg:w-px lg:bg-gray-200 dark:lg:bg-gray-700" aria-hidden="true" />
          
          {/* Sign out button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </div>
    </header>
  )
}

