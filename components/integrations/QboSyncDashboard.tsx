"use client"

import { useState, useTransition, useEffect } from "react"
import { useSearchParams } from "next/navigation"
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
  RefreshCw,
  Building2,
  FileText,
  Receipt,
  AlertCircle
} from "lucide-react"
import { 
  importQboCustomers, 
  importQboItems, 
  importQboVendors,
  importQboInvoices,
  getQboStatus,
  getQboAuthUrl,
  getReceivingEventsForQboSync
} from "@/app/actions/qbo-sync"
import { useToast } from "@/hooks/useToast"
import { ToastContainer } from "@/components/ui/toast"
import { format } from "date-fns"

interface QboSyncDashboardProps {
  isConnected: boolean
}

export function QboSyncDashboard({ isConnected: initialConnected }: QboSyncDashboardProps) {
  const searchParams = useSearchParams()
  const [isImportingCustomers, startImportCustomers] = useTransition()
  const [isImportingItems, startImportItems] = useTransition()
  const [isImportingVendors, startImportVendors] = useTransition()
  const [isImportingInvoices, startImportInvoices] = useTransition()
  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean
    companyName?: string
    expiresAt?: Date
  }>({ connected: initialConnected })
  const [lastSyncResult, setLastSyncResult] = useState<{
    type: "customers" | "items" | "vendors" | "invoices"
    result: any
    timestamp: Date
  } | null>(null)
  const [billsSyncStatus, setBillsSyncStatus] = useState<{
    open: Array<{
      id: string
      receipt_number: number
      received_date: Date
      vendor: string
      vendor_has_qbo_id: boolean
      lots_count: number
      all_products_have_qbo_id: boolean
      status: "OPEN"
    }>
    finalizedWithoutQbo: Array<{
      id: string
      receipt_number: number
      received_date: Date
      finalized_at: Date | null
      vendor: string
      vendor_has_qbo_id: boolean
      lots_count: number
      all_products_have_qbo_id: boolean
      status: "FINALIZED_NO_SYNC"
    }>
    synced: Array<{
      id: string
      receipt_number: number
      received_date: Date
      finalized_at: Date | null
      vendor: string
      qbo_id: string | null
      lots_count: number
      status: "SYNCED"
    }>
  } | null>(null)
  const [isLoadingBills, setIsLoadingBills] = useState(false)
  const { toast, toasts, removeToast } = useToast()

  // Fetch connection status and bills sync status on mount and when query params change
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const status = await getQboStatus()
        if (status.success && "connected" in status) {
          setConnectionStatus({
            connected: status.connected || false,
            companyName: "companyName" in status ? status.companyName : undefined,
            expiresAt: "expiresAt" in status && status.expiresAt
              ? (status.expiresAt instanceof Date ? status.expiresAt : new Date(status.expiresAt))
              : undefined,
          })
        }
      } catch (error) {
        console.error("Error fetching QBO status:", error)
      }
    }
    
    const fetchBillsStatus = async () => {
      setIsLoadingBills(true)
      try {
        const result = await getReceivingEventsForQboSync()
        if (result.success) {
          setBillsSyncStatus({
            open: result.open,
            finalizedWithoutQbo: result.finalizedWithoutQbo,
            synced: result.synced,
          })
        } else {
          // On error, set empty arrays
          setBillsSyncStatus({
            open: result.open || [],
            finalizedWithoutQbo: result.finalizedWithoutQbo || [],
            synced: result.synced || [],
          })
        }
      } catch (error) {
        console.error("Error fetching bills sync status:", error)
        // Set empty state on error
        setBillsSyncStatus({
          open: [],
          finalizedWithoutQbo: [],
          synced: [],
        })
      } finally {
        setIsLoadingBills(false)
      }
    }
    
    fetchStatus()
    fetchBillsStatus()
  }, [searchParams])

  // Handle success/error query params from OAuth callback
  useEffect(() => {
    const success = searchParams.get("success")
    const error = searchParams.get("error")
    
    if (success === "true") {
      toast("Successfully connected to QuickBooks Online!", "success")
      // Refetch status to show updated connection
      getQboStatus().then((status) => {
        if (status.success && "connected" in status) {
          setConnectionStatus({
            connected: status.connected || false,
            companyName: "companyName" in status ? status.companyName : undefined,
            expiresAt: "expiresAt" in status && status.expiresAt
              ? (status.expiresAt instanceof Date ? status.expiresAt : new Date(status.expiresAt))
              : undefined,
          })
        }
      })
      // Clean up URL
      window.history.replaceState({}, "", "/dashboard/admin/integrations/qbo")
    } else if (error) {
      toast(`Connection failed: ${decodeURIComponent(error)}`, "error")
      // Clean up URL
      window.history.replaceState({}, "", "/dashboard/admin/integrations/qbo")
    }
  }, [searchParams, toast])

  // Auto-sync invoices every minute when connected
  useEffect(() => {
    if (!connectionStatus.connected) {
      return
    }

    console.log("[QBO Auto-Sync] Starting auto-sync interval (runs every 60 seconds)")

    // Run immediately on mount, then every minute
    const runSync = async () => {
      try {
        console.log("[QBO Auto-Sync] Running scheduled sync...")
        const result = await importQboInvoices()
        
        // Always update lastSyncResult to show sync is working
        setLastSyncResult({ type: "invoices", result, timestamp: new Date() })
        
        if (result.success) {
          console.log(`[QBO Auto-Sync] Completed: ${result.imported || 0} imported, ${result.skipped || 0} skipped, ${result.total || 0} total`)
          
          // Only show toast if new invoices were imported
          if (result.imported && result.imported > 0) {
            toast(
              `Auto-sync: Imported ${result.imported} orders from QuickBooks invoices`,
              "success"
            )
          }
        } else {
          console.error(`[QBO Auto-Sync] Failed: ${result.error}`)
        }
      } catch (error) {
        console.error("[QBO Auto-Sync] Error:", error)
        // Don't show error toast for background sync to avoid spam
      }
    }

    // Run immediately
    runSync()

    // Then set up interval
    const intervalId = setInterval(runSync, 60000) // 1 minute = 60000ms

    return () => {
      console.log("[QBO Auto-Sync] Cleaning up interval")
      clearInterval(intervalId)
    }
  }, [connectionStatus.connected]) // Removed 'toast' from dependencies - it's stable

  const handleConnect = async () => {
    try {
      // Get the OAuth URL from server action
      const result = await getQboAuthUrl()
      
      if (result.success && result.authUrl) {
        // Navigate directly to QuickBooks OAuth page (client-side redirect)
        window.location.href = result.authUrl
      } else {
        toast(result.error || "Failed to generate authorization URL", "error")
      }
    } catch (error) {
      console.error("Error initiating QBO connection:", error)
      toast(
        error instanceof Error ? error.message : "Failed to connect to QuickBooks",
        "error"
      )
    }
  }

  const handleImportCustomers = () => {
    startImportCustomers(async () => {
      try {
        const result = await importQboCustomers()
        setLastSyncResult({ type: "customers", result, timestamp: new Date() })

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
        setLastSyncResult({ type: "items", result, timestamp: new Date() })

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

  const handleImportVendors = () => {
    startImportVendors(async () => {
      try {
        const result = await importQboVendors()
        setLastSyncResult({ type: "vendors", result, timestamp: new Date() })

        if (result.success) {
          toast(
            `Imported ${result.imported} new and updated ${result.updated} vendors`,
            "success"
          )
        } else {
          toast(result.error || "Failed to import vendors", "error")
        }
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "An error occurred",
          "error"
        )
      }
    })
  }

  const handleImportInvoices = () => {
    startImportInvoices(async () => {
      try {
        const result = await importQboInvoices()
        setLastSyncResult({ type: "invoices", result, timestamp: new Date() })

        if (result.success) {
          const imported = result.imported || 0
          const message = imported > 0 
            ? `Imported ${imported} orders from QuickBooks invoices`
            : `Found ${result.total || 0} invoices, ${imported} imported, ${result.skipped || 0} already exist`
          toast(message, imported > 0 ? "success" : "info")
          
          if (result.invoiceIdsFound && result.invoiceIdsFound.length > 0) {
            console.log("Invoice IDs found in QBO:", result.invoiceIdsFound)
          }
          
          if (result.skippedDetails && result.skippedDetails.length > 0) {
            console.log("Skipped invoices:", result.skippedDetails)
          }
          
          if (result.errors && result.errors.length > 0) {
            toast(
              `${result.errors.length} errors occurred. Check console for details.`,
              "info"
            )
            console.error("Import errors:", result.errors)
          }
        } else {
          toast(result.error || "Failed to import invoices", "error")
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
                {connectionStatus.connected ? (
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
              <Badge variant={connectionStatus.connected ? "default" : "destructive"}>
                {connectionStatus.connected ? "Active" : "Inactive"}
              </Badge>
            </div>

            {connectionStatus.connected && (
              <div className="space-y-2 text-sm">
                {connectionStatus.companyName && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Company:</span>
                    <span className="font-medium">{connectionStatus.companyName}</span>
                  </div>
                )}
                {connectionStatus.expiresAt && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Token Expires:</span>
                    <span className="font-medium">
                      {format(connectionStatus.expiresAt, "MMM dd, yyyy HH:mm")}
                    </span>
                  </div>
                )}
              </div>
            )}

            <Button
              onClick={handleConnect}
              className="w-full"
              variant={connectionStatus.connected ? "outline" : "default"}
            >
              <Link2 className="h-4 w-4 mr-2" />
              {connectionStatus.connected ? "Reconnect to QuickBooks" : "Connect to QuickBooks"}
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
          <CardContent className="space-y-3">
            <Button
              onClick={handleImportCustomers}
              disabled={!connectionStatus.connected || isImportingCustomers}
              className="w-full justify-start"
              variant="outline"
            >
              {isImportingCustomers ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              Sync Customers
            </Button>

            <Button
              onClick={handleImportItems}
              disabled={!connectionStatus.connected || isImportingItems}
              className="w-full justify-start"
              variant="outline"
            >
              {isImportingItems ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Package className="h-4 w-4 mr-2" />
              )}
              Sync Products
            </Button>

            <Button
              onClick={handleImportVendors}
              disabled={!connectionStatus.connected || isImportingVendors}
              className="w-full justify-start"
              variant="outline"
            >
              {isImportingVendors ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Building2 className="h-4 w-4 mr-2" />
              )}
              Sync Vendors
            </Button>

            <Button
              onClick={handleImportInvoices}
              disabled={!connectionStatus.connected || isImportingInvoices}
              className="w-full justify-start"
              variant="outline"
            >
              {isImportingInvoices ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Sync Invoices (Orders)
            </Button>

            {!connectionStatus.connected && (
              <p className="text-sm text-muted-foreground pt-2">
                Connect to QuickBooks Online to enable syncing
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bills Sync Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Bills Sync Status
              </CardTitle>
              <CardDescription>
                Receiving events and their QuickBooks bill sync status
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setIsLoadingBills(true)
                try {
                  const result = await getReceivingEventsForQboSync()
                  if (result.success) {
                    setBillsSyncStatus({
                      open: result.open,
                      finalizedWithoutQbo: result.finalizedWithoutQbo,
                      synced: result.synced,
                    })
                    toast("Bills sync status refreshed", "success")
                  } else {
                    setBillsSyncStatus({
                      open: result.open || [],
                      finalizedWithoutQbo: result.finalizedWithoutQbo || [],
                      synced: result.synced || [],
                    })
                    toast(result.error || "Failed to refresh bills status", "error")
                  }
                } catch (error) {
                  toast("Failed to refresh bills status", "error")
                  setBillsSyncStatus({
                    open: [],
                    finalizedWithoutQbo: [],
                    synced: [],
                  })
                } finally {
                  setIsLoadingBills(false)
                }
              }}
              disabled={isLoadingBills}
            >
              {isLoadingBills ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingBills ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : billsSyncStatus ? (
            <div className="space-y-6">
              {/* Open Events (Not Finalized) */}
              {billsSyncStatus.open.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <AlertCircle className="h-4 w-4 text-amber-600" />
                    <h3 className="font-semibold text-sm">Open (Not Finalized)</h3>
                    <Badge variant="outline">{billsSyncStatus.open.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {billsSyncStatus.open.slice(0, 10).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 border rounded-lg text-sm"
                      >
                        <div className="flex-1">
                          <div className="font-medium">
                            Receipt #{event.receipt_number} - {event.vendor}
                          </div>
                          <div className="text-muted-foreground text-xs mt-1">
                            {format(new Date(event.received_date), "MMM dd, yyyy")} • {event.lots_count} lot(s)
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!event.vendor_has_qbo_id && (
                            <Badge variant="destructive" className="text-xs">
                              Vendor Missing QBO ID
                            </Badge>
                          )}
                          {!event.all_products_have_qbo_id && (
                            <Badge variant="destructive" className="text-xs">
                              Products Missing QBO IDs
                            </Badge>
                          )}
                          {event.vendor_has_qbo_id && event.all_products_have_qbo_id && (
                            <Badge variant="outline" className="text-xs">
                              Ready to Finalize
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {billsSyncStatus.open.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        Showing 10 of {billsSyncStatus.open.length} open events
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Finalized Without QBO Sync */}
              {billsSyncStatus.finalizedWithoutQbo.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <h3 className="font-semibold text-sm">Finalized (Not Synced)</h3>
                    <Badge variant="destructive">{billsSyncStatus.finalizedWithoutQbo.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {billsSyncStatus.finalizedWithoutQbo.slice(0, 10).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 border rounded-lg text-sm"
                      >
                        <div className="flex-1">
                          <div className="font-medium">
                            Receipt #{event.receipt_number} - {event.vendor}
                          </div>
                          <div className="text-muted-foreground text-xs mt-1">
                            Finalized {event.finalized_at ? format(new Date(event.finalized_at), "MMM dd, yyyy") : "N/A"} • {event.lots_count} lot(s)
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!event.vendor_has_qbo_id && (
                            <Badge variant="destructive" className="text-xs">
                              Vendor Missing QBO ID
                            </Badge>
                          )}
                          {!event.all_products_have_qbo_id && (
                            <Badge variant="destructive" className="text-xs">
                              Products Missing QBO IDs
                            </Badge>
                          )}
                          {event.vendor_has_qbo_id && event.all_products_have_qbo_id && (
                            <Badge variant="outline" className="text-xs">
                              Sync Failed
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {billsSyncStatus.finalizedWithoutQbo.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        Showing 10 of {billsSyncStatus.finalizedWithoutQbo.length} unsynced events
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Successfully Synced */}
              {billsSyncStatus.synced.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <h3 className="font-semibold text-sm">Synced to QuickBooks</h3>
                    <Badge variant="default" className="bg-green-600">
                      {billsSyncStatus.synced.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {billsSyncStatus.synced.slice(0, 10).map((event) => (
                      <div
                        key={event.id}
                        className="flex items-center justify-between p-3 border rounded-lg text-sm bg-green-50 dark:bg-green-950/20"
                      >
                        <div className="flex-1">
                          <div className="font-medium">
                            Receipt #{event.receipt_number} - {event.vendor}
                          </div>
                          <div className="text-muted-foreground text-xs mt-1">
                            Synced {event.finalized_at ? format(new Date(event.finalized_at), "MMM dd, yyyy") : "N/A"} • QBO Bill: {event.qbo_id}
                          </div>
                        </div>
                        <Badge variant="default" className="bg-green-600">
                          Synced
                        </Badge>
                      </div>
                    ))}
                    {billsSyncStatus.synced.length > 10 && (
                      <p className="text-xs text-muted-foreground text-center pt-2">
                        Showing 10 of {billsSyncStatus.synced.length} synced events
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {billsSyncStatus.open.length === 0 &&
                billsSyncStatus.finalizedWithoutQbo.length === 0 &&
                billsSyncStatus.synced.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No receiving events found</p>
                  </div>
                )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Loader2 className="h-6 w-6 mx-auto mb-3 animate-spin" />
              <p>Loading bills sync status...</p>
            </div>
          )}
        </CardContent>
      </Card>

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
                <span className="text-sm text-muted-foreground">Time:</span>
                <span className="font-medium">
                  {format(lastSyncResult.timestamp, "MMM dd, yyyy HH:mm:ss")}
                </span>
              </div>
              {lastSyncResult.result.imported !== undefined && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">New Records:</span>
                  <span className="font-medium">{lastSyncResult.result.imported || 0}</span>
                </div>
              )}
              {lastSyncResult.result.updated !== undefined && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Updated Records:</span>
                  <span className="font-medium">{lastSyncResult.result.updated || 0}</span>
                </div>
              )}
              {lastSyncResult.result.total !== undefined && (
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total Processed:</span>
                  <span className="font-medium">{lastSyncResult.result.total || 0}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}
