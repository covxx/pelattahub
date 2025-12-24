"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { 
  LayoutDashboard, 
  Package, 
  Truck, 
  Users, 
  Building2, 
  FileText, 
  AlertTriangle, 
  Search, 
  Activity, 
  Settings,
  Link2,
  ArrowLeft
} from "lucide-react"

interface AdminSidebarProps {
  isAdmin: boolean
  isManager: boolean
}

export function AdminSidebar({ isAdmin, isManager }: AdminSidebarProps) {
  const pathname = usePathname()

  // Navigation items grouped by category
  const dataManagementItems = [
    { href: "/dashboard/admin/products", label: "Products", icon: Package },
    { href: "/dashboard/admin/vendors", label: "Vendors", icon: Truck },
    { href: "/dashboard/admin/users", label: "Users", icon: Users },
    { href: "/dashboard/admin/customers", label: "Customers", icon: Building2 },
  ]

  const systemItems = [
    { href: "/dashboard/admin/traceability", label: "Traceability", icon: Search },
    { href: "/dashboard/admin/integrations/qbo", label: "QuickBooks Sync", icon: Link2 },
    { href: "/dashboard/admin/settings", label: "Settings", icon: Settings },
  ]

  // Management tools (Admin and Manager)
  const managementItems = (isAdmin || isManager) ? [
    { href: "/dashboard/admin/recall", label: "Recall", icon: AlertTriangle },
  ] : []

  // Admin only items
  const adminOnlyItems = isAdmin ? [
    { href: "/dashboard/admin/logs", label: "System Logs", icon: FileText },
    { href: "/dashboard/admin/health", label: "System Health", icon: Activity },
  ] : []

  return (
    <aside className="w-full lg:w-64 flex-shrink-0">
      <div className="bg-card border rounded-lg p-4 space-y-6 sticky top-4">
        {/* Header */}
        <div className="border-b pb-4">
          <h2 className="text-lg font-semibold">Admin Workspace</h2>
          <p className="text-xs text-muted-foreground mt-1">
            System administration
          </p>
        </div>

        {/* Navigation Groups */}
        <nav className="space-y-6">
          {/* Back to Main Dashboard */}
          <div>
            <Link
              href="/dashboard/inventory"
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                "group border-b border-border pb-4 mb-2"
              )}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Main Dashboard</span>
            </Link>
          </div>

          {/* Dashboard Link */}
          <div>
            <AdminNavLink href="/dashboard/admin" pathname={pathname} exact>
              <LayoutDashboard className="h-4 w-4" />
              <span>Dashboard</span>
            </AdminNavLink>
          </div>

          {/* Data Management */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
              Data Management
            </p>
            <div className="space-y-1">
              {dataManagementItems.map((item) => (
                <AdminNavLink key={item.href} href={item.href} pathname={pathname}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </AdminNavLink>
              ))}
            </div>
          </div>

          {/* System */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
              System
            </p>
            <div className="space-y-1">
              {systemItems.map((item) => (
                <AdminNavLink key={item.href} href={item.href} pathname={pathname}>
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </AdminNavLink>
              ))}
            </div>
          </div>

          {/* Management Tools */}
          {managementItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                Management
              </p>
              <div className="space-y-1">
                {managementItems.map((item) => (
                  <AdminNavLink key={item.href} href={item.href} pathname={pathname}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </AdminNavLink>
                ))}
              </div>
            </div>
          )}

          {/* Admin Only */}
          {adminOnlyItems.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-2">
                Admin Only
              </p>
              <div className="space-y-1">
                {adminOnlyItems.map((item) => (
                  <AdminNavLink key={item.href} href={item.href} pathname={pathname}>
                    <item.icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </AdminNavLink>
                ))}
              </div>
            </div>
          )}
        </nav>
      </div>
    </aside>
  )
}

function AdminNavLink({
  href,
  pathname,
  exact = false,
  children,
}: {
  href: string
  pathname: string
  exact?: boolean
  children: React.ReactNode
}) {
  // Determine if this link is active
  const isActive = exact 
    ? pathname === href || pathname === href + "/"
    : pathname.startsWith(href) && (pathname === href || pathname.startsWith(href + "/"))

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        isActive
          ? "bg-primary/10 text-primary font-semibold"
          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
        "group"
      )}
    >
      {children}
    </Link>
  )
}
