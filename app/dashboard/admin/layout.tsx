import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Security Check: Only ADMIN and MANAGER roles can access
  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    redirect("/dashboard")
  }

  return (
    <div className="space-y-6">
      {/* Admin Header */}
      <div className="border-b pb-4">
        <h1 className="text-3xl font-bold">Admin Workspace</h1>
        <p className="text-muted-foreground">
          System administration and configuration
        </p>
      </div>

      {/* Sub-navigation Tabs */}
      <div className="border-b">
        <nav className="flex space-x-6" aria-label="Admin navigation">
          <AdminNavLink href="/dashboard/admin" exact>
            📊 Dashboard
          </AdminNavLink>
          <AdminNavLink href="/dashboard/admin/products">
            📦 Products
          </AdminNavLink>
          <AdminNavLink href="/dashboard/admin/vendors">
            🚚 Vendors
          </AdminNavLink>
          <AdminNavLink href="/dashboard/admin/users">
            👥 Users
          </AdminNavLink>
          <AdminNavLink href="/dashboard/admin/customers">
            🏢 Customers
          </AdminNavLink>
          {session.user.role === "ADMIN" && (
            <AdminNavLink href="/dashboard/admin/logs">
              📋 System Logs
            </AdminNavLink>
          )}
          {session.user.role === "ADMIN" && (
            <AdminNavLink href="/dashboard/admin/recall">
              🚨 Recall
            </AdminNavLink>
          )}
          <AdminNavLink href="/dashboard/admin/traceability">
            🔍 Traceability
          </AdminNavLink>
          <AdminNavLink href="/dashboard/admin/health">
            💚 System Health
          </AdminNavLink>
          <AdminNavLink href="/dashboard/admin/settings">
            ⚙️ Settings
          </AdminNavLink>
        </nav>
      </div>

      {/* Admin Content */}
      <div>{children}</div>
    </div>
  )
}

function AdminNavLink({
  href,
  exact = false,
  children,
}: {
  href: string
  exact?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center px-1 pt-1 pb-4 border-b-2 text-sm font-medium transition-colors",
        "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
      )}
    >
      {children}
    </Link>
  )
}

