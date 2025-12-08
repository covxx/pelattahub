"use client"

import React, { useState, useTransition, useEffect } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { useToast } from "@/hooks/useToast"
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card"
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
import { Plus, X, Printer, FileText, ChevronDown, Package, Weight, History } from "lucide-react"
import { useRouter } from "next/navigation"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Label } from "@/components/ui/label"
import { ToastContainer } from "@/components/ui/toast"
import { RuggedInput } from "@/components/rugged/RuggedInput"
import { UnitToggle } from "@/components/rugged/UnitToggle"
import { BigButton } from "@/components/rugged/BigButton"
import { FlashConfirmation } from "@/components/receiving/FlashConfirmation"
import { ReceivingReceiptPDF } from "@/components/documents/ReceivingReceiptPDF"
import { PDFViewerModal } from "@/components/documents/PDFViewerModal"
import { VendorCombobox } from "@/components/receiving/VendorCombobox"
import { ProductCombobox } from "@/components/receiving/ProductCombobox"
import { receiveBatchInventory } from "@/app/actions/receiving"
import { getCompanySettings } from "@/app/actions/settings"
import { generateCaseLabel, generateMasterLabel, generatePTILabel } from "@/lib/zpl-generator"
import { printZplViaBrowser } from "@/lib/print-service"
import type { Product, UnitType } from "@/types/product"
import type { Vendor } from "@/types/receiving"

const receivingSchema = z.object({
  date: z.string().min(1, "Date is required"),
  vendorId: z.string().min(1, "Vendor is required"),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "Product is required"),
        quantity: z.number({ message: "Amount must be a valid number" }).min(0.01, "Amount must be greater than 0"),
        unitType: z.enum(["CASE", "LBS", "EACH"]),
      }).superRefine((data, ctx) => {
        if (data.unitType === "CASE" || data.unitType === "EACH") {
          if (!Number.isInteger(data.quantity) || data.quantity < 1) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Amount must be a whole number (1 or greater)",
              path: ["quantity"]
            })
          }
        } else {
          if (data.quantity < 0.01) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: "Amount must be greater than 0",
              path: ["quantity"]
            })
          }
        }
      })
    )
    .min(1, "At least one item is required"),
})

type ReceivingFormValues = z.infer<typeof receivingSchema>

interface BatchReceivingFormProps {
  products: Product[]
  vendors: Vendor[]
  topVendors: Vendor[]
}

