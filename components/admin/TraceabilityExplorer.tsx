"use client"

import { useState, useTransition } from "react"
import { format, differenceInDays } from "date-fns"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Search, Package, Truck, Calendar, User, AlertCircle, ArrowRight, ArrowLeft, Link2, Printer, FileText } from "lucide-react"
import { searchTraceability, getLotLifecycle } from "@/app/actions/admin/audit"

export function TraceabilityExplorer() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<any>(null)
  const [selectedLot, setSelectedLot] = useState<any>(null)
  const [lotLifecycle, setLotLifecycle] = useState<any>(null)
  const [isPending, startTransition] = useTransition()
  const [sheetOpen, setSheetOpen] = useState(false)

  const handleSearch = () => {
    if (!query.trim()) return

    startTransition(async () => {
      const data = await searchTraceability(query)
      setResults(data)
    })
  }

  const handleViewLot = async (lotId: string) => {
    startTransition(async () => {
      const data = await getLotLifecycle(lotId)
      setLotLifecycle(data)
      setSheetOpen(true)
    })
  }

  const handlePrintReport = () => {
    if (!lotLifecycle) return

    // Create a printable report window
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      alert("Please allow popups to print the report")
      return
    }

    const lot = lotLifecycle.lot
    const reportHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Lot History Report - ${lot.lot_number}</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      padding: 20px;
      color: #333;
    }
    .header {
      border-bottom: 3px solid #333;
      padding-bottom: 10px;
      margin-bottom: 20px;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
    }
    .section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .section-title {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 10px;
      border-bottom: 2px solid #666;
      padding-bottom: 5px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 15px;
    }
    .info-item {
      padding: 5px 0;
    }
    .info-label {
      font-weight: bold;
      color: #666;
      font-size: 12px;
    }
    .info-value {
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: left;
      font-size: 12px;
    }
    th {
      background-color: #f5f5f5;
      font-weight: bold;
    }
    .status-badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: bold;
    }
    .status-shipped { background-color: #d4edda; color: #155724; }
    .status-ready { background-color: #e2d5f7; color: #5a2d91; }
    .status-other { background-color: #e9ecef; color: #495057; }
    @media print {
      body { padding: 10px; }
      .section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Lot History Report</h1>
    <p>Generated: ${format(new Date(), "MMM dd, yyyy 'at' HH:mm:ss")}</p>
  </div>

  <!-- Lot Information -->
  <div class="section">
    <div class="section-title">Lot Information</div>
    <div class="info-grid">
      <div class="info-item">
        <div class="info-label">Lot Number</div>
        <div class="info-value">${lot.lot_number}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Product</div>
        <div class="info-value">${lot.product.name}</div>
      </div>
      <div class="info-item">
        <div class="info-label">SKU</div>
        <div class="info-value">${lot.product.sku}</div>
      </div>
      <div class="info-item">
        <div class="info-label">GTIN</div>
        <div class="info-value">${lot.product.gtin || "N/A"}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Original Quantity</div>
        <div class="info-value">${lot.original_quantity} ${lot.product.unit_type}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Current Quantity</div>
        <div class="info-value">${lot.quantity_current} ${lot.product.unit_type}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Received Date</div>
        <div class="info-value">${format(new Date(lot.received_date), "MMM dd, yyyy")}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Expiry Date</div>
        <div class="info-value">${format(new Date(lot.expiry_date), "MMM dd, yyyy")}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Status</div>
        <div class="info-value">${lot.status}</div>
      </div>
      ${lot.receivingEvent ? `
      <div class="info-item">
        <div class="info-label">Vendor</div>
        <div class="info-value">${lot.receivingEvent.vendor.name} (${lot.receivingEvent.vendor.code})</div>
      </div>
      ` : ""}
    </div>
  </div>

  ${lotLifecycle.outboundHistory && lotLifecycle.outboundHistory.length > 0 ? `
  <!-- Outbound Shipping History -->
  <div class="section">
    <div class="section-title">Outbound Shipping History</div>
    <table>
      <thead>
        <tr>
          <th>Order #</th>
          <th>Customer</th>
          <th>PO #</th>
          <th>Product</th>
          <th>Quantity</th>
          <th>Picked Date</th>
          <th>Picked By</th>
          <th>Status</th>
          <th>Delivery Date</th>
        </tr>
      </thead>
      <tbody>
        ${lotLifecycle.outboundHistory.map((pick: any) => {
          const order = pick.order_item.order
          return `
          <tr>
            <td>${order.order_number || order.id.slice(0, 8).toUpperCase()}</td>
            <td>${order.customer.name}</td>
            <td>${order.po_number || "N/A"}</td>
            <td>${pick.order_item?.product?.name}</td>
            <td>${pick.quantity_picked} ${pick.order_item?.product?.unit_type}</td>
            <td>${format(new Date(pick.picked_at), "MMM dd, yyyy HH:mm")}</td>
            <td>${pick.picked_by_user?.name || "Unknown"}</td>
            <td><span class="status-badge ${order.status === "SHIPPED" ? "status-shipped" : order.status === "READY_TO_SHIP" ? "status-ready" : "status-other"}">${order.status}</span></td>
            <td>${order.delivery_date ? format(new Date(order.delivery_date), "MMM dd, yyyy") : "N/A"}</td>
          </tr>
          `
        }).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

  <!-- Audit Trail -->
  <div class="section">
    <div class="section-title">Audit Trail</div>
    ${lotLifecycle.auditTrail.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th>Date/Time</th>
          <th>Action</th>
          <th>User</th>
          <th>Role</th>
          <th>Description</th>
        </tr>
      </thead>
      <tbody>
        ${lotLifecycle.auditTrail.map((log: any) => `
        <tr>
          <td>${format(new Date(log.createdAt), "MMM dd, yyyy HH:mm:ss")}</td>
          <td>${log.action}</td>
          <td>${log.user.name || log.user.email}</td>
          <td>${log.user.role}</td>
          <td>${log.details?.summary || "No description"}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>
    ` : "<p>No audit history available</p>"}
  </div>

  ${lotLifecycle.parentProductionRun ? `
  <!-- Source Ingredient -->
  <div class="section">
    <div class="section-title">Source Ingredient</div>
    <p>This lot was produced from Lot #${lotLifecycle.lot.parentLot.lot_number}</p>
    <p>Production Date: ${format(new Date(lotLifecycle.parentProductionRun.created_at), "MMM dd, yyyy 'at' HH:mm")}</p>
    ${lotLifecycle.parentProductionRun.user ? `<p>Produced by: ${lotLifecycle.parentProductionRun.user.name}</p>` : ""}
  </div>
  ` : ""}

  ${lotLifecycle.childProductionRuns && lotLifecycle.childProductionRuns.length > 0 ? `
  <!-- Downstream Products -->
  <div class="section">
    <div class="section-title">Downstream Products</div>
    <table>
      <thead>
        <tr>
          <th>Destination Lot</th>
          <th>Product</th>
          <th>Quantity Consumed</th>
          <th>Quantity Produced</th>
          <th>Production Date</th>
          <th>Produced By</th>
        </tr>
      </thead>
      <tbody>
        ${lotLifecycle.childProductionRuns.map((run: any) => `
        <tr>
          <td>${run.destinationLot.lot_number}</td>
          <td>${run.destinationLot.product.name}</td>
          <td>${run.quantity_consumed}</td>
          <td>${run.quantity_produced}</td>
          <td>${format(new Date(run.created_at), "MMM dd, yyyy HH:mm")}</td>
          <td>${run.user?.name || "Unknown"}</td>
        </tr>
        `).join("")}
      </tbody>
    </table>
  </div>
  ` : ""}

</body>
</html>
    `

    printWindow.document.write(reportHtml)
    printWindow.document.close()
    
    // Wait for content to load, then print
    setTimeout(() => {
      printWindow.print()
    }, 250)
  }

  return (
    <div className="space-y-6">
      {/* Search Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Search</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Enter Order Number, PO Number, Lot Number, Vendor Name, or Status (e.g., 'ready to ship', 'shipped')..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="text-lg h-12"
              />
            </div>
            <Button onClick={handleSearch} disabled={isPending} size="lg">
              <Search className="h-4 w-4 mr-2" />
              {isPending ? "Searching..." : "Search"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Search by order number, PO number, lot number, vendor name, vendor code, or order status (e.g., "ready to ship", "shipped")
          </p>
        </CardContent>
      </Card>

      {/* Results */}
      {results && (
        <div className="space-y-6">
          {/* Receiving Events Timeline */}
          {results.events.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Receiving Events</h3>
              {results.events.map((event: any) => (
                <Card key={event.id}>
                  <CardHeader className="bg-muted/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {event.vendor.name}
                        </CardTitle>
                        <div className="text-sm text-muted-foreground space-x-2 mt-1">
                          <span>Receipt #: {event.receipt_number || event.id.slice(0, 8).toUpperCase()}</span>
                          <span>•</span>
                          <span>{format(new Date(event.received_date), "MM/dd/yyyy")}</span>
                          <span>•</span>
                          <span>{event.lots.length} item(s)</span>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          event.status === "OPEN"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {event.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {event.lots.map((lot: any) => (
                        <div
                          key={lot.id}
                          className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => handleViewLot(lot.id)}
                        >
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <div className="font-semibold">{lot.product.name}</div>
                              <div className="text-sm text-muted-foreground space-x-2">
                                <span className="font-mono">{lot.lot_number}</span>
                                <span>•</span>
                                <span>SKU: {lot.product.sku}</span>
                              </div>
                              <div className="text-sm space-y-1 mt-2">
                                <div className="flex items-center gap-2">
                                  <User className="h-3 w-3" />
                                  <span>Received by {event.user.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3" />
                                  <span>{format(new Date(lot.received_date), "MM/dd/yyyy")}</span>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Quantity</div>
                              <div className="text-2xl font-bold">
                                {lot.quantity_current}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                of {lot.original_quantity} {lot.product.unit_type}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Direct Lot Matches */}
          {results.lots.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Lot Matches</h3>
              <div className="grid gap-3">
                {results.lots.map((lot: any) => (
                  <Card
                    key={lot.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleViewLot(lot.id)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-2">
                          <div className="font-semibold text-lg">{lot.product.name}</div>
                          <div className="text-sm font-mono text-muted-foreground">
                            {lot.lot_number}
                          </div>
                          {lot.receivingEvent && (
                            <div className="text-sm text-muted-foreground flex items-center gap-2">
                              <Truck className="h-3 w-3" />
                              {lot.receivingEvent.vendor.name}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">{lot.quantity_current}</div>
                          <div className="text-xs text-muted-foreground">
                            of {lot.original_quantity} {lot.product.unit_type}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Orders */}
          {results.orders && results.orders.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Orders</h3>
              {results.orders.map((order: any) => (
                <Card key={order.id}>
                  <CardHeader className="bg-muted/50">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">
                          {order.customer.name}
                        </CardTitle>
                        <div className="text-sm text-muted-foreground space-x-2 mt-1">
                          {order.order_number && (
                            <>
                              <span>Order #: {order.order_number}</span>
                              <span>•</span>
                            </>
                          )}
                          {order.po_number && (
                            <>
                              <span>PO #: {order.po_number}</span>
                              <span>•</span>
                            </>
                          )}
                          <span>{format(new Date(order.delivery_date), "MM/dd/yyyy")}</span>
                          <span>•</span>
                          <span>{order.items.length} item(s)</span>
                        </div>
                      </div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          order.status === "SHIPPED"
                            ? "bg-green-100 text-green-800"
                            : order.status === "READY_TO_SHIP"
                            ? "bg-purple-100 text-purple-800"
                            : order.status === "PICKING" || order.status === "PARTIAL_PICK"
                            ? "bg-yellow-100 text-yellow-800"
                            : order.status === "CONFIRMED"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {order.status}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <div className="space-y-3">
                      {order.items.map((item: any) => {
                        const totalPicked = item.picks.reduce(
                          (sum: number, pick: any) => sum + pick.quantity_picked,
                          0
                        )
                        return (
                          <div
                            key={item.id}
                            className="border rounded-lg p-3"
                          >
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <div className="font-semibold">{item.product.name}</div>
                                <div className="text-sm text-muted-foreground space-x-2">
                                  <span>SKU: {item.product.sku}</span>
                                  <span>•</span>
                                  <span>
                                    {totalPicked} / {item.quantity_ordered} {item.product.unit_type} picked
                                  </span>
                                </div>
                                {item.picks.length > 0 && (
                                  <div className="text-xs text-muted-foreground mt-2">
                                    <div className="font-medium mb-1">Picked from lots:</div>
                                    <div className="space-y-1">
                                      {item.picks.map((pick: any) => (
                                        <div key={pick.id} className="flex items-center gap-2">
                                          <span className="font-mono">{pick.inventory_lot.lot_number}</span>
                                          <span>•</span>
                                          <span>{pick.quantity_picked} {item.product.unit_type}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-muted-foreground">Ordered</div>
                                <div className="text-2xl font-bold">
                                  {item.quantity_ordered}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {item.product.unit_type}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* No Results */}
          {results.events.length === 0 && results.lots.length === 0 && (!results.orders || results.orders.length === 0) && (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No results found for "{query}"</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Lot Detail Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="sm:max-w-2xl overflow-y-auto">
          {lotLifecycle && lotLifecycle.lot && (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle>Lot Lifecycle</SheetTitle>
                    <SheetDescription>
                      Complete audit trail for {lotLifecycle.lot.lot_number}
                    </SheetDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePrintReport()}
                    className="ml-4"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Print Report
                  </Button>
                </div>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Lot Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Lot Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Product</div>
                      <div className="font-semibold">{lotLifecycle.lot.product.name}</div>
                      {lotLifecycle.lot.product.variety && (
                        <div className="text-sm text-muted-foreground italic">
                          {lotLifecycle.lot.product.variety}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-sm text-muted-foreground">SKU</div>
                        <div className="font-mono">{lotLifecycle.lot.product.sku}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">GTIN</div>
                        <div className="font-mono text-sm">{lotLifecycle.lot.product.gtin}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Original Quantity</div>
                        <div className="text-lg font-bold">
                          {lotLifecycle.lot.original_quantity} {lotLifecycle.lot.product.unit_type}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Current Quantity</div>
                        <div className="text-lg font-bold">
                          {lotLifecycle.lot.quantity_current} {lotLifecycle.lot.product.unit_type}
                        </div>
                      </div>
                    </div>

                    {lotLifecycle.lot.receivingEvent && (
                      <div>
                        <div className="text-sm text-muted-foreground">Source</div>
                        <div className="flex items-center gap-2">
                          <Truck className="h-4 w-4" />
                          <span className="font-semibold">
                            {lotLifecycle.lot.receivingEvent.vendor.name}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            ({lotLifecycle.lot.receivingEvent.vendor.code})
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          Received by {lotLifecycle.lot.receivingEvent.user.name} on{" "}
                          {format(new Date(lotLifecycle.lot.received_date), "MM/dd/yyyy")}
                        </div>
                      </div>
                    )}

                    <div>
                      <div className="text-sm text-muted-foreground">Expiry</div>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const daysRemaining = differenceInDays(
                            new Date(lotLifecycle.lot.expiry_date),
                            new Date()
                          )
                          const isExpired = daysRemaining < 0
                          const isExpiringSoon = daysRemaining <= 3 && daysRemaining >= 0

                          return (
                            <>
                              {isExpired && (
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              )}
                              {isExpiringSoon && (
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                              )}
                              <span className={isExpired ? "text-red-500 font-semibold" : ""}>
                                {format(new Date(lotLifecycle.lot.expiry_date), "MM/dd/yyyy")}
                              </span>
                              <span className="text-sm text-muted-foreground">
                                ({Math.abs(daysRemaining)} day{Math.abs(daysRemaining) !== 1 ? "s" : ""}{" "}
                                {isExpired ? "expired" : "remaining"})
                              </span>
                            </>
                          )
                        })()}
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-muted-foreground">Status</div>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          lotLifecycle.lot.status === "AVAILABLE"
                            ? "bg-green-100 text-green-800"
                            : lotLifecycle.lot.status === "EXPIRED"
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {lotLifecycle.lot.status}
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Source Ingredient - If this lot was produced from another lot */}
                {lotLifecycle.lot.parentLot && (
                  <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ArrowLeft className="h-5 w-5 text-blue-600" />
                        Source Ingredient
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-blue-200">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="font-semibold text-base">
                                Produced from Lot #{lotLifecycle.lot.parentLot.lot_number}
                              </div>
                              <div className="text-sm text-muted-foreground">
                                {lotLifecycle.lot.parentLot.product.name}
                              </div>
                              {lotLifecycle.parentProductionRun && (
                                <>
                                  <div className="text-xs text-muted-foreground mt-2">
                                    <Calendar className="h-3 w-3 inline mr-1" />
                                    {format(
                                      new Date(lotLifecycle.parentProductionRun.created_at),
                                      "MMM dd, yyyy 'at' HH:mm"
                                    )}
                                  </div>
                                  {lotLifecycle.parentProductionRun.user && (
                                    <div className="text-xs text-muted-foreground">
                                      <User className="h-3 w-3 inline mr-1" />
                                      By {lotLifecycle.parentProductionRun.user.name}
                                    </div>
                                  )}
                                </>
                              )}
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSheetOpen(false)
                                setTimeout(() => {
                                  handleViewLot(lotLifecycle.lot.parentLot!.id)
                                }, 100)
                              }}
                              className="ml-4"
                            >
                              <Link2 className="h-4 w-4 mr-1" />
                              View Parent Lot
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Downstream Products - If this lot was consumed to produce other lots */}
                {lotLifecycle.childProductionRuns && lotLifecycle.childProductionRuns.length > 0 && (
                  <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/20">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <ArrowRight className="h-5 w-5 text-green-600" />
                        Downstream Products
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {lotLifecycle.childProductionRuns.map((productionRun: any) => (
                          <div
                            key={productionRun.id}
                            className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-green-200"
                          >
                            <div className="flex items-start justify-between">
                              <div className="space-y-1 flex-1">
                                <div className="font-semibold text-base">
                                  Lot #{productionRun.destinationLot.lot_number}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {productionRun.destinationLot.product.name}
                                </div>
                                <div className="text-xs text-muted-foreground mt-2 space-y-1">
                                  <div>
                                    <Calendar className="h-3 w-3 inline mr-1" />
                                    {format(
                                      new Date(productionRun.created_at),
                                      "MMM dd, yyyy 'at' HH:mm"
                                    )}
                                  </div>
                                  {productionRun.user && (
                                    <div>
                                      <User className="h-3 w-3 inline mr-1" />
                                      By {productionRun.user.name}
                                    </div>
                                  )}
                                  <div className="text-xs font-medium mt-1">
                                    {productionRun.quantity_consumed} → {productionRun.quantity_produced} produced
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setSheetOpen(false)
                                  setTimeout(() => {
                                    handleViewLot(productionRun.destinationLot.id)
                                  }, 100)
                                }}
                                className="ml-4"
                              >
                                <Link2 className="h-4 w-4 mr-1" />
                                View Lot
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Audit Trail */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Audit Trail</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {lotLifecycle.auditTrail.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No audit history available
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {lotLifecycle.auditTrail.map((log: any) => (
                          <div
                            key={log.id}
                            className="border-l-2 border-muted pl-4 py-2"
                          >
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                      log.action === "RECEIVE" || log.action === "CREATE"
                                        ? "bg-green-100 text-green-800"
                                        : log.action === "UPDATE"
                                        ? "bg-blue-100 text-blue-800"
                                        : log.action === "DELETE"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {log.action}
                                  </span>
                                  <span className="text-sm font-medium">
                                    {log.user.name || log.user.email}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ({log.user.role})
                                  </span>
                                </div>
                                <div className="text-sm">
                                  {log.details?.summary || "No description"}
                                </div>
                                {log.details?.changes && (
                                  <div className="text-xs bg-muted p-2 rounded mt-1">
                                    <pre className="whitespace-pre-wrap">
                                      {JSON.stringify(log.details.changes, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground text-right">
                                {format(new Date(log.createdAt), "MM/dd/yyyy")}
                                <br />
                                {format(new Date(log.createdAt), "HH:mm:ss")}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Outbound Shipping History */}
                {lotLifecycle.outboundHistory && lotLifecycle.outboundHistory.length > 0 && (
                  <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
                    <CardHeader>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Truck className="h-5 w-5 text-purple-600" />
                        Outbound Shipping History
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {lotLifecycle.outboundHistory.map((pick: any) => {
                          const order = pick.order_item?.order
                          return (
                            <div
                              key={pick.id}
                              className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-purple-200"
                            >
                              <div className="flex items-start justify-between">
                                <div className="space-y-1 flex-1">
                                  <div className="font-semibold text-base">
                                    Order #{order.order_number || order.id.slice(0, 8).toUpperCase()}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Customer: {order.customer.name}
                                    {order.customer.code && ` (${order.customer.code})`}
                                  </div>
                                  {order.po_number && (
                                    <div className="text-sm text-muted-foreground">
                                      PO #: {order.po_number}
                                    </div>
                                  )}
                                  <div className="text-xs text-muted-foreground mt-2 space-y-1">
                                    <div>
                                      <Calendar className="h-3 w-3 inline mr-1" />
                                      Picked: {format(new Date(pick.picked_at), "MMM dd, yyyy 'at' HH:mm")}
                                    </div>
                                    {pick.picked_by_user && (
                                      <div>
                                        <User className="h-3 w-3 inline mr-1" />
                                        By {pick.picked_by_user.name}
                                      </div>
                                    )}
                                    <div className="text-xs font-medium mt-1">
                                      Quantity: {pick.quantity_picked} {pick.order_item?.product?.unit_type}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      Product: {pick.order_item?.product?.name} (SKU: {pick.order_item?.product?.sku})
                                    </div>
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      order.status === "SHIPPED"
                                        ? "bg-green-100 text-green-800"
                                        : order.status === "READY_TO_SHIP"
                                        ? "bg-purple-100 text-purple-800"
                                        : "bg-gray-100 text-gray-800"
                                    }`}
                                  >
                                    {order.status}
                                  </span>
                                  {order.delivery_date && (
                                    <div className="text-xs text-muted-foreground mt-1">
                                      Delivery: {format(new Date(order.delivery_date), "MM/dd/yyyy")}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* No Outbound History */}
                {(!lotLifecycle.outboundHistory || lotLifecycle.outboundHistory.length === 0) && (
                  <Card className="border-dashed">
                    <CardContent className="pt-6 text-center text-muted-foreground">
                      <Truck className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No outbound shipping history</p>
                      <p className="text-xs mt-1">
                        This lot has not been picked for any orders yet
                      </p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}


