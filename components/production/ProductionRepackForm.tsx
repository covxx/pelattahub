"use client"

import { useState, useTransition, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { ProductCombobox } from "@/components/receiving/ProductCombobox"
import { UnitToggle } from "@/components/rugged/UnitToggle"
import { convertInventory, batchConvertInventory, getLotByLotNumber } from "@/app/actions/production"
import { useToast } from "@/hooks/useToast"
import { printZplViaBrowser } from "@/lib/print-service"
import { generatePTILabel } from "@/lib/zpl-generator"
import { format } from "date-fns"
import { Package, ArrowRight, Printer, Plus, X } from "lucide-react"
import type { Product } from "@/types/product"
import { getCompanySettings } from "@/app/actions/settings"

interface ProductionRepackFormProps {
  products: Product[]
}

interface SourceLot {
  id: string
  lot_number: string
  quantity_current: number
  expiry_date: Date | string
  product: {
    id: string
    name: string
    sku: string
    unit_type: string
  }
}

interface SourceLotEntry {
  lot: SourceLot
  quantityConsumed: number
}

export function ProductionRepackForm({ products }: ProductionRepackFormProps) {
  const [sourceLotNumber, setSourceLotNumber] = useState("")
  const [sourceLots, setSourceLots] = useState<SourceLotEntry[]>([])
  const [outputProductId, setOutputProductId] = useState<string>("")
  const [quantityProduced, setQuantityProduced] = useState<number>(0)
  const [unitType, setUnitType] = useState<"CASE" | "LBS">("CASE")
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()
  const [companySettings, setCompanySettings] = useState<{
    name: string
    address: string
  } | null>(null)

  // Load company settings for label generation
  useEffect(() => {
    getCompanySettings().then((settings) => {
      setCompanySettings({
        name: settings.name || "Fresh Produce Co.",
        address: settings.address || "123 Farm Road, CA 90210",
      })
    })
  }, [])

  const handleScanSourceLot = () => {
    if (!sourceLotNumber.trim()) {
      toast("Please enter a lot number", "error")
      return
    }

    // Check if lot is already added
    const lotNumber = sourceLotNumber.trim()
    if (sourceLots.some((entry) => entry.lot.lot_number === lotNumber)) {
      toast("This lot is already added", "error")
      setSourceLotNumber("")
      return
    }

    startTransition(async () => {
      const result = await getLotByLotNumber(lotNumber)
      if (result.success && result.data) {
        const newLot = result.data as SourceLot
        setSourceLots([
          ...sourceLots,
          {
            lot: newLot,
            quantityConsumed: newLot.quantity_current,
          },
        ])
        setSourceLotNumber("")
        toast("Lot added", "success")
      } else {
        toast(result.error || "Lot not found", "error")
      }
    })
  }

  const handleRemoveSourceLot = (lotNumber: string) => {
    setSourceLots(sourceLots.filter((entry) => entry.lot.lot_number !== lotNumber))
  }

  const handleUpdateQuantityConsumed = (lotNumber: string, quantity: number) => {
    setSourceLots(
      sourceLots.map((entry) =>
        entry.lot.lot_number === lotNumber
          ? { ...entry, quantityConsumed: quantity }
          : entry
      )
    )
  }

  const handleRunProduction = () => {
    if (sourceLots.length === 0) {
      toast("Please add at least one source lot", "error")
      return
    }

    if (!outputProductId) {
      toast("Please select a finished product", "error")
      return
    }

    if (quantityProduced <= 0) {
      toast("Quantity produced must be greater than zero", "error")
      return
    }

    // Validate all source lots
    for (const entry of sourceLots) {
      if (entry.quantityConsumed <= 0) {
        toast(`Quantity to consume for ${entry.lot.lot_number} must be greater than zero`, "error")
        return
      }

      if (entry.quantityConsumed > entry.lot.quantity_current) {
        toast(
          `Cannot consume more than available quantity for ${entry.lot.lot_number} (${entry.lot.quantity_current})`,
          "error"
        )
        return
      }
    }

    startTransition(async () => {
      try {
        // Use batch conversion for multiple source lots, or single conversion for one
        let destinationLot: any = null

        if (sourceLots.length === 1) {
          // Single source lot - use original convertInventory
          const result = await convertInventory({
            sourceLotId: sourceLots[0].lot.id,
            outputProductId,
            quantityConsumed: sourceLots[0].quantityConsumed,
            quantityProduced,
            unitType,
          })

          if (!result.success || !result.data) {
            toast(result.error || "Failed to process production", "error")
            return
          }

          destinationLot = result.data.lot
        } else {
          // Multiple source lots - use batch conversion
          const result = await batchConvertInventory({
            sourceLots: sourceLots.map((entry) => ({
              sourceLotId: entry.lot.id,
              quantityConsumed: entry.quantityConsumed,
            })),
            outputProductId,
            quantityProduced,
            unitType,
          })

          if (!result.success || !result.data) {
            toast(result.error || "Failed to process production", "error")
            return
          }

          destinationLot = result.data.lot
        }

        // Print label
        try {
          const outputProduct = products.find((p) => p.id === outputProductId)
          if (outputProduct && companySettings) {
            const zpl = generatePTILabel(
              {
                lot_number: destinationLot.lot_number,
                received_date: destinationLot.received_date,
              },
              {
                name: outputProduct.name,
                gtin: outputProduct.gtin,
                unit_type: outputProduct.unit_type || unitType,
              },
              companySettings,
              {
                unitType: unitType,
                origin: destinationLot.origin_country,
                caseWeight: outputProduct.standard_case_weight || undefined,
              }
            )
            printZplViaBrowser(zpl, { windowTitle: `Label - ${destinationLot.lot_number}` })
            toast("Print dialog opened. Select your ZPL/Generic/Text printer driver.", "info")
          }
        } catch (printError) {
          console.error("Failed to print label:", printError)
          // Don't fail the whole operation if printing fails
        }

        toast("Production run completed successfully!", "success")

        // Reset form
        setSourceLotNumber("")
        setSourceLots([])
        setOutputProductId("")
        setQuantityProduced(0)
      } catch (error) {
        console.error("Error in production:", error)
        toast("Failed to run production", "error")
      }
    })
  }


  return (
    <div className="space-y-6">
      {/* Split Screen Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Panel - Source */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Source Lot
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sourceLot" className="text-lg font-semibold">
                Scan Source Lot
              </Label>
              <div className="flex gap-2">
                <Input
                  id="sourceLot"
                  type="text"
                  placeholder="Enter or scan lot number..."
                  value={sourceLotNumber}
                  onChange={(e) => setSourceLotNumber(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleScanSourceLot()
                    }
                  }}
                  className="text-xl h-14"
                  disabled={isPending}
                />
                <Button
                  onClick={handleScanSourceLot}
                  disabled={isPending || !sourceLotNumber.trim()}
                  size="lg"
                  className="h-14"
                >
                  Scan
                </Button>
              </div>
            </div>

            {sourceLots.length > 0 && (
              <div className="mt-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">Source Lots ({sourceLots.length})</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (sourceLotNumber.trim()) {
                        handleScanSourceLot()
                      }
                    }}
                    disabled={isPending || !sourceLotNumber.trim()}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Another
                  </Button>
                </div>

                <div className="space-y-3">
                  {sourceLots.map((entry, index) => (
                    <div
                      key={entry.lot.id}
                      className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2 text-sm">
                          <div className="font-semibold text-base">
                            Lot #{entry.lot.lot_number}
                          </div>
                          <div>
                            <span className="font-medium">Product:</span> {entry.lot.product.name}
                          </div>
                          <div>
                            <span className="font-medium">SKU:</span> {entry.lot.product.sku}
                          </div>
                          <div>
                            <span className="font-medium">Available:</span>{" "}
                            {entry.lot.quantity_current} {entry.lot.product.unit_type}
                          </div>
                          <div>
                            <span className="font-medium">Expiry:</span>{" "}
                            {format(new Date(entry.lot.expiry_date), "MMM dd, yyyy")}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveSourceLot(entry.lot.lot_number)}
                          disabled={isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="pt-3 border-t">
                        <Label
                          htmlFor={`quantity-${entry.lot.id}`}
                          className="text-sm font-semibold"
                        >
                          Quantity to Consume
                        </Label>
                        <Input
                          id={`quantity-${entry.lot.id}`}
                          type="number"
                          min="1"
                          max={entry.lot.quantity_current}
                          value={entry.quantityConsumed}
                          onChange={(e) =>
                            handleUpdateQuantityConsumed(
                              entry.lot.lot_number,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="text-lg h-10 mt-1"
                          disabled={isPending}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Max: {entry.lot.quantity_current} {entry.lot.product.unit_type}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Panel - Destination */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRight className="h-5 w-5" />
              Finished Product
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-lg font-semibold">Select Finished Product</Label>
              <ProductCombobox
                products={products}
                value={outputProductId}
                onValueChange={setOutputProductId}
                disabled={isPending}
              />
            </div>

            {outputProductId && (
              <div className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="quantityProduced" className="text-base font-semibold">
                    Quantity Produced
                  </Label>
                  <Input
                    id="quantityProduced"
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={quantityProduced}
                    onChange={(e) => setQuantityProduced(parseFloat(e.target.value) || 0)}
                    className="text-xl h-12"
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-base font-semibold">Unit Type</Label>
                  <UnitToggle value={unitType} onChange={setUnitType} disabled={isPending} />
                </div>

                {sourceLots.length > 0 &&
                  sourceLots.reduce((sum, e) => sum + e.quantityConsumed, 0) > 0 &&
                  quantityProduced > 0 && (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                      <div className="text-sm">
                        <span className="font-medium">Total Consumed:</span>{" "}
                        <span className="text-lg font-bold">
                          {sourceLots.reduce((sum, e) => sum + e.quantityConsumed, 0)}
                        </span>
                      </div>
                      <div className="text-sm mt-2">
                        <span className="font-medium">Yield Efficiency:</span>{" "}
                        <span className="text-lg font-bold">
                          {(
                            (quantityProduced /
                              sourceLots.reduce((sum, e) => sum + e.quantityConsumed, 0)) *
                            100
                          ).toFixed(1)}
                          %
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {quantityProduced} {unitType} produced from{" "}
                        {sourceLots.reduce((sum, e) => sum + e.quantityConsumed, 0)} total
                        consumed ({sourceLots.length} lot{sourceLots.length > 1 ? "s" : ""})
                      </p>
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer - Action Button */}
      <Card>
        <CardContent className="pt-6">
          <Button
            onClick={handleRunProduction}
            disabled={
              isPending ||
              sourceLots.length === 0 ||
              !outputProductId ||
              sourceLots.some((e) => e.quantityConsumed <= 0) ||
              quantityProduced <= 0
            }
            size="lg"
            className="w-full h-14 text-lg font-semibold"
          >
            <Printer className="h-5 w-5 mr-2" />
            Run Production & Print Labels
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

