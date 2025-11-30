"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X, Printer } from "lucide-react"

interface PDFViewerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document?: React.ReactElement
  pdfUrl?: string // Alternative: direct PDF URL from API
  filename: string
  title?: string
}

export function PDFViewerModal({
  open,
  onOpenChange,
  document: pdfDocument,
  pdfUrl: providedPdfUrl,
  filename,
  title,
}: PDFViewerModalProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  
  // Memoize the document to prevent recreation on every render
  const memoizedDocument = useMemo(() => pdfDocument, [pdfDocument])

  const handleDownload = async () => {
    setIsGenerating(true)
    try {
      if (providedPdfUrl) {
        // If PDF URL is provided, add download parameter or create download link
        const downloadUrl = providedPdfUrl.includes("?") 
          ? `${providedPdfUrl}&download=true`
          : `${providedPdfUrl}?download=true`
        
        const link = window.document.createElement("a")
        link.href = downloadUrl
        link.download = filename
        if (typeof window !== "undefined" && window.document.body) {
          window.document.body.appendChild(link)
          link.click()
          window.document.body.removeChild(link)
        }
      } else if (memoizedDocument) {
        // Fallback to client-side generation (may have React 19 issues)
        const { pdf } = await import("@react-pdf/renderer")
        const blob = await pdf(memoizedDocument as any).toBlob()
        const url = URL.createObjectURL(blob)
        const link = window.document.createElement("a")
        link.href = url
        link.download = filename
        if (typeof window !== "undefined" && window.document.body) {
          window.document.body.appendChild(link)
          link.click()
          window.document.body.removeChild(link)
        }
        URL.revokeObjectURL(url)
      } else {
        throw new Error("No PDF source provided")
      }
    } catch (error) {
      console.error("Error generating PDF:", error)
      console.error("Error details:", error instanceof Error ? error.stack : error)
      alert(`Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const handlePrint = () => {
    if (providedPdfUrl) {
      // Simple approach: Open PDF URL directly in new window with print parameter
      // The API will serve it with 'inline' disposition so it opens in browser viewer
      const baseUrl = providedPdfUrl.split("?")[0]
      const printUrl = `${baseUrl}?print=true`
      
      // Open in new window - browser will use native PDF viewer
      const printWindow = window.open(printUrl, "_blank")
      
      if (!printWindow) {
        alert("Please allow popups for this site to enable printing")
        return
      }
      
      // Wait for PDF to load, then trigger print dialog
      // Use a simple timeout approach since we can't reliably detect PDF load
      setTimeout(() => {
        try {
          if (printWindow && !printWindow.closed) {
            printWindow.focus()
            printWindow.print()
          }
        } catch (e) {
          // Cross-origin or other error - user can manually print with Ctrl+P
          console.log("Auto-print may be blocked. Use Ctrl+P or browser print button.")
        }
      }, 1500) // Give PDF time to load in browser viewer
      
    } else if (memoizedDocument) {
      // For client-side generated PDFs, generate blob and open in native viewer
      setIsGenerating(true)
      try {
        const { pdf } = await import("@react-pdf/renderer")
        const blob = await pdf(memoizedDocument as any).toBlob()
        const blobUrl = URL.createObjectURL(blob)
        
        // Open in browser's native PDF viewer
        const printWindow = window.open(blobUrl, "_blank")
        
        if (!printWindow) {
          alert("Please allow popups for this site to enable printing")
          setIsGenerating(false)
          URL.revokeObjectURL(blobUrl)
          return
        }
        
        // Wait for PDF to load, then print
        printWindow.addEventListener("load", () => {
          setTimeout(() => {
            try {
              printWindow.focus()
              printWindow.print()
            } catch (e) {
              console.log("Auto-print blocked, user can use Ctrl+P")
            }
            setIsGenerating(false)
            // Clean up blob URL after a delay
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
          }, 1000)
        }, { once: true })
        
        // Fallback
        setTimeout(() => {
          try {
            if (printWindow && !printWindow.closed) {
              printWindow.focus()
              printWindow.print()
            }
          } catch (e) {
            console.log("Auto-print blocked")
          }
          setIsGenerating(false)
          setTimeout(() => URL.revokeObjectURL(blobUrl), 5000)
        }, 2000)
      } catch (error) {
        console.error("Error generating PDF for print:", error)
        setIsGenerating(false)
        alert("Failed to generate PDF for printing")
      }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{title || "PDF Document"}</DialogTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                disabled={isGenerating}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={isGenerating}
              >
                <Download className="h-4 w-4 mr-2" />
                {isGenerating ? "Generating..." : "Download PDF"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>
        <div className="flex-1 overflow-auto border rounded-lg bg-gray-50">
          <PDFViewer document={memoizedDocument} pdfUrl={providedPdfUrl} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Client-side PDF viewer component
function PDFViewer({ 
  document, 
  pdfUrl: providedPdfUrl 
}: { 
  document?: React.ReactElement
  pdfUrl?: string 
}) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(providedPdfUrl || null)
  const [isLoading, setIsLoading] = useState(!providedPdfUrl)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // If PDF URL is provided, use it directly for display
    if (providedPdfUrl) {
      setPdfUrl(providedPdfUrl)
      setIsLoading(false)
      setError(null)
      return
    }

    // Otherwise, generate from document (may have React 19 issues)
    if (!document) {
      setError("No document or PDF URL provided")
      setIsLoading(false)
      return
    }

    let isMounted = true
    let currentPdfUrl: string | null = null

    const generatePDF = async () => {
      try {
        setIsLoading(true)
        setError(null)
        
        // Validate document structure
        if (!document || typeof document !== "object") {
          throw new Error("Invalid document structure")
        }
        
        // Dynamic import to avoid SSR issues
        const { pdf } = await import("@react-pdf/renderer")
        const blob = await pdf(document as any).toBlob()
        if (isMounted) {
          const url = URL.createObjectURL(blob)
          currentPdfUrl = url
          setPdfUrl(url)
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Error generating PDF:", error)
        console.error("Error details:", error instanceof Error ? error.stack : error)
        console.error("PDF Document type:", typeof document)
        console.error("PDF Document:", document)
        if (isMounted) {
          setError(error instanceof Error ? error.message : "Failed to generate PDF")
          setIsLoading(false)
        }
      }
    }

    generatePDF()

    return () => {
      isMounted = false
      if (currentPdfUrl) {
        URL.revokeObjectURL(currentPdfUrl)
      }
    }
  }, [document, providedPdfUrl])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Generating PDF...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center p-4">
          <p className="text-red-600 font-semibold mb-2">Failed to generate PDF</p>
          <p className="text-sm text-gray-600">{error}</p>
          <p className="text-xs text-gray-500 mt-2">Check browser console for details</p>
        </div>
      </div>
    )
  }

  if (!pdfUrl) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-red-600">Failed to generate PDF</p>
      </div>
    )
  }

  return (
    <iframe
      src={pdfUrl}
      className="w-full h-full min-h-[600px] border-0"
      title="PDF Viewer"
    />
  )
}

