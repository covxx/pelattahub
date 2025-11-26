"use client"

import { useState, forwardRef } from "react"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { generateProduceLabel } from "@/lib/zpl-generator"
import type { LotData } from "@/types/lot"

interface PrintButtonProps {
  lotData: LotData
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg"
  className?: string
  disabled?: boolean
}

/**
 * PrintButton component that converts ZPL to PDF via Labelary API
 * and triggers the OS print dialog
 */
export const PrintButton = forwardRef<HTMLButtonElement, PrintButtonProps>(
  function PrintButton(
    {
      lotData,
      variant = "default",
      size = "default",
      className,
      disabled = false,
    },
    ref
  ) {
  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrint = async () => {
    if (isPrinting || disabled) return

    setIsPrinting(true)

    try {
      // Step 1: Generate ZPL string from lot data
      const zplString = generateProduceLabel(lotData)

      // Step 2: Convert ZPL to PDF using Labelary API
      // Labelary API: 8dpmm = 203 DPI, 4x6 = 4" x 6" label size
      const labelaryUrl = "https://api.labelary.com/v1/printers/8dpmm/labels/4x6/0/"
      
      const response = await fetch(labelaryUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain",
          "Accept": "application/pdf",
        },
        body: zplString,
      })

      if (!response.ok) {
        throw new Error(`Labelary API error: ${response.status} ${response.statusText}`)
      }

      // Step 3: Get PDF blob from response
      const pdfBlob = await response.blob()
      const pdfUrl = URL.createObjectURL(pdfBlob)

      // Step 4: Create hidden iframe and trigger print
      const iframe = document.createElement("iframe")
      iframe.style.position = "fixed"
      iframe.style.right = "0"
      iframe.style.bottom = "0"
      iframe.style.width = "0"
      iframe.style.height = "0"
      iframe.style.border = "0"
      iframe.src = pdfUrl

      document.body.appendChild(iframe)

      // Wait for iframe to load, then trigger print
      iframe.onload = () => {
        try {
          // Small delay to ensure PDF is fully loaded
          setTimeout(() => {
            if (iframe.contentWindow) {
              iframe.contentWindow.focus()
              iframe.contentWindow.print()
            }

            // Clean up: remove iframe after printing dialog is shown
            // (user may cancel, so we clean up after a delay)
            setTimeout(() => {
              document.body.removeChild(iframe)
              URL.revokeObjectURL(pdfUrl)
              setIsPrinting(false)
            }, 1000)
          }, 500)
        } catch (error) {
          console.error("Error triggering print:", error)
          document.body.removeChild(iframe)
          URL.revokeObjectURL(pdfUrl)
          setIsPrinting(false)
        }
      }

      // Fallback: if onload doesn't fire (some browsers), try after timeout
      setTimeout(() => {
        if (iframe.parentNode) {
          try {
            if (iframe.contentWindow) {
              iframe.contentWindow.focus()
              iframe.contentWindow.print()
            }
          } catch (error) {
            console.error("Error in print fallback:", error)
          }
          
          setTimeout(() => {
            if (iframe.parentNode) {
              document.body.removeChild(iframe)
              URL.revokeObjectURL(pdfUrl)
              setIsPrinting(false)
            }
          }, 1000)
        }
      }, 2000)

    } catch (error) {
      console.error("Error printing label:", error)
      alert(`Failed to print label: ${error instanceof Error ? error.message : "Unknown error"}`)
      setIsPrinting(false)
    }
  }

    return (
      <Button
        ref={ref}
        onClick={handlePrint}
        disabled={disabled || isPrinting}
        variant={variant}
        size={size}
        className={className}
      >
        <Printer className="h-4 w-4" />
        {isPrinting ? "Printing..." : "Print Label"}
      </Button>
    )
  }
)

