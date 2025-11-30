"use client"

import { useState, useTransition, useEffect } from "react"
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
  FormDescription,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { adjustLotQuantity } from "@/app/actions/inventory-adjust"
import { AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react"
import { cn } from "@/lib/utils"

const ADJUSTMENT_REASONS = [
  { value: "cycle_count", label: "Cycle Count Correction" },
  { value: "damaged", label: "Damaged/Spoiled" },
  { value: "data_entry", label: "Data Entry Error" },
  { value: "found_stock", label: "Found Stock" },
  { value: "customer_return", label: "Customer Return" },
  { value: "vendor_credit", label: "Vendor Credit/Return" },
  { value: "other", label: "Other" },
] as const

const adjustSchema = z.object({
  newQuantity: z
    .number()
    .min(0, "Quantity cannot be negative")
    .int("Quantity must be a whole number"),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
})

type AdjustFormValues = z.infer<typeof adjustSchema>

interface InventoryAdjustmentDialogProps {
  lot: {
    id: string
    lot_number: string
    quantity_current: number
    product?: {
      name: string
      sku: string
      unit_type: string
    } | null
  }
  productName?: string
  productSku?: string
  productUnitType?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function InventoryAdjustmentDialog({
  lot,
  productName,
  productSku,
  productUnitType = "CASE",
  open,
  onOpenChange,
  onSuccess,
}: InventoryAdjustmentDialogProps) {
  // Console debugging - log component state
  console.log("⚠️ ADJUST DIALOG DEBUG:", {
    lot: lot,
    hasProductInLot: !!lot?.product,
    productNameProp: productName,
    productSkuProp: productSku,
    lotProductName: lot?.product?.name,
    lotProductSku: lot?.product?.sku,
  })
  
  // Early return if lot is missing - must be before hooks
  // But we can't return before hooks in React, so we'll check in render
  if (!lot) return null
  
  // Priority: Use passed prop -> Use lot relation -> Fallback
  const safeProductName = productName || lot?.product?.name || "Unknown Product"
  const safeSku = productSku || lot?.product?.sku || "No SKU"
  const safeUnitType = productUnitType || lot?.product?.unit_type || "CASE"
  const isValid = !!(lot && safeProductName && safeSku)
  
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [difference, setDifference] = useState(0)

  const form = useForm<AdjustFormValues>({
    resolver: zodResolver(adjustSchema),
    defaultValues: {
      newQuantity: lot?.quantity_current || 0,
      reason: "",
      notes: "",
    },
  })

  const watchedQuantity = form.watch("newQuantity")

  // Calculate difference whenever the quantity changes
  useEffect(() => {
    if (!lot) return
    const newQty = Number(watchedQuantity) || 0
    const diff = newQty - (lot.quantity_current || 0)
    setDifference(diff)
  }, [watchedQuantity, lot?.quantity_current, lot])

  function onSubmit(data: AdjustFormValues) {
    if (!lot) return
    
    setError(null)
    startTransition(async () => {
      try {
        const result = await adjustLotQuantity({
          lotId: lot.id,
          newQuantity: data.newQuantity,
          reason: ADJUSTMENT_REASONS.find((r) => r.value === data.reason)
            ?.label || data.reason,
          notes: data.notes,
        })

        if (!result.success) {
          setError(result.error || "Failed to adjust quantity")
          return
        }

        // Close dialog and trigger success callback
        onOpenChange(false)
        form.reset()
        onSuccess?.()
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
      }
    })
  }

  // Reset form when dialog opens
  useEffect(() => {
    if (open && lot) {
      form.reset({
        newQuantity: lot.quantity_current || 0,
        reason: "",
        notes: "",
      })
      setError(null)
      setDifference(0)
    }
  }, [open, lot?.quantity_current, form])

  // Don't render if lot or product is missing
  if (!isValid) {
    return null
  }

  // At this point we know lot exists (checked above)
  // Use the props directly with fallbacks already applied
  const safeLot = lot

  return (
    <Dialog open={open && isValid} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Adjust Stock - Lot #{safeLot.lot_number}
          </DialogTitle>
          <DialogDescription>
            {safeProductName} ({safeSku}). Make corrections to the quantity of this lot.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Current Quantity Display */}
            <div className="rounded-lg bg-gray-50 dark:bg-gray-800/50 p-4 space-y-2">
              <div className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Current Quantity
              </div>
              <div className="text-4xl font-bold text-gray-900 dark:text-white">
                {safeLot.quantity_current}
                <span className="text-lg font-normal text-gray-500 ml-2">
                  {safeUnitType}
                </span>
              </div>
            </div>

            {/* New Quantity Input with Difference Badge */}
            <FormField
              control={form.control}
              name="newQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">
                    New Quantity
                  </FormLabel>
                  <div className="flex items-center gap-3">
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        className="text-2xl h-14 font-semibold"
                        min={0}
                        step={1}
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        value={field.value}
                      />
                    </FormControl>

                    {/* Difference Badge */}
                    {difference !== 0 && (
                      <Badge
                        variant={difference > 0 ? "default" : "destructive"}
                        className={cn(
                          "text-base px-3 py-1.5 font-bold whitespace-nowrap",
                          difference > 0 &&
                            "bg-green-500 hover:bg-green-600 text-white",
                          difference < 0 &&
                            "bg-red-500 hover:bg-red-600 text-white"
                        )}
                      >
                        {difference > 0 ? (
                          <TrendingUp className="h-4 w-4 mr-1" />
                        ) : (
                          <TrendingDown className="h-4 w-4 mr-1" />
                        )}
                        {difference > 0 ? "+" : ""}
                        {difference}
                      </Badge>
                    )}

                    {difference === 0 && watchedQuantity !== undefined && (
                      <Badge
                        variant="outline"
                        className="text-base px-3 py-1.5 font-bold"
                      >
                        <Minus className="h-4 w-4 mr-1" />0
                      </Badge>
                    )}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reason Dropdown */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">
                    Reason <span className="text-red-500">*</span>
                  </FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="h-11 text-base">
                        <SelectValue placeholder="Select a reason" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ADJUSTMENT_REASONS.map((reason) => (
                        <SelectItem
                          key={reason.value}
                          value={reason.value}
                          className="text-base"
                        >
                          {reason.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs">
                    Select the reason for this inventory adjustment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Optional Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">
                    Notes (Optional)
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Add any additional details..."
                      className="resize-none"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription className="text-xs">
                    Provide additional context for this adjustment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Error Display */}
            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || difference === 0}>
                {isPending ? "Adjusting..." : "Confirm Adjustment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

