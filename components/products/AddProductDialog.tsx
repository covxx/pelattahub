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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createProduct } from "@/app/actions/products"
import type { Product } from "@/types/product"

const productSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Name is required"),
  gtin: z
    .string()
    .min(1, "GTIN is required")
    .transform((val) => {
      // Remove any non-digit characters
      const digits = val.replace(/\D/g, "")
      // Pad to 14 digits if less than 14
      return digits.padStart(14, "0")
    })
    .refine(
      (val) => val.length === 14 && /^\d{14}$/.test(val),
      { message: "GTIN must be exactly 14 digits" }
    ),
  default_origin_country: z.string().min(1, "Origin country is required"),
  unit_type: z.enum(["CASE", "LBS", "EACH"]),
  standard_case_weight: z.number().positive().nullable().optional(),
  variety: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  target_temp_f: z.number().int().nullable().optional(),
  image_url: z.string().url().nullable().optional().or(z.literal("")),
})

type ProductFormValues = z.infer<typeof productSchema>

interface AddProductDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProductAdded: (product: Product) => void
}

export function AddProductDialog({
  open,
  onOpenChange,
  onProductAdded,
}: AddProductDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: "",
      name: "",
      gtin: "",
      default_origin_country: "USA",
      unit_type: "CASE",
      standard_case_weight: null,
      variety: null,
      description: null,
      target_temp_f: null,
      image_url: null,
    },
  })

  const onSubmit = async (data: ProductFormValues) => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await createProduct({
          sku: data.sku,
          name: data.name,
          gtin: data.gtin,
          default_origin_country: data.default_origin_country,
          unit_type: data.unit_type,
          standard_case_weight: data.standard_case_weight || null,
          variety: data.variety || null,
          description: data.description || null,
          target_temp_f: data.target_temp_f || null,
          image_url: data.image_url || null,
        })
        if (result.success && result.product) {
          onProductAdded(result.product as Product)
          form.reset()
          onOpenChange(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create product")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add New Product</DialogTitle>
          <DialogDescription>
            Create a new product SKU. The SKU must be unique.
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
                      <Input placeholder="APP-GAL-40" {...field} />
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
                      <Input placeholder="Gala Apples" {...field} />
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
                    <Input
                      placeholder="Royal Gala"
                      {...field}
                      value={field.value || ""}
                    />
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
                    <Input
                      placeholder="Product description"
                      {...field}
                      value={field.value || ""}
                    />
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
                name="default_origin_country"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default Origin Country *</FormLabel>
                    <FormControl>
                      <Input placeholder="USA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="unit_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit Type *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CASE">Case</SelectItem>
                        <SelectItem value="LBS">Pounds (LBS)</SelectItem>
                        <SelectItem value="EACH">Each</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="standard_case_weight"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Standard Case Weight (lbs)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="40.00"
                      {...field}
                      value={field.value || ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? parseFloat(e.target.value) : null
                        )
                      }
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    The weight in pounds of 1 case (e.g., 40 for a case of apples). Used for weight estimation.
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
                        placeholder="32"
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
                      <Input
                        type="url"
                        placeholder="https://example.com/image.jpg"
                        {...field}
                        value={field.value || ""}
                      />
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
                {isPending ? "Creating..." : "Create Product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

