"use client"

import { useState, useTransition, useEffect } from "react"
import { format, differenceInDays } from "date-fns"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Truck, Calendar, User, AlertCircle, Package, Clock } from "lucide-react"
import { getLotLifecycleForUser } from "@/app/actions/inventory"

interface LotLifecycleSheetProps {
  lotId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function LotLifecycleSheet({
  lotId,
  open,
  onOpenChange,
}: LotLifecycleSheetProps) {
  const [lotLifecycle, setLotLifecycle] = useState<any>(null)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (open && lotId) {
      startTransition(async () => {
        try {
          const data = await getLotLifecycleForUser(lotId)
          setLotLifecycle(data)
        } catch (error) {
          console.error("Failed to load lot lifecycle:", error)
          setLotLifecycle(null)
        }
      })
    } else {
      setLotLifecycle(null)
    }
  }, [open, lotId])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl overflow-y-auto">
        {isPending ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4 animate-spin" />
              Loading lifecycle data...
            </div>
          </div>
        ) : lotLifecycle && lotLifecycle.lot ? (
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
                      <div className="font-mono text-sm">
                        {lotLifecycle.lot.product.gtin || "N/A"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-sm text-muted-foreground">Original Quantity</div>
                      <div className="text-lg font-bold">
                        {lotLifecycle.lot.original_quantity}{" "}
                        {lotLifecycle.lot.product.unit_type}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground">Current Quantity</div>
                      <div className="text-lg font-bold">
                        {lotLifecycle.lot.quantity_current}{" "}
                        {lotLifecycle.lot.product.unit_type}
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
                        Received by{" "}
                        {lotLifecycle.lot.receivingEvent.user.name ||
                          lotLifecycle.lot.receivingEvent.user.email}{" "}
                        on {format(new Date(lotLifecycle.lot.received_date), "MM/dd/yyyy")}
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
                            <span
                              className={isExpired ? "text-red-500 font-semibold" : ""}
                            >
                              {format(new Date(lotLifecycle.lot.expiry_date), "MM/dd/yyyy")}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              ({Math.abs(daysRemaining)} day
                              {Math.abs(daysRemaining) !== 1 ? "s" : ""}{" "}
                              {isExpired ? "expired" : "remaining"})
                            </span>
                          </>
                        )
                      })()}
                    </div>
                  </div>

                  <div>
                    <div className="text-sm text-muted-foreground">Status</div>
                    <Badge
                      variant={
                        lotLifecycle.lot.status === "AVAILABLE"
                          ? "default"
                          : lotLifecycle.lot.status === "EXPIRED" ||
                            lotLifecycle.lot.status === "DEPLETED"
                          ? "destructive"
                          : "secondary"
                      }
                    >
                      {lotLifecycle.lot.status}
                    </Badge>
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
                                <Badge
                                  variant={
                                    log.action === "RECEIVE" || log.action === "CREATE"
                                      ? "default"
                                      : log.action === "UPDATE" ||
                                        log.action === "ADJUST_QTY" ||
                                        log.action === "ADJUST_QUANTITY"
                                      ? "secondary"
                                      : log.action === "DELETE"
                                      ? "destructive"
                                      : "outline"
                                  }
                                  className="text-xs"
                                >
                                  {log.action}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {log.user.name || log.user.email}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({log.user.role})
                                </span>
                              </div>
                              <div className="text-sm">
                                {log.details?.summary ||
                                  log.details?.reason ||
                                  "No description"}
                              </div>
                              {log.details && (
                                <div className="text-xs bg-muted p-2 rounded mt-1">
                                  {log.details.old_qty !== undefined &&
                                    log.details.new_qty !== undefined && (
                                      <div>
                                        Quantity: {log.details.old_qty} →{" "}
                                        {log.details.new_qty}
                                        {log.details.diff && (
                                          <span
                                            className={
                                              log.details.diff > 0
                                                ? "text-green-600"
                                                : "text-red-600"
                                            }
                                          >
                                            {" "}
                                            ({log.details.diff > 0 ? "+" : ""}
                                            {log.details.diff})
                                          </span>
                                        )}
                                      </div>
                                    )}
                                  {log.details.notes && (
                                    <div className="mt-1 italic">
                                      Notes: {log.details.notes}
                                    </div>
                                  )}
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
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-muted-foreground">
              No lifecycle data available
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

