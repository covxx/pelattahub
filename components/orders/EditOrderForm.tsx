"use client"

import { useState, useTransition, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Plus, Trash2, Save } from "lucide-react"
import { updateOrder } from "@/app/actions/orders"
import { CustomerCombobox } from "./CustomerCombobox"
import { ProductCombobox } from "@/components/receiving/ProductCombobox"
import { useToast } from "@/hooks/useToast"
import { ToastContainer } from "@/components/ui/toast"
import { useRouter } from "next/navigation"
import type { Product } from "@/types/product"

const orderSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  poNumber: z.string().optional(),
  deliveryDate: z.string().min(1, "Delivery date is required"),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Product is required"),
        quantity: z
          .number()
          .int()
          .min(1, "Quantity must be at least 1"),
      })
    )
    .min(1, "At least one item is required"),
})

type OrderFormValues = z.infer<typeof orderSchema>

interface EditOrderFormProps {
  order: {
    id: string
    customer_id: string
    po_number: string | null
    delivery_date: Date | string
    items: Array<{
      id: string
      product_id: string
      quantity_ordered: number
      product: {
        id: string
        name: string
        sku: string
        unit_type: string
      }
    }>
  }
  customers: Array<{
    id: string
    name: string
    code: string
    address?: string | null
    contact_email?: string | null
  }>
  products: Product[]
}

export function EditOrderForm({ order, customers, products }: EditOrderFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { toast, toasts, removeToast } = useToast()

  // Format delivery date for input
  const deliveryDateStr =
    order.delivery_date instanceof Date
      ? order.delivery_date.toISOString().split("T")[0]
      : new Date(order.delivery_date).toISOString().split("T")[0]

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerId: order.customer_id,
      poNumber: order.po_number || "",
      deliveryDate: deliveryDateStr,
      items: order.items.map((item) => ({
        productId: item.product_id,
        quantity: item.quantity_ordered,
      })),
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const onSubmit = async (data: OrderFormValues) => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await updateOrder(order.id, {
          customerId: data.customerId,
          poNumber: data.poNumber || undefined,
          deliveryDate: new Date(data.deliveryDate),
          items: data.items,
        })

        if (result.success && result.order) {
          toast("Order updated successfully", "success")
          // Redirect to orders list
          setTimeout(() => {
            router.push("/dashboard/orders")
          }, 1000)
        } else {
          setError(result.error || "Failed to update order")
          toast(result.error || "Failed to update order", "error")
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to update order"
        setError(errorMessage)
        toast(errorMessage, "error")
      }
    })
  }

  return (
    <div className="space-y-6">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Customer Selection */}
          <FormField
            control={form.control}
            name="customerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer *</FormLabel>
                <FormControl>
                  <CustomerCombobox
                    customers={customers}
                    value={field.value}
                    onValueChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* PO Number */}
          <FormField
            control={form.control}
            name="poNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PO Number (Optional)</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Purchase Order Number"
                    {...field}
                    value={field.value || ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Delivery Date */}
          <FormField
            control={form.control}
            name="deliveryDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Delivery Date *</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Order Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <FormLabel>Order Items *</FormLabel>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ productId: "", quantity: 1 })}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex gap-4 items-start p-4 border rounded-lg"
              >
                <FormField
                  control={form.control}
                  name={`items.${index}.productId`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>Product</FormLabel>
                      <FormControl>
                        <ProductCombobox
                          products={products}
                          value={field.value}
                          onValueChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name={`items.${index}.quantity`}
                  render={({ field }) => (
                    <FormItem className="w-32">
                      <FormLabel>Quantity</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseInt(e.target.value) || 1)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {fields.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    className="mt-8"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Save className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </Form>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

