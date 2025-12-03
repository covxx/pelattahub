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
import { Search, Package, Truck, Calendar, User, AlertCircle } from "lucide-react"
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
                          <span>Receipt #: {event.id.slice(0, 8).toUpperCase()}</span>
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
                <SheetTitle>Lot Lifecycle</SheetTitle>
                <SheetDescription>
                  Complete audit trail for {lotLifecycle.lot.lot_number}
                </SheetDescription>
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

                {/* Future Placeholder */}
                <Card className="border-dashed">
                  <CardContent className="pt-6 text-center text-muted-foreground">
                    <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Outbound shipping history coming soon</p>
                    <p className="text-xs mt-1">
                      Will show orders this lot was shipped on
                    </p>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}


