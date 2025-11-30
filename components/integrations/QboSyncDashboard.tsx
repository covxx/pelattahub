"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Link2, 
  Users, 
  Package, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  RefreshCw 
} from "lucide-react"
import { importQboCustomers, importQboItems } from "@/app/actions/qbo-sync"
import { useToast } from "@/hooks/useToast"
import { ToastContainer } from "@/components/ui/toast"

interface QboSyncDashboardProps {
  isConnected: boolean
}

export function QboSyncDashboard({ isConnected }: QboSyncDashboardProps) {
  const [isImportingCustomers, startImportCustomers] = useTransition()
  const [isImportingItems, startImportItems] = useTransition()
  const [lastSyncResult, setLastSyncResult] = useState<{
    type: "customers" | "items"
    result: any
  } | null>(null)
  const { toast, toasts, removeToast } = useToast()

  const handleConnect = () => {
    // TODO: Implement OAuth flow
    // This will redirect to QuickBooks OAuth consent page
    toast("OAuth flow not yet implemented", "info")
  }

  const handleImportCustomers = () => {
    startImportCustomers(async () => {
      try {
        const result = await importQboCustomers()
        setLastSyncResult({ type: "customers", result })

        if (result.success) {
          toast(
            `Imported ${result.imported} new and updated ${result.updated} customers`,
            "success"
          )
        } else {
          toast(result.error || "Failed to import customers", "error")
        }
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "An error occurred",
          "error"
        )
      }
    })
  }

  const handleImportItems = () => {
    startImportItems(async () => {
      try {
        const result = await importQboItems()
        setLastSyncResult({ type: "items", result })

        if (result.success) {
          toast(
            `Imported ${result.imported} new and updated ${result.updated} products`,
            "success"
          )
          if (result.errors && result.errors.length > 0) {
            toast(
              `${result.errors.length} errors occurred. Check console for details.`,
              "info"
            )
            console.error("Import errors:", result.errors)
          }
        } else {
          toast(result.error || "Failed to import items", "error")
        }
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "An error occurred",
          "error"
        )
      }
    })
  }

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2">
        {/* Connection Status */}
        <Card>
          <CardHeader>
            <CardTitle>Connection Status</CardTitle>
            <CardDescription>
              Connect your QuickBooks Online account to enable syncing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium">Connected</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-red-600" />
                    <span className="font-medium">Not Connected</span>
                  </>
                )}
              </div>
              <Badge variant={isConnected ? "default" : "destructive"}>
                {isConnected ? "Active" : "Inactive"}
              </Badge>
            </div>

            <Button
              onClick={handleConnect}
              className="w-full"
              variant={isConnected ? "outline" : "default"}
            >
              <Link2 className="h-4 w-4 mr-2" />
              {isConnected ? "Reconnect to QuickBooks" : "Connect to QuickBooks"}
            </Button>
          </CardContent>
        </Card>

        {/* Sync Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Sync Actions</CardTitle>
            <CardDescription>
              Import data from QuickBooks Online into WMS
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <Button
                onClick={handleImportCustomers}
                disabled={!isConnected || isImportingCustomers}
                className="w-full justify-start"
                variant="outline"
              >
                {isImportingCustomers ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Users className="h-4 w-4 mr-2" />
                )}
                Import Customers
              </Button>

              <Button
                onClick={handleImportItems}
                disabled={!isConnected || isImportingItems}
                className="w-full justify-start"
                variant="outline"
              >
                {isImportingItems ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Package className="h-4 w-4 mr-2" />
                )}
                Import Items
              </Button>
            </div>

            {!isConnected && (
              <p className="text-sm text-muted-foreground">
                Connect to QuickBooks Online to enable syncing
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Last Sync Results */}
      {lastSyncResult && lastSyncResult.result.success && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" />
              Last Sync Results
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Type:</span>
                <span className="font-medium capitalize">{lastSyncResult.type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">New Records:</span>
                <span className="font-medium">{lastSyncResult.result.imported || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Updated Records:</span>
                <span className="font-medium">{lastSyncResult.result.updated || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Total Processed:</span>
                <span className="font-medium">{lastSyncResult.result.total || 0}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}

