"use client"

import { useState, useCallback } from 'react'
import { PalletLabelPdf } from '@/components/printing/templates/PalletLabelPdf'
import { CaseLabelPdf } from '@/components/printing/templates/CaseLabelPdf'
import React from 'react'

/**
 * Label data types for different label formats
 */
export interface PalletLabelData {
  lot: {
    lot_number: string
    received_date: Date | string
    original_quantity?: number
    quantity_current?: number
    receivingEvent?: {
      vendor?: {
        name: string
        code?: string
      }
    }
  }
  product: {
    name: string
    unit_type?: string
    gtin?: string
  }
}

export interface CaseLabelData {
  lot: {
    lot_number: string
    received_date: Date | string
    expiry_date?: Date | string
  }
  product: {
    name: string
    gtin: string
    variety?: string | null
  }
  companySettings?: {
    name: string
    address?: string
  }
}

/**
 * Print Label Hook Factory
 * 
 * Generic hook for printing labels (pallet or case) as PDFs
 * 
 * @param type - Label type: 'pallet' or 'case'
 * @returns Object with print function and loading state
 * 
 * @example
 * ```tsx
 * const { printLabel, isPrinting } = usePrintLabel('pallet')
 * 
 * const handlePrint = () => {
 *   printLabel({
 *     lot: { lot_number: 'LOT-123', ... },
 *     product: { name: 'Apples', ... }
 *   })
 * }
 * ```
 */
export function usePrintLabel(type: 'pallet' | 'case') {
  const [isPrinting, setIsPrinting] = useState(false)

  const printLabel = useCallback(
    async (data: PalletLabelData | CaseLabelData) => {
      if (isPrinting) return

      setIsPrinting(true)

      try {
        // Dynamic import to avoid SSR issues
        const { pdf } = await import('@react-pdf/renderer')

        // Render the appropriate label template
        let labelDocument: React.ReactElement

        if (type === 'pallet') {
          labelDocument = React.createElement(PalletLabelPdf, data as PalletLabelData)
        } else {
          labelDocument = React.createElement(CaseLabelPdf, data as CaseLabelData)
        }

        // Generate PDF blob
        // Type assertion needed because React.createElement returns generic ReactElement
        const blob = await pdf(labelDocument as any).toBlob()
        const blobUrl = URL.createObjectURL(blob)

        // Open in browser's native PDF viewer
        const printWindow = window.open(blobUrl, '_blank')

        if (!printWindow) {
          alert('Please allow popups for this site to enable printing')
          URL.revokeObjectURL(blobUrl)
          setIsPrinting(false)
          return
        }

        // Wait for PDF to load, then trigger print dialog
        const triggerPrint = () => {
          try {
            if (printWindow && !printWindow.closed) {
              printWindow.focus()
              printWindow.print()
            }
          } catch (e) {
            console.log('Auto-print blocked. User can press Ctrl+P or use browser print button.')
          }
        }

        // Try printing after a short delay to ensure PDF is loaded
        printWindow.addEventListener(
          'load',
          () => {
            setTimeout(triggerPrint, 500)
            setIsPrinting(false)
            // Clean up blob URL after a delay
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
          },
          { once: true }
        )

        // Fallback: try printing after 2 seconds regardless
        setTimeout(() => {
          triggerPrint()
          setIsPrinting(false)
          setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
        }, 2000)
      } catch (error) {
        console.error('Error generating PDF for print:', error)
        alert(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
        setIsPrinting(false)
      }
    },
    [type, isPrinting]
  )

  return {
    printLabel,
    isPrinting,
  }
}
