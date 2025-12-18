"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, BoxIcon } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  Package,
  Users,
  TruckIcon,
  ShoppingCart,
  Hand,
  Factory,
  BarChart3,
  Settings,
  FileText,
  Search,
  Link2,
  Activity,
} from "lucide-react"

interface MobileHeaderProps {
  user: {
    name?: string | null
    email?: string | null
    role?: string
  }
}

const navigation = [
  {
    name: "Inventory",
    href: "/dashboard/inventory",
    icon: Package,
    roles: ["ADMIN", "RECEIVER", "PACKER", "MANAGER"],
  },
  {
    name: "Receiving",
    href: "/dashboard/receiving",
    icon: TruckIcon,
    roles: ["ADMIN", "RECEIVER", "MANAGER"],
  },
  {
    name: "Orders",
    href: "/dashboard/orders",
    icon: ShoppingCart,
    roles: ["ADMIN"],
  },
  {
    name: "Picking",
    href: "/dashboard/picking",
    icon: Hand,
    roles: ["ADMIN", "PACKER", "MANAGER"],
  },
  {
    name: "Production",
    href: "/dashboard/production",
    icon: Factory,
    roles: ["ADMIN", "RECEIVER", "PACKER", "MANAGER"],
  },
  {
    name: "Reports",
    href: "/dashboard/reports",
    icon: BarChart3,
    roles: ["ADMIN", "RECEIVER", "PACKER", "MANAGER"],
  },
  {
    name: "Users",
    href: "/dashboard/users",
    icon: Users,
    roles: ["ADMIN"],
  },
]

const adminNavigation = [
  {
    name: "Admin Dashboard",
    href: "/dashboard/admin",
    icon: Settings,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    name: "System Logs",
    href: "/dashboard/admin/logs",
    icon: FileText,
    roles: ["ADMIN"],
  },
  {
    name: "Traceability",
    href: "/dashboard/admin/traceability",
    icon: Search,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    name: "QuickBooks Sync",
    href: "/dashboard/admin/integrations/qbo",
    icon: Link2,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    name: "System Health",
    href: "/dashboard/admin/health",
    icon: Activity,
    roles: ["ADMIN", "MANAGER"],
  },
  {
    name: "Products",
    href: "/dashboard/admin/products",
    icon: Package,
    roles: ["ADMIN", "MANAGER"],
  },
]

export function MobileHeader({ user }: MobileHeaderProps) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Filter navigation items based on user role (case-insensitive)
  const filteredNav = navigation.filter((item) => {
    if (item.name === "Reports" && user.role) {
      return true
    }
    if (!user.role) return false
    const userRole = user.role.toUpperCase()
    return item.roles.some((role) => role.toUpperCase() === userRole)
  })

  const filteredAdminNav = adminNavigation.filter((item) => {
    if (!user.role) return false
    const userRole = user.role.toUpperCase()
    return item.roles.some((role) => role.toUpperCase() === userRole)
  })

  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 px-4 shadow-sm">
      {/* Logo */}
      <Link href="/dashboard" className="flex items-center">
        <BoxIcon className="h-8 w-8 text-blue-600" />
        <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
          PalettaHub
        </span>
      </Link>

      {/* Hamburger Menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-md p-2 text-gray-700 hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="h-6 w-6" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <div className="flex h-full flex-col">
            {/* Logo in Sheet */}
            <div className="flex h-16 shrink-0 items-center border-b border-gray-200 dark:border-gray-700 px-6">
              <BoxIcon className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
                PalettaHub
              </span>
            </div>

            {/* Navigation */}
            <nav className="flex flex-1 flex-col overflow-y-auto px-4 py-4">
              <ul role="list" className="flex flex-1 flex-col gap-y-7">
                {/* Main Navigation */}
                <li>
                  <ul role="list" className="-mx-2 space-y-1">
                    {filteredNav.map((item) => {
                      const isActive =
                        pathname === item.href ||
                        pathname.startsWith(item.href + "/")
                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
                            onClick={() => setOpen(false)}
                            className={cn(
                              isActive
                                ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700",
                              "group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors"
                            )}
                          >
                            <item.icon
                              className={cn(
                                isActive
                                  ? "text-blue-600 dark:text-blue-400"
                                  : "text-gray-400 group-hover:text-gray-600 dark:text-gray-400 dark:group-hover:text-gray-300",
                                "h-5 w-5 shrink-0"
                              )}
                              aria-hidden="true"
                            />
                            {item.name}
                          </Link>
                        </li>
                      )
                    })}
                  </ul>
                </li>

                {/* Admin Section */}
                {filteredAdminNav.length > 0 && (
                  <li>
                    <div className="text-xs font-semibold leading-6 text-gray-400 dark:text-gray-500">
                      ADMINISTRATION
                    </div>
                    <ul role="list" className="-mx-2 mt-2 space-y-1">
                      {filteredAdminNav.map((item) => {
                        const isActive =
                          pathname === item.href ||
                          pathname.startsWith(item.href + "/")
                        return (
                          <li key={item.name}>
                            <Link
                              href={item.href}
                              onClick={() => setOpen(false)}
                              className={cn(
                                isActive
                                  ? "bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400"
                                  : "text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700",
                                "group flex gap-x-3 rounded-md p-2 text-sm font-semibold leading-6 transition-colors"
                              )}
                            >
                              <item.icon
                                className={cn(
                                  isActive
                                    ? "text-purple-600 dark:text-purple-400"
                                    : "text-gray-400 group-hover:text-gray-600 dark:text-gray-400 dark:group-hover:text-gray-300",
                                  "h-5 w-5 shrink-0"
                                )}
                                aria-hidden="true"
                              />
                              {item.name}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )}

                {/* User info at bottom */}
                <li className="mt-auto">
                  <div className="flex items-center gap-x-4 px-2 py-3 text-sm font-semibold leading-6 text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white font-bold">
                      {user.name?.charAt(0) || user.email?.charAt(0) || "U"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {user.name || "User"}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {user.role || ""}
                      </p>
                    </div>
                  </div>
                </li>
              </ul>
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}
