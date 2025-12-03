"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { RotateCcw, AlertTriangle } from "lucide-react"
import { unshipOrder } from "@/app/actions/orders"
import { useToast } from "@/hooks/useToast"
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

interface UnshipButtonProps {
  orderId: string
  orderPoNumber?: string | null
}

export function UnshipButton({ orderId, orderPoNumber }: UnshipButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const { toast } = useToast()

  const handleUnship = () => {
    startTransition(async () => {
      try {
        const result = await unshipOrder(orderId)

        if (result.success) {
          toast("Order unshipped successfully. Inventory restored.", "success")
          setOpen(false)
          router.refresh()
        } else {
          toast(result.error || "Failed to unship order", "error")
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to unship order"
        toast(errorMessage, "error")
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={isPending}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Unship
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Unship Order?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This will:
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Revert order status from SHIPPED to READY_TO_SHIP</li>
              <li>Restore all inventory quantities that were picked</li>
              <li>Delete all pick records for this order</li>
            </ul>
            <p className="mt-4 font-semibold text-foreground">
              Order: {orderPoNumber ? `#${orderPoNumber}` : `ID: ${orderId.slice(0, 8).toUpperCase()}`}
            </p>
            <p className="mt-2 text-orange-600">
              This action cannot be undone. Are you sure you want to continue?
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleUnship}
            disabled={isPending}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {isPending ? (
              <>
                <RotateCcw className="h-4 w-4 mr-2 animate-spin" />
                Unshipping...
              </>
            ) : (
              <>
                <RotateCcw className="h-4 w-4 mr-2" />
                Yes, Unship Order
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

