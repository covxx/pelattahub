"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X } from "lucide-react"

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
        // If PDF URL is provided, download directly
        const link = window.document.createElement("a")
        link.href = providedPdfUrl
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
    // If PDF URL is provided, use it directly
    if (providedPdfUrl) {
      setPdfUrl(providedPdfUrl)
      setIsLoading(false)
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

