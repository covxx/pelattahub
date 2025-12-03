"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import {
  Package,
  BoxIcon,
  ClipboardList,
  Users,
  TruckIcon,
  LayoutDashboard,
  Settings,
  FileText,
  Search,
  ShoppingCart,
  Link2,
  Activity,
  Hand,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface DashboardNavProps {
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
    roles: ["ADMIN", "RECEIVER", "PACKER"],
  },
  {
    name: "Receiving",
    href: "/dashboard/receiving",
    icon: TruckIcon,
    roles: ["ADMIN", "RECEIVER"],
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
    roles: ["ADMIN", "PACKER"],
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
    roles: ["ADMIN"],
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
    roles: ["ADMIN"],
  },
  {
    name: "QuickBooks Sync",
    href: "/dashboard/admin/integrations/qbo",
    icon: Link2,
    roles: ["ADMIN"],
  },
  {
    name: "System Health",
    href: "/dashboard/admin/health",
    icon: Activity,
    roles: ["ADMIN"],
  },
]

export function DashboardNav({ user }: DashboardNavProps) {
  const pathname = usePathname()

  // Filter navigation items based on user role
  const filteredNav = navigation.filter((item) =>
    item.roles.includes(user.role || "")
  )
  
  const filteredAdminNav = adminNavigation.filter((item) =>
    item.roles.includes(user.role || "")
  )

  return (
    <>
      {/* Mobile sidebar backdrop */}
      <div className="lg:hidden fixed inset-0 z-40 bg-gray-900/80" aria-hidden="true" />

      {/* Sidebar */}
      <div className="fixed inset-y-0 z-50 flex w-64 flex-col">
        {/* Sidebar component */}
        <div className="flex grow flex-col gap-y-5 overflow-y-auto border-r border-gray-200 bg-white dark:bg-gray-800 dark:border-gray-700 px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center border-b border-gray-200 dark:border-gray-700 -mx-6 px-6">
            <BoxIcon className="h-8 w-8 text-blue-600" />
            <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">
              WMS
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              {/* Main Navigation */}
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {filteredNav.map((item) => {
                    const isActive = pathname === item.href
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
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

              {/* Admin Section - Only for ADMIN role */}
              {filteredAdminNav.length > 0 && (
                <li>
                  <div className="text-xs font-semibold leading-6 text-gray-400 dark:text-gray-500">
                    ADMINISTRATION
                  </div>
                  <ul role="list" className="-mx-2 mt-2 space-y-1">
                    {filteredAdminNav.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                      return (
                        <li key={item.name}>
                          <Link
                            href={item.href}
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
                <div className="flex items-center gap-x-4 px-2 py-3 text-sm font-semibold leading-6 text-gray-900 dark:text-white border-t border-gray-200 dark:border-gray-700 -mx-2">
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
      </div>
    </>
  )
}

