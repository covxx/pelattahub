"use client"

import React, { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Download, X } from "lucide-react"
import { pdf } from "@react-pdf/renderer"

interface PDFViewerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  document: React.ReactElement
  filename: string
  title?: string
}

export function PDFViewerModal({
  open,
  onOpenChange,
  document: pdfDocument,
  filename,
  title,
}: PDFViewerModalProps) {
  const [isGenerating, setIsGenerating] = useState(false)

  const handleDownload = async () => {
    setIsGenerating(true)
    try {
      const blob = await pdf(pdfDocument as any).toBlob()
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
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Failed to generate PDF. Please try again.")
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
          <PDFViewer document={pdfDocument} />
        </div>
      </DialogContent>
    </Dialog>
  )
}

// Client-side PDF viewer component
function PDFViewer({ document }: { document: React.ReactElement }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    const generatePDF = async () => {
      try {
        const blob = await pdf(document as any).toBlob()
        if (isMounted) {
          const url = URL.createObjectURL(blob)
          setPdfUrl(url)
          setIsLoading(false)
        }
      } catch (error) {
        console.error("Error generating PDF:", error)
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    generatePDF()

    return () => {
      isMounted = false
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl)
      }
    }
  }, [document])

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

