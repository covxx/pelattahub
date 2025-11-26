"use client"

import { useState, useTransition, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
import { getActiveProducts } from "@/app/actions/products"
import { createLot } from "@/app/actions/inventory"
import { useZebraPrinter } from "@/contexts/ZebraPrinterContext"
import { generateGS1Label } from "@/lib/zpl-generator"
import { AlertCircle, CheckCircle, Printer } from "lucide-react"
import type { Product } from "@/types/product"

const receivingSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  quantityReceived: z.number().int().min(1, "Quantity must be at least 1"),
  receivedDate: z.string().min(1, "Received date is required"),
  originCountry: z.string().min(1, "Country of origin is required"),
  growerId: z.string().optional(),
})

type ReceivingFormValues = z.infer<typeof receivingSchema>

export function ReceivingForm() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const { isConnected, connect, print } = useZebraPrinter()

  // Get today's date in YYYY-MM-DD format
  const today = new Date().toISOString().split("T")[0]

  const form = useForm<ReceivingFormValues>({
    resolver: zodResolver(receivingSchema),
    defaultValues: {
      productId: "",
      quantityReceived: 1,
      receivedDate: today,
      originCountry: "",
      growerId: "",
    },
  })

  // Load products on mount
  useEffect(() => {
    startTransition(async () => {
      try {
        const result = await getActiveProducts()
        setProducts(result)
      } catch (err) {
        setError("Failed to load products")
      }
    })
  }, [])

  // Update selected product when productId changes
  useEffect(() => {
    const productId = form.watch("productId")
    const product = products.find((p) => p.id === productId)
    setSelectedProduct(product || null)
  }, [form.watch("productId"), products])

  const onSubmit = async (data: ReceivingFormValues) => {
    setError(null)
    setSuccess(null)

    // Validate that product has GTIN
    if (!selectedProduct) {
      setError("Please select a product")
      return
    }

    if (!selectedProduct.gtin) {
      setError("Cannot receive this product: Missing GTIN in Master Data")
      return
    }

    startTransition(async () => {
      try {
        // Step 1: Create lot in database
        const result = await createLot({
          productId: data.productId,
          quantityReceived: data.quantityReceived,
          receivedDate: new Date(data.receivedDate),
          originCountry: data.originCountry,
          growerId: data.growerId || undefined,
        })

        if (!result.success || !result.lot) {
          throw new Error("Failed to create lot")
        }

        // Step 2: Generate ZPL label
        const zpl = generateGS1Label(result.lot, result.lot.product)

        // Step 3: Send to printer
        try {
          await print(zpl)
          setSuccess(`Lot #${result.lot.lot_number} Received & Label Sent`)
        } catch (printErr) {
          setSuccess(
            `Lot #${result.lot.lot_number} Received (Print failed: ${printErr instanceof Error ? printErr.message : "Unknown error"})`
          )
        }

        // Step 4: Reset form (keep product selected for speed)
        form.setValue("quantityReceived", 1)
        form.setValue("originCountry", "")
        form.setValue("growerId", "")
        form.setValue("receivedDate", today)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to receive inventory")
      }
    })
  }

  // Generate barcode preview data
  const getBarcodePreview = () => {
    if (!selectedProduct?.gtin) return null

    const receivedDate = form.watch("receivedDate")
    if (!receivedDate) return null

    const date = new Date(receivedDate)
    const expiryDate = new Date(date)
    expiryDate.setDate(expiryDate.getDate() + 10)

    const formatDate = (d: Date) => {
      const year = d.getFullYear().toString().slice(-2)
      const month = (d.getMonth() + 1).toString().padStart(2, "0")
      const day = d.getDate().toString().padStart(2, "0")
      return `${year}${month}${day}`
    }

    // Estimate lot number (SKU-YYYYMMDD)
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "")
    const lotNumber = `${selectedProduct.sku}-${dateStr}-HHMMSS`

    return {
      gtin: selectedProduct.gtin.padStart(14, "0"),
      expiry: formatDate(expiryDate),
      lot: lotNumber.replace(/[^A-Za-z0-9-]/g, "").toUpperCase(),
    }
  }

  const barcodePreview = getBarcodePreview()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Receive & Print</span>
          {!isConnected ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={connect}
              className="flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Connect Printer
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="w-4 h-4" />
              Printer Connected
            </div>
          )}
        </CardTitle>
        <CardDescription>
          Enter lot information and generate a GS1-128 label
        </CardDescription>
      </CardHeader>

      <CardContent>
        {!isConnected && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-yellow-900">
                ⚠️ Connect Printer to Enable Receiving
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                You must connect to a Zebra printer before receiving inventory
              </p>
            </div>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="productId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} ({product.sku})
                          {product.gtin ? (
                            <span className="text-xs text-green-600 ml-2">✓ GTIN</span>
                          ) : (
                            <span className="text-xs text-red-600 ml-2">⚠ No GTIN</span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="quantityReceived"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity *</FormLabel>
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

              <FormField
                control={form.control}
                name="receivedDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Received Date *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="originCountry"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country of Origin *</FormLabel>
                  <FormControl>
                    <Input placeholder="USA, Mexico, etc." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="growerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grower ID (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="G-12345" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {barcodePreview && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm font-medium text-blue-900 mb-2">
                  📊 GS1-128 Barcode Preview
                </p>
                <div className="font-mono text-xs text-blue-800 space-y-1">
                  <div>(01) {barcodePreview.gtin}</div>
                  <div>(17) {barcodePreview.expiry}</div>
                  <div>(10) {barcodePreview.lot}</div>
                </div>
              </div>
            )}

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="text-sm text-green-700 bg-green-50 p-3 rounded flex items-start gap-2">
                <CheckCircle className="w-4 h-4 mt-0.5" />
                <span>{success}</span>
              </div>
            )}

            <Button type="submit" disabled={!isConnected || isPending} className="w-full">
              {isPending ? "Receiving..." : "Receive & Print"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
