"use client"

import { Button } from "@/components/ui/button"
import { usePrintLabel } from "@/hooks/usePrintLabel"
import { useToast } from "@/hooks/useToast"
import { ToastContainer } from "@/components/ui/toast"
import { Printer } from "lucide-react"
import type { LotData } from "@/types/lot"

interface ReceivingSuccessProps {
  lotData: LotData
  onClose?: () => void
}

export function ReceivingSuccess({ lotData, onClose }: ReceivingSuccessProps) {
  const { toasts, toast, removeToast } = useToast()
  const { printLabel: printCaseLabel } = usePrintLabel('case')

  const handlePrint = () => {
    try {
      if (!lotData.product.gtin) {
        toast("Product GTIN is required for case label printing", "error")
        return
      }

      // Prepare lot data for case label PDF
      const lotForLabel = {
        lot_number: lotData.lot_number,
        received_date: lotData.received_date,
        expiry_date: lotData.expiry_date
      }

      const productForLabel = {
        name: lotData.product.name,
        gtin: lotData.product.gtin,
        variety: lotData.product.variety || null
      }

      printCaseLabel({
        lot: lotForLabel,
        product: productForLabel
      })

      toast("Generating PDF label...", "info")
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to generate PDF label."
      toast(errorMessage, "error")
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 Click "Print Label" to generate and print a PDF label.
          </p>
        </div>

        <Button onClick={handlePrint} className="w-full" size="lg">
          <Printer className="h-4 w-4 mr-2" />
          Print Label
        </Button>

        {onClose && (
          <Button onClick={onClose} variant="outline" className="w-full">
            Close
          </Button>
        )}
      </div>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}

