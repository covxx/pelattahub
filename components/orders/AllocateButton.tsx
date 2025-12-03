"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowRight, Package } from "lucide-react"
import { allocateOrder } from "@/app/actions/orders"
import { useToast } from "@/hooks/useToast"

interface AllocateButtonProps {
  orderId: string
}

export function AllocateButton({ orderId }: AllocateButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const handleAllocate = () => {
    startTransition(async () => {
      try {
        const result = await allocateOrder(orderId)

        if (result.success) {
          toast("Order allocated and ready for picking!", "success")
          // Redirect to picking page after a short delay
          setTimeout(() => {
            router.push(`/dashboard/orders/${orderId}/pick`)
            router.refresh()
          }, 1000)
        } else {
          toast(result.error || "Failed to allocate order", "error")
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to allocate order"
        toast(errorMessage, "error")
      }
    })
  }

  return (
    <Button
      variant="default"
      size="sm"
      onClick={handleAllocate}
      disabled={isPending}
    >
      {isPending ? (
        <>
          <Package className="h-4 w-4 mr-2 animate-spin" />
          Allocating...
        </>
      ) : (
        <>
          <ArrowRight className="h-4 w-4 mr-2" />
          Allocate & Push to Picking
        </>
      )}
    </Button>
  )
}