function LotPrintOptions({ lot, onPrintMaster, onPrintCases }: any) {
  const [caseQty, setCaseQty] = useState(lot.original_quantity)
  const [isOpen, setIsOpen] = useState(false)

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Printer className="h-3 w-3 mr-1" />
          Print
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Print Options</h4>
          </div>

          {/* Master Pallet Tag */}
          <div className="space-y-2">
            <Label>Master Pallet Tag</Label>
            <Button
              size="sm"
              className="w-full"
              onClick={() => {
                onPrintMaster()
                setIsOpen(false)
              }}
            >
              <Printer className="h-3 w-3 mr-2" />
              Print 1 Pallet Tag
            </Button>
            <p className="text-xs text-muted-foreground">
              Large tag for outside of pallet
            </p>
          </div>

          <div className="border-t pt-4 space-y-2">
            <Label htmlFor={`case-qty-${lot.id}`}>Case Labels</Label>
            <div className="flex gap-2">
              <Input
                id={`case-qty-${lot.id}`}
                type="number"
                min="1"
                value={caseQty}
                onChange={(e) => setCaseQty(parseInt(e.target.value) || 1)}
                className="w-24"
              />
              <Button
                size="sm"
                className="flex-1"
                onClick={() => {
                  onPrintCases(caseQty)
                  setIsOpen(false)
                }}
              >
                <Printer className="h-3 w-3 mr-2" />
                Print {caseQty} Labels
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Individual stickers for each box/case
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function BatchReceivingForm({
  products,
  vendors,
  topVendors,
}: BatchReceivingFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [receivingEvent, setReceivingEvent] = useState<any | null>(null)
  const [buttonState, setButtonState] = useState<"normal" | "loading" | "success">("normal")
  const [showFlash, setShowFlash] = useState(false)
  const [lastLotNumber, setLastLotNumber] = useState<string>("")
  const [companySettings, setCompanySettings] = useState<any>(null)
  const [showPDFModal, setShowPDFModal] = useState(false)
  const { toast, toasts, removeToast } = useToast()

  const today = new Date().toISOString().split("T")[0]

  // Fetch company settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settings = await getCompanySettings()
        setCompanySettings(settings)
      } catch (err) {
        console.error("Failed to load company settings:", err)
      }
    }
    fetchSettings()
  }, [])

  const form = useForm<ReceivingFormValues>({
    resolver: zodResolver(receivingSchema),
    defaultValues: {
      date: today,
      vendorId: "",
      items: [{ productId: "", quantity: 1, unitType: "CASE" }],
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const onSubmit = async (data: ReceivingFormValues) => {
    setError(null)
    setButtonState("loading")
    startTransition(async () => {
      try {
        // Use current date/time when receiving (not just date at midnight)
        // This ensures we track the exact time of receipt
        const receivedDateTime = new Date()
        
        const result = await receiveBatchInventory({
          date: receivedDateTime,
          vendorId: data.vendorId,
          items: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
        })

        if (result.success && result.receivingEvent) {
          setButtonState("success")
          
          // Get first lot number for flash display
          if (result.receivingEvent.lots && result.receivingEvent.lots.length > 0) {
            setLastLotNumber(result.receivingEvent.lots[0].lot_number)
          }
          
          // Show flash confirmation
          setShowFlash(true)
          
          // After flash completes, show receipt (reduced from 1800ms to 1000ms)
          setTimeout(() => {
            setReceivingEvent(result.receivingEvent)
            setButtonState("normal")
            setShowFlash(false)
          }, 1000)
        } else {
          setError(result.error || "Failed to process receiving")
          setButtonState("normal")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred")
        setButtonState("normal")
      }
    })
  }

  const handlePrintMaster = (lot: any) => {
    try {
      // Use master pallet label (4x6) - always use master label for pallets
      // Ensure lot has receivingEvent with vendor
      const lotWithVendor = {
        ...lot,
        receivingEvent: receivingEvent ? {
          vendor: receivingEvent.vendor
        } : undefined
      }
      const zpl = generateMasterLabel(lotWithVendor, lot.product)
      
      printZplViaBrowser(zpl, { windowTitle: `Label - ${lot.lot_number}` })
      
      // Show instruction toast
      toast("Print dialog opened. Select your ZPL/Generic/Text printer driver.", "info")
    } catch (err) {
      console.error("Failed to print label:", err)
      toast(
        err instanceof Error ? err.message : "Failed to open print window. Please allow popups.",
        "error"
      )
    }
  }

  const handlePrintCases = (lot: any, quantity: number) => {
    try {
      // Use PTI label if company settings are loaded
      let baseZpl
      if (companySettings) {
        baseZpl = generatePTILabel(
          lot,
          lot.product,
          companySettings,
          {
            caseWeight: lot.product.standard_case_weight,
            unitType: lot.product.unit_type,
            origin: lot.origin_country,
          }
        )
      } else {
        // Fallback to standard case label
        baseZpl = generateCaseLabel(lot, lot.product)
      }
      
      // Insert the print quantity command before ^XZ (end of label)
      const zpl = baseZpl.replace(/\^XZ$/, `^PQ${quantity},0,1,Y^XZ`)
      printZplViaBrowser(zpl, { windowTitle: `Case Labels - ${lot.lot_number}` })
      
      // Show instruction toast
      toast("Print dialog opened. Select your ZPL/Generic/Text printer driver.", "info")
    } catch (err) {
      console.error("Failed to print case labels:", err)
      toast(
        err instanceof Error ? err.message : "Failed to open print window. Please allow popups.",
        "error"
      )
    }
  }

  const handlePrintAllMasters = () => {
    if (!receivingEvent?.lots) return

    try {
      // Concatenate all ZPL strings into one print job
      const allZpl = receivingEvent.lots
        .map((lot: any) => {
          // Use PTI label if company settings are loaded
          if (companySettings) {
            return generatePTILabel(
              lot,
              lot.product,
              companySettings,
              {
                caseWeight: lot.product.standard_case_weight,
                unitType: lot.product.unit_type,
                origin: lot.origin_country,
              }
            )
          } else {
            // Fallback to master label
            return generateMasterLabel(lot, lot.product)
          }
        })
        .join('\n\n')
      
      printZplViaBrowser(allZpl, { windowTitle: "All Labels" })
      
      // Show instruction toast
      toast(
        `Printing ${receivingEvent.lots.length} label(s). Select your ZPL/Generic/Text printer.`,
        "info"
      )
    } catch (err) {
      console.error("Failed to print labels:", err)
      toast(
        err instanceof Error ? err.message : "Failed to open print window. Please allow popups.",
        "error"
      )
    }
  }

  const handlePrintReceipt = () => {
    if (!companySettings) {
      toast("Loading company settings...", "info")
      return
    }
    setShowPDFModal(true)
  }

  const handleNewReceiving = () => {
    setReceivingEvent(null)
    setButtonState("normal")
    form.reset({
      date: today,
      vendorId: "",
      items: [{ productId: "", quantity: 1, unitType: "CASE" }],
    })
  }

  // If we have a completed receiving event, show the receipt
  if (receivingEvent) {
    return (
      <div className="space-y-6">
        {/* Action buttons - no print */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-green-600">
              ✓ Receiving Complete
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Receipt #: <span className="font-mono font-bold">{receivingEvent.id.slice(0, 8).toUpperCase()}</span>
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleNewReceiving}>
              New Receiving
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard/receiving/history")}
            >
              <History className="h-4 w-4 mr-2" />
              View History
            </Button>
            <Button variant="outline" onClick={handlePrintReceipt}>
              <FileText className="h-4 w-4 mr-2" />
              Print Receipt
            </Button>
            <Button onClick={handlePrintAllMasters}>
              <Printer className="h-4 w-4 mr-2" />
              Print All Pallet Tags
            </Button>
          </div>
        </div>

        {/* PDF Modal */}
        {receivingEvent && showPDFModal && (
          <PDFViewerModal
            open={showPDFModal}
            onOpenChange={setShowPDFModal}
            pdfUrl={`/api/receipt/pdf?eventId=${receivingEvent.id}`}
            filename={`Receiving_Receipt_${receivingEvent.id.slice(0, 8).toUpperCase()}.pdf`}
            title={`Receiving Receipt #${receivingEvent.id.slice(0, 8).toUpperCase()}`}
          />
        )}

        {/* Interactive summary table */}
        <Card>
          <CardHeader>
            <CardTitle>Receiving Summary</CardTitle>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>Vendor:</strong> {receivingEvent.vendor.name}
              </p>
              <p>
                <strong>Date:</strong>{" "}
                {new Date(receivingEvent.received_date).toLocaleDateString()}
              </p>
              <p>
                <strong>Received By:</strong> {receivingEvent.user?.name}
              </p>
            </div>
          </CardHeader>
          <CardContent>
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Lot Number</th>
                  <th className="text-left py-2">Product</th>
                  <th className="text-left py-2">SKU</th>
                  <th className="text-right py-2">Quantity</th>
                  <th className="text-left py-2">Unit</th>
                  <th className="text-left py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {receivingEvent.lots.map((lot: any) => (
                  <tr key={lot.id} className="border-b">
                    <td className="font-mono text-sm py-3">{lot.lot_number}</td>
                    <td className="py-3">{lot.product.name}</td>
                    <td className="font-mono text-sm py-3">{lot.product.sku}</td>
                    <td className="text-right py-3">{lot.original_quantity}</td>
                    <td className="py-3">{lot.product.unit_type}</td>
                    <td className="py-3">
                      <LotPrintOptions
                        lot={lot}
                        onPrintMaster={() => handlePrintMaster(lot)}
                        onPrintCases={(qty: number) => handlePrintCases(lot, qty)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-bold">
                  <td colSpan={3} className="py-3">Total Items:</td>
                  <td className="text-right py-3">{receivingEvent.lots.length}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>

        {/* Toast notifications */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>
    )
  }

  // Otherwise show the receiving form
  return (
    <Card>
      <CardHeader>
        <CardTitle>Batch Receiving</CardTitle>
        <CardAction>
          <Button
            variant="outline"
            size="default"
            onClick={() => router.push("/dashboard/receiving/history")}
          >
            <History className="h-4 w-4 mr-2" />
            View Receiving History
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Header Section */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xl font-semibold">Received Date *</FormLabel>
                    <FormControl>
                      <Input type="date" className="text-lg h-14" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xl font-semibold">Vendor *</FormLabel>
                    
                    {/* Smart Vendor Chips - Quick Select */}
                    {topVendors.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-2">
                        {topVendors.map((vendor) => (
                          <Button
                            key={vendor.id}
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 text-sm font-medium"
                            onClick={() => field.onChange(vendor.id)}
                          >
                            {vendor.code}
                          </Button>
                        ))}
                      </div>
                    )}
                    
                    <FormControl>
                      <VendorCombobox
                        vendors={vendors}
                        value={field.value}
                        onValueChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Line Items */}
            <div className="space-y-3">
              <h3 className="text-2xl font-bold mb-4">Items</h3>

              {fields.map((field, index) => {
                const selectedProduct = products.find(
                  (p) => p.id === form.watch(`items.${index}.productId`)
                )
                const currentUnitType = form.watch(`items.${index}.unitType`)
                const currentQuantity = form.watch(`items.${index}.quantity`)

                // Calculate estimation hints
                let estimationHint = ""
                if (selectedProduct?.standard_case_weight && currentQuantity > 0) {
                  if (currentUnitType === "CASE") {
                    const estWeight = currentQuantity * selectedProduct.standard_case_weight
                    estimationHint = `Est. Weight: ${estWeight.toFixed(2)} lbs`
                  } else if (currentUnitType === "LBS") {
                    const estCases = currentQuantity / selectedProduct.standard_case_weight
                    estimationHint = `Est. Cases: ${estCases.toFixed(2)}`
                  }
                }

                return (
                  <div key={field.id} className="border-2 border-gray-300 rounded-lg p-4 bg-white">
                    {/* Compact Row Layout */}
                    <div className="flex gap-4 items-start">
                      {/* Left 60%: Product Select */}
                      <div className="flex-[3]">
                        <FormField
                          control={form.control}
                          name={`items.${index}.productId`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <ProductCombobox
                                  products={products}
                                  value={field.value}
                                  onValueChange={(value) => {
                                    field.onChange(value)
                                    // Auto-switch unit type to product's default
                                    const product = products.find((p) => p.id === value)
                                    if (product) {
                                      form.setValue(`items.${index}.unitType`, product.unit_type as UnitType)
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Middle 20%: Unit Toggle */}
                      <div className="flex-1">
                        <FormField
                          control={form.control}
                          name={`items.${index}.unitType`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <UnitToggle
                                  value={field.value as "CASE" | "LBS"}
                                  onChange={(value) => field.onChange(value)}
                                  disabled={!selectedProduct}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Right 20%: Quantity Input */}
                      <div className="flex-1">
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  min={currentUnitType === "CASE" || currentUnitType === "EACH" ? "1" : "0.01"}
                                  step={currentUnitType === "LBS" ? "0.01" : "1"}
                                  placeholder="0"
                                  className="text-3xl h-16 text-center font-bold border-2"
                                  value={field.value ?? ""}
                                  onChange={(e) => {
                                    const inputValue = e.target.value
                                    if (inputValue === "" || inputValue === null) {
                                      field.onChange(undefined as any)
                                      return
                                    }
                                    const value = parseFloat(inputValue)
                                    if (!isNaN(value) && value >= 0) {
                                      if (currentUnitType === "CASE" || currentUnitType === "EACH") {
                                        field.onChange(Math.max(1, Math.round(value)))
                                      } else {
                                        field.onChange(Math.max(0.01, Math.round(value * 100) / 100))
                                      }
                                    }
                                  }}
                                  onBlur={(e) => {
                                    const value = parseFloat(e.target.value)
                                    if (isNaN(value) || value <= 0) {
                                      if (currentUnitType === "CASE" || currentUnitType === "EACH") {
                                        field.onChange(1)
                                      } else {
                                        field.onChange(0.01)
                                      }
                                    }
                                  }}
                                />
                              </FormControl>
                              {estimationHint && (
                                <p className="text-sm text-muted-foreground text-center mt-1 font-semibold">
                                  {estimationHint}
                                </p>
                              )}
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Far Right: Trash Icon */}
                      <div className="pt-1">
                        {fields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-16 w-16 text-destructive hover:bg-destructive/10"
                            onClick={() => remove(index)}
                          >
                            <X className="h-8 w-8" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Add Item Button - Full Width Dashed Border */}
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full h-16 text-xl border-2 border-dashed border-gray-400 hover:border-gray-600 hover:bg-gray-50"
                onClick={() => append({ productId: "", quantity: 1, unitType: "CASE" })}
              >
                <Plus className="h-6 w-6 mr-2" />
                Add Item
              </Button>
            </div>

            {error && (
              <div className="p-4 text-lg text-red-600 bg-red-50 border-2 border-red-200 rounded-lg font-semibold">
                {error}
              </div>
            )}

            <BigButton type="submit" state={buttonState}>
              {buttonState === "loading" && "Processing..."}
              {buttonState === "success" && "Success!"}
              {buttonState === "normal" && "Complete Receiving"}
            </BigButton>
          </form>
        </Form>
        
        {/* Flash Confirmation Overlay */}
        <FlashConfirmation 
          show={showFlash} 
          lotNumber={lastLotNumber}
        />

        {/* Toast notifications */}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </CardContent>
    </Card>
  )
}

