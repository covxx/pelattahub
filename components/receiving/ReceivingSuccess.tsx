"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useZebraPrinter } from "@/contexts/ZebraPrinterContext"
import { generateProduceLabel } from "@/lib/zpl-generator"
import { useToast } from "@/hooks/useToast"
import { ToastContainer } from "@/components/ui/toast"
import { Printer, Plug } from "lucide-react"
import type { LotData } from "@/types/lot"

interface ReceivingSuccessProps {
  lotData: LotData
  onClose?: () => void
}

export function ReceivingSuccess({ lotData, onClose }: ReceivingSuccessProps) {
  const { isConnected, isSupported, connect, print, error } = useZebraPrinter()
  const { toasts, toast, removeToast } = useToast()
  const [isConnecting, setIsConnecting] = useState(false)
  const [isPrinting, setIsPrinting] = useState(false)

  const handleConnect = async () => {
    setIsConnecting(true)
    try {
      await connect()
      toast("Connected to Zebra printer", "success")
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to connect to printer. Please try again."
      toast(errorMessage, "error")
    } finally {
      setIsConnecting(false)
    }
  }

  const handlePrint = async () => {
    if (!isConnected) {
      toast("Please connect to printer first", "error")
      return
    }

    setIsPrinting(true)
    try {
      // Generate ZPL string
      const zplString = generateProduceLabel(lotData)

      // Print directly to connected printer
      await print(zplString)

      toast("Sent to Printer", "success")
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to print label. Please check the printer connection."
      toast(errorMessage, "error")
    } finally {
      setIsPrinting(false)
    }
  }

  if (!isSupported) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-950">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Web Serial API is not supported in this browser. Please use Chrome, Edge, or another
            Chromium-based browser. Also ensure you are using HTTPS or localhost.
          </p>
        </div>
        {onClose && (
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {!isConnected ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Connect to your Zebra printer to print labels directly via USB.
            </p>
            <Button
              onClick={handleConnect}
              disabled={isConnecting}
              className="w-full"
              size="lg"
            >
              <Plug className="h-4 w-4 mr-2" />
              {isConnecting ? "Connecting..." : "🔌 Connect to Zebra Printer"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-950">
              <p className="text-sm text-green-800 dark:text-green-200">
                ✓ Connected to Zebra printer
              </p>
            </div>
            <Button
              onClick={handlePrint}
              disabled={isPrinting}
              className="w-full"
              size="lg"
            >
              <Printer className="h-4 w-4 mr-2" />
              {isPrinting ? "Printing..." : "Print Label"}
            </Button>
          </div>
        )}

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

