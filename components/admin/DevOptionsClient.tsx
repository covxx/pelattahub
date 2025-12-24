"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Trash2,
  Package,
  ShoppingCart,
  Building2,
  Box,
  Truck,
  Receipt,
  Factory,
  FileText,
  Settings,
  Link2,
  Database,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react"
import {
  clearInventory,
  clearOrders,
  clearCustomers,
  clearProducts,
  clearVendors,
  clearReceivingEvents,
  clearProductionRuns,
  clearAuditLogs,
  clearSystemSettings,
  clearIntegrationSettings,
  clearAllData,
  getDevStats,
} from "@/app/actions/dev-options"

interface DevOptionsClientProps {
  initialStats: {
    inventoryCount: number
    orderCount: number
    customerCount: number
    productCount: number
    vendorCount: number
    receivingCount: number
    productionCount: number
    auditCount: number
  }
}

export function DevOptionsClient({ initialStats }: DevOptionsClientProps) {
  const [stats, setStats] = useState(initialStats)
  const [isPending, startTransition] = useTransition()
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

  const refreshStats = async () => {
    try {
      const newStats = await getDevStats()
      setStats(newStats)
    } catch (error) {
      console.error("Failed to refresh stats:", error)
    }
  }

  const handleClear = async (
    action: () => Promise<{ success: boolean; count?: number }>,
    name: string
  ) => {
    setMessage(null)
    startTransition(async () => {
      try {
        const result = await action()
        setMessage({
          type: "success",
          text: `Successfully cleared ${name}${result.count !== undefined ? ` (${result.count} records)` : ""}`,
        })
        await refreshStats()
      } catch (error) {
        setMessage({
          type: "error",
          text: `Failed to clear ${name}: ${error instanceof Error ? error.message : "Unknown error"}`,
        })
      }
    })
  }

  const clearActions = [
    {
      name: "Inventory Lots",
      description: "Delete all inventory lots",
      icon: Package,
      count: stats.inventoryCount,
      action: () => clearInventory(),
      color: "destructive",
    },
    {
      name: "Orders",
      description: "Delete all orders and related data (picks, allocations, items)",
      icon: ShoppingCart,
      count: stats.orderCount,
      action: () => clearOrders(),
      color: "destructive",
    },
    {
      name: "Customers",
      description: "Delete all customers",
      icon: Building2,
      count: stats.customerCount,
      action: () => clearCustomers(),
      color: "destructive",
    },
    {
      name: "Products",
      description: "Delete all products",
      icon: Box,
      count: stats.productCount,
      action: () => clearProducts(),
      color: "destructive",
    },
    {
      name: "Vendors",
      description: "Delete all vendors",
      icon: Truck,
      count: stats.vendorCount,
      action: () => clearVendors(),
      color: "destructive",
    },
    {
      name: "Receiving Events",
      description: "Delete all receiving events",
      icon: Receipt,
      count: stats.receivingCount,
      action: () => clearReceivingEvents(),
      color: "destructive",
    },
    {
      name: "Production Runs",
      description: "Delete all production runs",
      icon: Factory,
      count: stats.productionCount,
      action: () => clearProductionRuns(),
      color: "destructive",
    },
    {
      name: "Audit Logs",
      description: "Delete all audit logs",
      icon: FileText,
      count: stats.auditCount,
      action: () => clearAuditLogs(),
      color: "destructive",
    },
    {
      name: "System Settings",
      description: "Delete all system settings",
      icon: Settings,
      count: 0,
      action: () => clearSystemSettings(),
      color: "destructive",
    },
    {
      name: "Integration Settings",
      description: "Delete all integration settings (including QBO tokens)",
      icon: Link2,
      count: 0,
      action: () => clearIntegrationSettings(),
      color: "destructive",
    },
  ]

  return (
    <div className="space-y-6">
      {/* Current Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Current Database Statistics</CardTitle>
          <CardDescription>Current record counts in the database</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.inventoryCount}</div>
                <div className="text-xs text-muted-foreground">Inventory Lots</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.orderCount}</div>
                <div className="text-xs text-muted-foreground">Orders</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.customerCount}</div>
                <div className="text-xs text-muted-foreground">Customers</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Box className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.productCount}</div>
                <div className="text-xs text-muted-foreground">Products</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.vendorCount}</div>
                <div className="text-xs text-muted-foreground">Vendors</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.receivingCount}</div>
                <div className="text-xs text-muted-foreground">Receiving Events</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.productionCount}</div>
                <div className="text-xs text-muted-foreground">Production Runs</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div>
                <div className="text-2xl font-bold">{stats.auditCount}</div>
                <div className="text-xs text-muted-foreground">Audit Logs</div>
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            onClick={refreshStats}
            disabled={isPending}
          >
            Refresh Stats
          </Button>
        </CardContent>
      </Card>

      {/* Message Alert */}
      {message && (
        <Alert variant={message.type === "error" ? "destructive" : "default"}>
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          <AlertTitle>{message.type === "success" ? "Success" : "Error"}</AlertTitle>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      {/* Clear Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        {clearActions.map((item) => (
          <Card key={item.name} className="border-destructive/20">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <item.icon className="h-5 w-5 text-destructive" />
                  <CardTitle className="text-lg">{item.name}</CardTitle>
                </div>
                {item.count > 0 && (
                  <span className="text-sm font-medium text-muted-foreground">
                    {item.count} records
                  </span>
                )}
              </div>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isPending || item.count === 0}>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Clear {item.name}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete all {item.name.toLowerCase()}. This action
                      cannot be undone.
                      {item.count > 0 && (
                        <span className="block mt-2 font-semibold">
                          {item.count} record{item.count !== 1 ? "s" : ""} will be deleted.
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => handleClear(item.action, item.name)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Clearing...
                        </>
                      ) : (
                        "Yes, delete everything"
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Clear All Data */}
      <Card className="border-destructive">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database className="h-5 w-5 text-destructive" />
            <CardTitle className="text-lg text-destructive">Clear All Data</CardTitle>
          </div>
          <CardDescription>
            Delete all data from the database (except users and auth tables). This is the most
            destructive operation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="lg" disabled={isPending}>
                <Database className="h-4 w-4 mr-2" />
                Clear Entire Database
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">
                  ⚠️ DANGER: Clear Entire Database
                </AlertDialogTitle>
                <AlertDialogDescription className="space-y-2">
                  <p>
                    This will permanently delete ALL data from the database except:
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>Users and authentication data</li>
                    <li>NextAuth sessions and accounts</li>
                  </ul>
                  <p className="mt-2 font-semibold text-destructive">
                    This action CANNOT be undone. All inventory, orders, customers, products,
                    vendors, and all other data will be permanently lost.
                  </p>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => handleClear(clearAllData, "all data")}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Clearing...
                    </>
                  ) : (
                    "Yes, delete everything"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      {/* Additional Test Utilities */}
      <Card>
        <CardHeader>
          <CardTitle>Test Utilities</CardTitle>
          <CardDescription>Additional development and testing tools</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p>Additional test utilities can be added here:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-4">
              <li>Generate test data</li>
              <li>Reset sequences/counters</li>
              <li>Database health checks</li>
              <li>Performance testing tools</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}


