"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Package, Truck } from "lucide-react"
import { PickItemCard } from "./PickItemCard"
import { LotSelectorSheet } from "./LotSelectorSheet"
import { finalizeOrder } from "@/app/actions/picking"
import { useToast } from "@/hooks/useToast"
import { format } from "date-fns"

interface PickingInterfaceProps {
  order: Awaited<ReturnType<typeof import("@/app/actions/picking").getOrderForPicking>>
}

export function PickingInterface({ order: initialOrder }: PickingInterfaceProps) {
  const [order, setOrder] = useState(initialOrder)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isFinalizing, setIsFinalizing] = useState(false)
  const router = useRouter()
  const { toast } = useToast()

  // Calculate overall progress
  const totalItems = order.items.length
  const completedItems = order.items.filter(
    (item: typeof order.items[0]) => item.totalPicked >= item.quantity_ordered
  ).length
  const progressPercentage = totalItems > 0 ? (completedItems / totalItems) * 100 : 0

  // Calculate total picked vs total ordered
  const totalOrdered = order.items.reduce(
    (sum: number, item: typeof order.items[0]) => sum + item.quantity_ordered,
    0
  )
  const totalPicked = order.items.reduce(
    (sum: number, item: typeof order.items[0]) => sum + item.totalPicked,
    0
  )

  const handleOpenLotSelector = (itemId: string) => {
    setSelectedItemId(itemId)
    setSheetOpen(true)
  }

  const handleCloseSheet = () => {
    setSheetOpen(false)
    setSelectedItemId(null)
  }

  const handlePickComplete = () => {
    // Refresh the order data
    startTransition(async () => {
      // In a real implementation, you'd refetch the order
      // For now, we'll rely on the parent to refresh
      window.location.reload()
    })
  }

  // Check if all items are fully picked
  const allItemsComplete = order.items.every(
    (item: typeof order.items[0]) => item.totalPicked >= item.quantity_ordered
  )

  const handleFinalizeOrder = async () => {
    if (!allItemsComplete) {
      toast("All items must be fully picked before finalizing.", "error")
      return
    }

    setIsFinalizing(true)
    try {
      const result = await finalizeOrder(order.id)

      if (result.success) {
        toast("Order finalized and shipped successfully!", "success")
        // Redirect to orders list after a short delay
        setTimeout(() => {
          router.push("/dashboard/orders")
        }, 1000)
      } else {
        toast(result.error || "Failed to finalize order.", "error")
        setIsFinalizing(false)
      }
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Failed to finalize order.",
        "error"
      )
      setIsFinalizing(false)
    }
  }

  const selectedItem = order.items.find(
    (item: (typeof order.items)[0]) => item.id === selectedItemId
  )

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold">
            Picking Order {order.order_number || order.id.slice(0, 8)}
          </h1>
          <p className="text-lg text-muted-foreground mt-1">
            {order.customer.name}
          </p>
          <p className="text-sm text-muted-foreground">
            Delivery Date: {format(new Date(order.delivery_date), "MMM dd, yyyy")}
          </p>
        </div>

        {/* Progress Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">
                  {completedItems} of {totalItems} items complete
                </span>
                <span className="text-muted-foreground">
                  {totalPicked} / {totalOrdered} units picked
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground text-center">
                {Math.round(progressPercentage)}% Complete
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pick List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Pick List</h2>
        {order.items.map((item: (typeof order.items)[0]) => (
          <PickItemCard
            key={item.id}
            item={item}
            onSelectLots={() => handleOpenLotSelector(item.id)}
            onUnpick={handlePickComplete}
          />
        ))}
      </div>

      {/* Lot Selector Sheet */}
      {selectedItem && (
        <LotSelectorSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          orderItem={selectedItem}
          onPickComplete={handlePickComplete}
        />
      )}

      {/* Footer with Complete & Ship Button */}
      <Card className="sticky bottom-0 z-10 border-t-2">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {allItemsComplete
                  ? "All items are fully picked. Ready to ship."
                  : `${completedItems} of ${totalItems} items complete. Continue picking to finalize.`}
              </p>
            </div>
            <Button
              onClick={handleFinalizeOrder}
              disabled={!allItemsComplete || isFinalizing}
              size="lg"
              className="min-w-[180px]"
            >
              {isFinalizing ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Finalizing...
                </>
              ) : (
                <>
                  <Truck className="h-4 w-4 mr-2" />
                  Complete & Ship
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

