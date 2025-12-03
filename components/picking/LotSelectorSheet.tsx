"use client"

import { useState, useTransition } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { submitPick } from "@/app/actions/picking"
import { useToast } from "@/hooks/useToast"
import { format } from "date-fns"
import { Calendar } from "lucide-react"

interface LotSelectorSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  orderItem: {
    id: string
    product: {
      name: string
      sku: string
      unit_type: string
    }
    quantity_ordered: number
    totalPicked: number
    remainingToPick: number
    availableLots: Array<{
      id: string
      lot_number: string
      expiry_date: Date
      quantity_current: number
      remaining_qty: number
      product: {
        name: string
        sku: string
        unit_type: string
      }
    }>
  }
  onPickComplete: () => void
}

export function LotSelectorSheet({
  open,
  onOpenChange,
  orderItem,
  onPickComplete,
}: LotSelectorSheetProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const handleQuantityChange = (lotId: string, value: string) => {
    const numValue = parseFloat(value) || 0
    setQuantities((prev) => ({
      ...prev,
      [lotId]: numValue,
    }))
  }

  const handleConfirmPick = () => {
    // Validate quantities
    const totalQuantity = Object.values(quantities).reduce(
      (sum, qty) => sum + qty,
      0
    )

    if (totalQuantity <= 0) {
      toast("Please enter at least one quantity to pick.", "error")
      return
    }

    if (totalQuantity > orderItem.remainingToPick) {
      toast(
        `Cannot pick more than ${orderItem.remainingToPick} ${orderItem.product.unit_type.toLowerCase()}.`,
        "error"
      )
      return
    }

    // Validate each lot has enough quantity
    for (const [lotId, qty] of Object.entries(quantities)) {
      if (qty <= 0) continue

      const lot = orderItem.availableLots.find((l) => l.id === lotId)
      if (!lot) continue

      if (qty > lot.remaining_qty) {
        toast(
          `Lot ${lot.lot_number} only has ${lot.remaining_qty} ${lot.product.unit_type.toLowerCase()} available.`,
          "error"
        )
        return
      }
    }

    // Submit picks
    startTransition(async () => {
      try {
        const pickPromises = Object.entries(quantities)
          .filter(([_, qty]) => qty > 0)
          .map(([lotId, qty]) => submitPick(orderItem.id, lotId, qty))

        const results = await Promise.all(pickPromises)

        const failed = results.filter((r) => !r.success)
        if (failed.length > 0) {
          toast(failed[0].error || "Failed to submit some picks.", "error")
        } else {
          toast("Successfully recorded picks.", "success")
          setQuantities({})
          onOpenChange(false)
          onPickComplete()
        }
      } catch (error) {
        toast(
          error instanceof Error ? error.message : "Failed to submit picks.",
          "error"
        )
      }
    })
  }

  const totalEntered = Object.values(quantities).reduce((sum, qty) => sum + qty, 0)
  const oldestLot = orderItem.availableLots[0] // Already sorted by FIFO

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Select Lots for {orderItem.product.name}</SheetTitle>
          <SheetDescription>
            Remaining to pick: {orderItem.remainingToPick}{" "}
            {orderItem.product.unit_type}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {orderItem.availableLots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No available lots for this product.</p>
            </div>
          ) : (
            <>
              {/* Lot List */}
              <div className="space-y-3">
                {orderItem.availableLots.map((lot, index) => {
                  const isOldest = index === 0
                  const qty = quantities[lot.id] || 0

                  return (
                    <div
                      key={lot.id}
                      className={`p-4 border rounded-lg ${
                        isOldest
                          ? "bg-green-50 border-green-300 border-2"
                          : "bg-white border-gray-200"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Label className="font-semibold">
                              Lot #{lot.lot_number}
                            </Label>
                            {isOldest && (
                              <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">
                                Best Match (FIFO)
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-muted-foreground mt-1 space-y-1">
                            <p>
                              Available: {lot.remaining_qty}{" "}
                              {lot.product.unit_type}
                            </p>
                            <p className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              Expires: {format(new Date(lot.expiry_date), "MMM dd, yyyy")}
                            </p>
                          </div>
                        </div>
                        <div className="w-32">
                          <Label htmlFor={`qty-${lot.id}`} className="text-xs">
                            Quantity to Pick
                          </Label>
                          <Input
                            id={`qty-${lot.id}`}
                            type="number"
                            min="0"
                            max={lot.remaining_qty}
                            step="0.01"
                            value={qty}
                            onChange={(e) =>
                              handleQuantityChange(lot.id, e.target.value)
                            }
                            className="mt-1"
                            disabled={isPending}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Summary */}
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Entered:</span>
                  <span className="text-lg font-semibold">
                    {totalEntered} {orderItem.product.unit_type}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-muted-foreground">
                    Remaining to Pick:
                  </span>
                  <span className="text-sm font-medium">
                    {orderItem.remainingToPick - totalEntered}{" "}
                    {orderItem.product.unit_type}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmPick}
            disabled={isPending || totalEntered <= 0 || orderItem.availableLots.length === 0}
          >
            {isPending ? "Submitting..." : "Confirm Pick"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

