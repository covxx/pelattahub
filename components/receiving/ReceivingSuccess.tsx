"use client"

import { Button } from "@/components/ui/button"
import { generateProduceLabel } from "@/lib/zpl-generator"
import { printZplViaBrowser } from "@/lib/print-service"
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

  const handlePrint = () => {
    try {
      // Generate ZPL string
      const zplString = generateProduceLabel(lotData)

      // Print via browser's native print dialog
      printZplViaBrowser(zplString, {
        windowTitle: `Label - Lot ${lotData.lot_number || ""}`,
      })

      // Show instruction toast
      toast("Print dialog opened. Select your ZPL/Generic/Text printer driver.", "info")
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to open print window. Please allow popups."
      toast(errorMessage, "error")
    }
  }

  return (
    <>
      <div className="space-y-4">
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            💡 Click "Print Label" to open the browser print dialog. Select your ZPL or Generic/Text printer.
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

