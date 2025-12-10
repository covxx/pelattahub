"use client"

import { useState, useTransition } from "react"
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
import { Plus, Trash2, ShoppingCart } from "lucide-react"
import { createOrder } from "@/app/actions/orders"
import { getAllCustomers } from "@/app/actions/admin/customers"
import { getActiveProducts } from "@/app/actions/products"
import { CustomerCombobox } from "./CustomerCombobox"
import { ProductCombobox } from "@/components/receiving/ProductCombobox"
import { useToast } from "@/hooks/useToast"
import { ToastContainer } from "@/components/ui/toast"
import { useRouter } from "next/navigation"

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

import type { Product } from "@/types/product"

interface CreateOrderFormProps {
  customers: Array<{
    id: string
    name: string
    code: string
    address?: string | null
    contact_email?: string | null
  }>
  products: Product[]
}

export function CreateOrderForm({ customers, products }: CreateOrderFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const { toast, toasts, removeToast } = useToast()

  // Default delivery date to 7 days from now
  const defaultDeliveryDate = new Date()
  defaultDeliveryDate.setDate(defaultDeliveryDate.getDate() + 7)
  const defaultDateStr = defaultDeliveryDate.toISOString().split("T")[0]

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: {
      customerId: "",
      poNumber: "",
      deliveryDate: defaultDateStr,
      items: [{ productId: "", quantity: 1 }],
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
        const result = await createOrder({
          customerId: data.customerId,
          poNumber: data.poNumber || undefined,
          deliveryDate: new Date(data.deliveryDate),
          items: data.items,
        })

        if (result.success && result.order) {
          toast("Order created successfully", "success")
          // Redirect to orders list or order detail
          setTimeout(() => {
            router.push("/dashboard/orders")
            router.refresh()
          }, 1000)
        } else {
          setError(result.error || "Failed to create order")
          toast(result.error || "Failed to create order", "error")
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "An error occurred"
        setError(errorMessage)
        toast(errorMessage, "error")
      }
    })
  }

  return (
    <>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Header Section */}
          <div className="space-y-4 border-b pb-6">
            <h2 className="text-2xl font-bold">Create Outbound Order</h2>

            {/* Customer Selection */}
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xl font-semibold">
                    Customer *
                  </FormLabel>
                  <FormControl>
                    <CustomerCombobox
                      customers={customers}
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              {/* PO Number */}
              <FormField
                control={form.control}
                name="poNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xl font-semibold">
                      PO Number
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Customer PO #"
                        className="text-lg h-14"
                        {...field}
                        disabled={isPending}
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
                    <FormLabel className="text-xl font-semibold">
                      Delivery Date *
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        className="text-lg h-14"
                        {...field}
                        disabled={isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Order Items Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold">Order Items</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append({ productId: "", quantity: 1 })}
                disabled={isPending}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            <div className="space-y-4">
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="flex gap-4 items-start p-4 border rounded-lg"
                >
                  <div className="flex-1 grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`items.${index}.productId`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-semibold">
                            Product *
                          </FormLabel>
                          <FormControl>
                            <ProductCombobox
                              products={products}
                              value={field.value}
                              onValueChange={field.onChange}
                              disabled={isPending}
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
                        <FormItem>
                          <FormLabel className="text-base font-semibold">
                            Quantity *
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              placeholder="Qty"
                              className="text-lg h-14"
                              {...field}
                              onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                              value={field.value}
                              disabled={isPending}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => remove(index)}
                      disabled={isPending}
                      className="mt-8"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded dark:bg-red-950 dark:border-red-800 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4 pt-4">
            <Button
              type="submit"
              size="lg"
              className="flex-1 text-lg h-14"
              disabled={isPending}
            >
              <ShoppingCart className="h-5 w-5 mr-2" />
              {isPending ? "Creating Order..." : "Create Order (DRAFT)"}
            </Button>
          </div>
        </form>
      </Form>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}

