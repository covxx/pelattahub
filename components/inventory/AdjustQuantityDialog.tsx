"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { adjustLotQuantity } from "@/app/actions/inventory"
import type { InventoryLot } from "@/types/inventory"

const adjustSchema = z.object({
  quantity: z.coerce.number().int().min(0, "Quantity cannot be negative"),
  reason: z.string().optional(),
})

type AdjustFormValues = z.infer<typeof adjustSchema>

interface AdjustQuantityDialogProps {
  lot: InventoryLot
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AdjustQuantityDialog({
  lot,
  open,
  onOpenChange,
}: AdjustQuantityDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustSchema),
    defaultValues: {
      quantity: lot.quantity_current,
      reason: "",
    },
  })

  const onSubmit = async (data: AdjustFormValues) => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await adjustLotQuantity(
          lot.id,
          data.quantity,
          data.reason
        )
        if (result.success) {
          onOpenChange(false)
          // Refresh the page to show updated data
          window.location.reload()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to adjust quantity")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adjust Quantity</DialogTitle>
          <DialogDescription>
            Update the current quantity for Lot {lot.lot_number}. This is useful
            for tracking shrinkage, spoilage, or corrections.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Product: {lot.product.name}
              </p>
              <p className="text-sm text-muted-foreground">
                Original Quantity: {lot.quantity_received}
              </p>
              <p className="text-sm text-muted-foreground">
                Current Quantity: {lot.quantity_current}
              </p>
            </div>

            <FormField
              control={form.control}
              name="quantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Quantity *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g., Spoilage, Shrinkage, Correction"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  form.reset()
                  setError(null)
                  onOpenChange(false)
                }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

