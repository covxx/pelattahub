"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Package, Trash2 } from "lucide-react"
import { format } from "date-fns"
import { revertPick } from "@/app/actions/picking"
import { useToast } from "@/hooks/useToast"

interface PickItemCardProps {
  item: {
    id: string
    product: {
      name: string
      sku: string
      unit_type: string
    }
    quantity_ordered: number
    totalPicked: number
    remainingToPick: number
    picks: Array<{
      id: string
      inventory_lot_id: string
      quantity_picked: number
      picked_at: Date
      inventory_lot?: {
        lot_number: string
      }
      picked_by_user?: {
        name: string | null
        email: string
      }
    }>
    availableLots?: Array<{
      id: string
      lot_number: string
      remaining_qty: number
    }>
  }
  onSelectLots: () => void
  onUnpick?: () => void
}

export function PickItemCard({ item, onSelectLots, onUnpick }: PickItemCardProps) {
  const [isUnpicking, setIsUnpicking] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const isComplete = item.totalPicked >= item.quantity_ordered
  const isPartiallyPicked = item.totalPicked > 0 && !isComplete
  const isUnpicked = item.totalPicked === 0

  const handleUnpick = async (pickId: string) => {
    setIsUnpicking(pickId)
    try {
      const result = await revertPick(pickId)
      if (result.success) {
        toast("Pick reverted successfully. Inventory restored.", "success")
        // Refresh the page to update the UI
        if (onUnpick) {
          onUnpick()
        } else {
          window.location.reload()
        }
      } else {
        toast(result.error || "Failed to revert pick.", "error")
        setIsUnpicking(null)
      }
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Failed to revert pick.",
        "error"
      )
      setIsUnpicking(null)
    }
  }

  return (
    <Card
      className={
        isComplete
          ? "border-green-500 border-2"
          : isPartiallyPicked
          ? "border-yellow-500 border-2"
          : ""
      }
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="flex items-center gap-2">
              {isComplete && (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              )}
              {item.product.name}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              SKU: {item.product.sku}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">
              {item.totalPicked} / {item.quantity_ordered}{" "}
              {item.product.unit_type}
            </p>
            {isPartiallyPicked && (
              <p className="text-xs text-muted-foreground mt-1">
                {item.remainingToPick} remaining
              </p>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* State A: Unpicked */}
        {isUnpicked && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Requested: {item.quantity_ordered} {item.product.unit_type}
            </p>
            <Button onClick={onSelectLots}>
              <Package className="h-4 w-4 mr-2" />
              Select Lots
            </Button>
          </div>
        )}

        {/* State B: Partially Picked */}
        {isPartiallyPicked && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  Progress: {item.totalPicked} / {item.quantity_ordered} Picked
                </p>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2 overflow-hidden max-w-md">
                  <div
                    className="h-full bg-yellow-500 transition-all duration-300"
                    style={{
                      width: `${(item.totalPicked / item.quantity_ordered) * 100}%`,
                    }}
                  />
                </div>
              </div>
              <Button onClick={onSelectLots} variant="outline">
                Continue Picking
              </Button>
            </div>

            {/* Current Allocations Table */}
            {item.picks.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  Current Allocations:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 text-xs font-medium text-muted-foreground">
                          Lot #
                        </th>
                        <th className="pb-2 text-xs font-medium text-muted-foreground text-right">
                          Qty Picked
                        </th>
                        <th className="pb-2 text-xs font-medium text-muted-foreground">
                          Picked By
                        </th>
                        <th className="pb-2 text-xs font-medium text-muted-foreground text-right w-12">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.picks.map((pick) => (
                        <tr key={pick.id} className="border-b">
                          <td className="py-2 font-mono text-xs">
                            {pick.inventory_lot?.lot_number ||
                              pick.inventory_lot_id.slice(0, 8)}
                          </td>
                          <td className="py-2 text-right font-medium">
                            {pick.quantity_picked} {item.product.unit_type}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {pick.picked_by_user?.name ||
                              pick.picked_by_user?.email ||
                              "Unknown"}
                          </td>
                          <td className="py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleUnpick(pick.id)}
                              disabled={isUnpicking === pick.id || isPending}
                              title="Unpick / Return to Stock"
                            >
                              {isUnpicking === pick.id ? (
                                <span className="animate-spin">⏳</span>
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* State C: Complete */}
        {isComplete && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">
                  {item.quantity_ordered} / {item.quantity_ordered} Picked
                </span>
              </div>
              <span className="text-sm text-muted-foreground">Complete</span>
            </div>

            {/* Current Allocations Table */}
            {item.picks.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs font-medium text-muted-foreground mb-3">
                  Current Allocations:
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="pb-2 text-xs font-medium text-muted-foreground">
                          Lot #
                        </th>
                        <th className="pb-2 text-xs font-medium text-muted-foreground text-right">
                          Qty Picked
                        </th>
                        <th className="pb-2 text-xs font-medium text-muted-foreground">
                          Picked By
                        </th>
                        <th className="pb-2 text-xs font-medium text-muted-foreground text-right w-12">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {item.picks.map((pick) => (
                        <tr key={pick.id} className="border-b">
                          <td className="py-2 font-mono text-xs">
                            {pick.inventory_lot?.lot_number ||
                              pick.inventory_lot_id.slice(0, 8)}
                          </td>
                          <td className="py-2 text-right font-medium">
                            {pick.quantity_picked} {item.product.unit_type}
                          </td>
                          <td className="py-2 text-muted-foreground">
                            {pick.picked_by_user?.name ||
                              pick.picked_by_user?.email ||
                              "Unknown"}
                          </td>
                          <td className="py-2 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => handleUnpick(pick.id)}
                              disabled={isUnpicking === pick.id || isPending}
                              title="Unpick / Return to Stock"
                            >
                              {isUnpicking === pick.id ? (
                                <span className="animate-spin">⏳</span>
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

