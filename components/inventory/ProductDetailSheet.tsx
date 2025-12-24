"use client"

import { useState, useEffect } from "react"
import { format, formatDistanceToNow } from "date-fns"
import { parseDate } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Printer, Edit, History, X, Package } from "lucide-react"
import { getCompanySettings } from "@/app/actions/settings"
import { getLotWithReceivingEvent } from "@/app/actions/inventory"
import { usePrintLabel } from "@/hooks/usePrintLabel"
import { useToast } from "@/hooks/useToast"
import { ToastContainer } from "@/components/ui/toast"
import { InventoryAdjustmentDialog } from "./InventoryAdjustmentDialog"
import { LotLifecycleSheet } from "./LotLifecycleSheet"

interface ProductDetailSheetProps {
  product: {
    id: string
    sku: string
    name: string
    variety: string | null
    gtin: string | null
    unit_type: string
    standard_case_weight: number | null
    total_on_hand: number
    active_lot_count: number
    lots: Array<{
      id: string
      lot_number: string
      quantity_received: number
      quantity_current: number
      received_date: Date | string
      expiry_date: Date | string
      origin_country: string
      status: string
    }>
  } | null
  open: boolean
  onClose: () => void
}

export function ProductDetailSheet({
  product,
  open,
  onClose,
}: ProductDetailSheetProps) {
  const [companySettings, setCompanySettings] = useState<any>(null)
  const [selectedLotForAdjust, setSelectedLotForAdjust] = useState<string | null>(null)
  const [selectedLotForLifecycle, setSelectedLotForLifecycle] = useState<string | null>(null)
  const { toast, toasts, removeToast } = useToast()
  
  // PDF printing hooks
  const { printLabel: printPalletLabel } = usePrintLabel('pallet')
  const { printLabel: printCaseLabel } = usePrintLabel('case')

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

  if (!product) return null

  // Find the selected lot for adjustment dialog
  const selectedLot = selectedLotForAdjust && product
    ? product.lots.find(l => l.id === selectedLotForAdjust)
    : null

  const handlePrintLabel = (lot: any) => {
    if (!product.gtin) {
      toast("Product GTIN is required for case label printing", "error")
      return
    }

    try {
      // Prepare lot data for case label PDF
      const lotForLabel = {
            lot_number: lot.lot_number,
            received_date: lot.received_date,
        expiry_date: lot.expiry_date
      }

      const productForLabel = {
            name: product.name,
            gtin: product.gtin,
        variety: product.variety || null
      }

      printCaseLabel({
        lot: lotForLabel,
        product: productForLabel,
        companySettings: companySettings || undefined
      })

      toast("Generating PDF label...", "info")
    } catch (err) {
      toast(
        `Print failed: ${err instanceof Error ? err.message : "Failed to generate PDF label"}`,
        "error"
      )
    }
  }

  const handlePrintPalletLabel = async (lot: any) => {
    try {
      // Fetch lot with receiving event info
      const lotWithEvent = await getLotWithReceivingEvent(lot.id)
      
      if (!lotWithEvent) {
        toast("Lot not found", "error")
        return
      }

      if (!lotWithEvent.receivingEvent) {
        toast("Receiving event information not available for this lot", "error")
        return
      }

      // Prepare lot data for pallet label PDF
      const lotForLabel = {
        lot_number: lotWithEvent.lot_number,
        received_date: lotWithEvent.received_date,
        original_quantity: lotWithEvent.quantity_received || lotWithEvent.quantity_current,
        quantity_current: lotWithEvent.quantity_current,
        receivingEvent: {
          vendor: lotWithEvent.receivingEvent.vendor
        }
      }

      const productForLabel = {
        name: product.name,
        unit_type: product.unit_type || "CASE",
        gtin: product.gtin || undefined
      }

      printPalletLabel({
        lot: lotForLabel,
        product: productForLabel
      })

      toast("Generating PDF label...", "info")
    } catch (err) {
      toast(
        `Print failed: ${err instanceof Error ? err.message : "Failed to generate PDF label"}`,
        "error"
      )
    }
  }

  const getExpiryStatus = (expiryDate: Date | string) => {
    const now = new Date()
    const expiry = new Date(expiryDate)
    const daysLeft = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysLeft < 0) return { status: "expired", color: "bg-red-500", text: "Expired" }
    if (daysLeft <= 3) return { status: "critical", color: "bg-yellow-500", text: `${daysLeft}d left` }
    return { status: "ok", color: "bg-green-500", text: `${daysLeft}d left` }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onClose}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <SheetTitle className="text-3xl font-bold">
                  {product.name}
                </SheetTitle>
                {product.variety && (
                  <p className="text-lg text-muted-foreground">
                    {product.variety}
                  </p>
                )}
                <div className="flex gap-3 text-sm text-muted-foreground font-mono">
                  <span>SKU: {product.sku}</span>
                  {product.gtin && <span>GTIN: {product.gtin}</span>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>

          {/* Stat Card */}
          <div className="mt-6 p-6 bg-primary/5 rounded-lg border">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total On Hand</p>
              <p className="text-5xl font-bold text-primary">
                {product.total_on_hand}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {product.unit_type} across {product.active_lot_count} lot(s)
              </p>
            </div>
          </div>

          {/* Lots Table */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-3">Active Lots</h3>
            
            {product.lots.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No active lots for this product
              </div>
            ) : (
              <div className="space-y-3">
                {product.lots.map((lot) => {
                  const expiryInfo = getExpiryStatus(lot.expiry_date)
                  // Use utility function to parse date consistently
                  const receivedDate = parseDate(lot.received_date)

                  return (
                    <div
                      key={lot.id}
                      className="border rounded-lg overflow-hidden transition-all"
                    >
                      <div className="p-4 hover:bg-accent/50 transition-colors">
                        {/* Lot Header */}
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="font-mono text-lg font-semibold">
                              {lot.lot_number}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Received {format(receivedDate, "MMM dd, yyyy 'at' h:mm a")}
                            </p>
                          </div>
                          <Badge
                            className={`${expiryInfo.color} text-white`}
                          >
                            {expiryInfo.text}
                          </Badge>
                        </div>

                        {/* Lot Stats */}
                        <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Current Qty</p>
                            <p className="font-semibold text-lg">
                              {lot.quantity_current}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Original Qty</p>
                            <p className="font-semibold">
                              {lot.quantity_received}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Expires</p>
                            <p className="font-semibold">
                              {format(new Date(lot.expiry_date), "MMM dd, yyyy")}
                            </p>
                          </div>
                        </div>

                        {/* Lot Actions */}
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handlePrintLabel(lot)}
                            className="flex-1"
                          >
                            <Printer className="h-4 w-4 mr-2" />
                            Print Label
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrintPalletLabel(lot)}
                            className="flex-1"
                          >
                            <Package className="h-4 w-4 mr-2" />
                            Print Pallet
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedLotForAdjust(lot.id)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Adjust
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedLotForLifecycle(lot.id)}
                          >
                            <History className="h-4 w-4 mr-2" />
                            History
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Inventory Adjustment Dialog */}
      {selectedLot && product && (
        <InventoryAdjustmentDialog
          lot={{
            id: selectedLot.id,
            lot_number: selectedLot.lot_number,
            quantity_current: selectedLot.quantity_current,
          }}
          productName={product.name} // Ensure this is passed!
          productSku={product.sku}
          productUnitType={product.unit_type}
          open={!!selectedLotForAdjust}
          onOpenChange={(open) => !open && setSelectedLotForAdjust(null)}
          onSuccess={() => {
            // Refresh the product data or show success message
            toast("Inventory adjusted successfully", "success")
          }}
        />
      )}

      {/* Lot Lifecycle Sheet */}
      <LotLifecycleSheet
        lotId={selectedLotForLifecycle}
        open={!!selectedLotForLifecycle}
        onOpenChange={(open) => !open && setSelectedLotForLifecycle(null)}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}


