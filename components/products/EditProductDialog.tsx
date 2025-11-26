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
import { updateProduct } from "@/app/actions/products"
import type { Product } from "@/types/product"

const productSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  variety: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  gtin: z
    .string()
    .optional()
    .nullable()
    .transform((val) => {
      if (!val || val.trim() === "") return null
      // Remove any non-digit characters
      const digits = val.replace(/\D/g, "")
      if (digits.length === 0) return null
      // Pad to 14 digits if less than 14
      return digits.padStart(14, "0")
    })
    .refine(
      (val) => {
        if (val === null) return true
        return val.length === 14 && /^\d{14}$/.test(val)
      },
      { message: "GTIN must be exactly 14 digits" }
    ),
  target_temp_f: z.coerce.number().int().optional().nullable(),
  image_url: z.string().url().optional().nullable().or(z.literal("")),
})

type ProductFormValues = z.infer<typeof productSchema>

interface EditProductDialogProps {
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
  onProductUpdated: (product: Product) => void
}

export function EditProductDialog({
  product,
  open,
  onOpenChange,
  onProductUpdated,
}: EditProductDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: product.sku,
      name: product.name,
      variety: product.variety,
      description: product.description,
      gtin: product.gtin,
      target_temp_f: product.target_temp_f,
      image_url: product.image_url,
    },
  })

  const onSubmit = async (data: ProductFormValues) => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await updateProduct(product.id, {
          sku: data.sku,
          name: data.name,
          variety: data.variety || null,
          description: data.description || null,
          gtin: data.gtin || null,
          target_temp_f: data.target_temp_f || null,
          image_url: data.image_url || null,
        })
        if (result.success && result.product) {
          onProductUpdated(result.product as Product)
          onOpenChange(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update product")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Product</DialogTitle>
          <DialogDescription>
            Update product information. SKU must be unique.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name *</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="variety"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Variety</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value || ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gtin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>GTIN (Barcode/UPC) *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="10012345678902"
                      {...field}
                      value={field.value || ""}
                      maxLength={14}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground mt-1">
                    14-digit GTIN required for GS1-128 barcodes. Will auto-pad if you enter 12 digits.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="target_temp_f"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Temperature (°F)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        {...field}
                        value={field.value || ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="image_url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Image URL</FormLabel>
                    <FormControl>
                      <Input type="url" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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

