import { getAdminStats } from "@/app/actions/admin"
import { auth } from "@/lib/auth"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Package, Truck, Users, Building2, LayoutDashboard, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { 
  FileText, 
  AlertTriangle, 
  Search, 
  Activity, 
  Settings,
  Link2
} from "lucide-react"

export default async function AdminDashboardPage() {
  const session = await auth()
  const stats = await getAdminStats()
  const isAdmin = session?.user?.role === "ADMIN"
  const isManager = session?.user?.role === "MANAGER"

  // Navigation cards grouped by category
  const dataManagementCards = [
    {
      href: "/dashboard/admin/products",
      title: "Products",
      description: "Manage product catalog, SKUs, and inventory items",
      icon: Package,
      stat: stats.productCount,
      statLabel: "Active products",
    },
    {
      href: "/dashboard/admin/vendors",
      title: "Vendors",
      description: "Configure suppliers and vendor relationships",
      icon: Truck,
      stat: stats.vendorCount,
      statLabel: "Active vendors",
    },
    {
      href: "/dashboard/admin/users",
      title: "Users",
      description: "Manage user accounts and role permissions",
      icon: Users,
      stat: stats.userCount,
      statLabel: "System users",
    },
    {
      href: "/dashboard/admin/customers",
      title: "Customers",
      description: "Manage customer database for order management",
      icon: Building2,
      stat: stats.customerCount,
      statLabel: "Active customers",
    },
  ]

  const systemCards = [
    {
      href: "/dashboard/admin/traceability",
      title: "Traceability",
      description: "Track lot history and audit trails",
      icon: Search,
    },
    {
      href: "/dashboard/admin/integrations/qbo",
      title: "QuickBooks Sync",
      description: "Configure QuickBooks Online integration",
      icon: Link2,
    },
    {
      href: "/dashboard/admin/settings",
      title: "Settings",
      description: "System configuration and preferences",
      icon: Settings,
    },
  ]

  // Management tools (Admin and Manager)
  const managementCards = (isAdmin || isManager) ? [
    {
      href: "/dashboard/admin/recall",
      title: "Recall Management",
      description: "Manage product recalls and safety alerts",
      icon: AlertTriangle,
    },
  ] : []

  // Admin only cards
  const adminOnlyCards = isAdmin ? [
    {
      href: "/dashboard/admin/logs",
      title: "System Logs",
      description: "View audit logs and system events",
      icon: FileText,
    },
    {
      href: "/dashboard/admin/health",
      title: "System Health",
      description: "Monitor system performance and status",
      icon: Activity,
    },
  ] : []

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <Link href="/dashboard/inventory">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          System overview and quick access to administration tools
        </p>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Products
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.productCount}</div>
            <p className="text-xs text-muted-foreground">
              SKUs in the system
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Active Vendors
            </CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.vendorCount}</div>
            <p className="text-xs text-muted-foreground">
              Suppliers configured
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              System Users
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.userCount}</div>
            <p className="text-xs text-muted-foreground">
              Staff accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Customers
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customerCount}</div>
            <p className="text-xs text-muted-foreground">
              Active customers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Data Management Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Data Management</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {dataManagementCards.map((card) => {
            const Icon = card.icon
            return (
              <Link key={card.href} href={card.href}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      {card.stat !== undefined && (
                        <div className="text-2xl font-bold">{card.stat}</div>
                      )}
                    </div>
                    <CardTitle className="mt-4">{card.title}</CardTitle>
                    <CardDescription className="text-xs">
                      {card.description}
                    </CardDescription>
                  </CardHeader>
                  {card.statLabel && (
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        {card.statLabel}
                      </p>
                    </CardContent>
                  )}
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* System Section */}
      <div>
        <h2 className="text-xl font-semibold mb-4">System & Configuration</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {systemCards.map((card) => {
            const Icon = card.icon
            return (
              <Link key={card.href} href={card.href}>
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                  <CardHeader>
                    <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors w-fit">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="mt-4">{card.title}</CardTitle>
                    <CardDescription className="text-xs">
                      {card.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Management Section */}
      {managementCards.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Management Tools</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {managementCards.map((card) => {
              const Icon = card.icon
              return (
                <Link key={card.href} href={card.href}>
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group border-orange-200 dark:border-orange-900">
                    <CardHeader>
                      <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/30 transition-colors w-fit">
                        <Icon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <CardTitle className="mt-4">{card.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {card.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Admin Only Section */}
      {adminOnlyCards.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Administrator Tools</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {adminOnlyCards.map((card) => {
              const Icon = card.icon
              return (
                <Link key={card.href} href={card.href}>
                  <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group border-orange-200 dark:border-orange-900">
                    <CardHeader>
                      <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/20 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/30 transition-colors w-fit">
                        <Icon className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                      </div>
                      <CardTitle className="mt-4">{card.title}</CardTitle>
                      <CardDescription className="text-xs">
                        {card.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
