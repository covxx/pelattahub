"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Printer, FileText, ArrowLeft, Edit2, Check, X } from "lucide-react"
import { finalizeReceivingEvent, updateLotQuantity } from "@/app/actions/receiving"
import { getCompanySettings } from "@/app/actions/settings"
import { generateMasterLabel, generatePTILabel } from "@/lib/zpl-generator"
import { printZplViaBrowser } from "@/lib/print-service"
import { useToast } from "@/hooks/useToast"
import { ToastContainer } from "@/components/ui/toast"
import { ReceivingReceiptPDF } from "@/components/documents/ReceivingReceiptPDF"
import { PDFViewerModal } from "@/components/documents/PDFViewerModal"

interface ReceivingEventDetailProps {
  event: any
  userRole: string
}

export function ReceivingEventDetail({
  event,
  userRole,
}: ReceivingEventDetailProps) {
  const router = useRouter()
  const [isEditMode, setIsEditMode] = useState(false)
  const [companySettings, setCompanySettings] = useState<any>(null)
  const [showPDFModal, setShowPDFModal] = useState(false)
  const [editingLotId, setEditingLotId] = useState<string | null>(null)
  const [editQuantity, setEditQuantity] = useState<number>(0)
  const [isSaving, setIsSaving] = useState(false)
  const { toast, toasts, removeToast } = useToast()

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

  const handlePrintReceipt = () => {
    if (!companySettings) {
      toast("Loading company settings...", "info")
      return
    }
    setShowPDFModal(true)
  }

  const handlePrintAllLabels = () => {
    try {
      // Concatenate all labels into one print job
      const allZpl = event.lots
        .map((lot: any) => {
          // Use PTI label if company settings are loaded
          if (companySettings) {
            return generatePTILabel(
              lot,
              lot.product,
              companySettings,
              {
                caseWeight: lot.product.standard_case_weight,
                unitType: lot.product.unit_type,
                origin: lot.origin_country,
              }
            )
          } else {
            // Use master pallet label (4x6)
            const lotWithVendor = {
              ...lot,
              receivingEvent: event ? {
                vendor: event.vendor
              } : undefined
            }
            return generateMasterLabel(lotWithVendor, lot.product)
          }
        })
        .join('\n\n')
      
      // Print via browser's native print dialog
      printZplViaBrowser(allZpl, {
        windowTitle: `All Labels - Receipt ${event.id.slice(0, 8).toUpperCase()}`,
      })

      // Show instruction toast
      toast(
        `Printing ${event.lots.length} label(s). Select your ZPL/Generic/Text printer.`,
        "info"
      )
    } catch (err) {
      toast(
        err instanceof Error
          ? err.message
          : "Failed to open print window. Please allow popups.",
        "error"
      )
    }
  }

  const handleFinalize = async () => {
    if (!confirm("Finalize this receiving event? This cannot be undone.")) return

    const result = await finalizeReceivingEvent(event.id)
    if (result.success) {
      alert("Receiving event finalized")
      router.refresh()
    } else {
      alert(`Error: ${result.error}`)
    }
  }

  const isOpen = event.status === "OPEN"
  const canEdit = isOpen && (userRole === "ADMIN" || userRole === "RECEIVER")

  const handleStartEdit = (lot: any) => {
    setEditingLotId(lot.id)
    setEditQuantity(lot.original_quantity)
  }

  const handleCancelEdit = () => {
    setEditingLotId(null)
    setEditQuantity(0)
  }

  const handleSaveEdit = async (lotId: string) => {
    if (editQuantity <= 0) {
      toast("Quantity must be greater than 0", "error")
      return
    }

    setIsSaving(true)
    try {
      const result = await updateLotQuantity(lotId, editQuantity)
      if (result.success) {
        toast("Quantity updated successfully", "success")
        setEditingLotId(null)
        router.refresh()
      } else {
        toast(result.error || "Failed to update quantity", "error")
      }
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Failed to update quantity",
        "error"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard/receiving/history")}
            className="mb-2"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to History
          </Button>
          <h1 className="text-3xl font-bold">Receiving Receipt</h1>
          <p className="text-muted-foreground">
            Receipt #: <span className="font-mono font-bold">{event.receipt_number || event.id.slice(0, 8).toUpperCase()}</span>
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrintReceipt}>
            <FileText className="h-4 w-4 mr-2" />
            Print Receipt
          </Button>
          <Button variant="outline" onClick={handlePrintAllLabels}>
            <Printer className="h-4 w-4 mr-2" />
            Reprint All Labels
          </Button>
          {canEdit && userRole === "ADMIN" && (
            <Button onClick={handleFinalize} variant="destructive">
              🔒 Finalize
            </Button>
          )}
        </div>
      </div>

      {/* Status Badge */}
      <div>
        <span
          className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            isOpen
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          {isOpen ? "🟢 Open" : "🔒 Finalized"}
          {event.finalized_at && (
            <span className="ml-2 text-xs">
              on {format(new Date(event.finalized_at), "MM/dd/yyyy")}
            </span>
          )}
        </span>
      </div>

      {/* PDF Modal */}
      {event && showPDFModal && (
        <PDFViewerModal
          open={showPDFModal}
          onOpenChange={setShowPDFModal}
          pdfUrl={`/api/receipt/pdf?eventId=${event.id}`}
          filename={`Receiving_Receipt_${event.receipt_number || event.id.slice(0, 8).toUpperCase()}.pdf`}
          title={`Receiving Receipt #${event.receipt_number || event.id.slice(0, 8).toUpperCase()}`}
        />
      )}

      {/* Event Details */}
      <Card>
        <CardHeader>
          <CardTitle>Event Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Vendor</p>
              <p className="text-lg font-semibold">
                {event.vendor.name} ({event.vendor.code})
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date Received</p>
              <p className="text-lg font-semibold">
                {format(new Date(event.received_date), "MM/dd/yyyy")}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Received By</p>
              <p className="text-lg font-semibold">{event.user.name || "Unknown"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="text-lg font-semibold">{event.lots.length}</p>
            </div>
          </div>

          {event.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="text-sm">{event.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lots Table */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Items Received</CardTitle>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditMode(!isEditMode)}
              >
                <Edit2 className="h-4 w-4 mr-2" />
                {isEditMode ? "Done Editing" : "Edit Quantities"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Lot Number</th>
                <th className="text-left py-2">Product</th>
                <th className="text-left py-2">SKU</th>
                <th className="text-right py-2">Quantity</th>
                <th className="text-left py-2">Unit</th>
                <th className="text-right py-2">Current</th>
                {canEdit && isEditMode && <th className="text-center py-2">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {event.lots.map((lot: any) => (
                <tr key={lot.id} className="border-b">
                  <td className="font-mono text-sm py-3">{lot.lot_number}</td>
                  <td className="py-3">{lot.product.name}</td>
                  <td className="font-mono text-sm py-3">{lot.product.sku}</td>
                  <td className="text-right py-3">
                    {editingLotId === lot.id ? (
                      <Input
                        type="number"
                        min="1"
                        value={editQuantity}
                        onChange={(e) =>
                          setEditQuantity(parseInt(e.target.value) || 0)
                        }
                        className="w-24 text-right"
                        disabled={isSaving}
                      />
                    ) : (
                      lot.original_quantity
                    )}
                  </td>
                  <td className="py-3">{lot.product.unit_type}</td>
                  <td className="text-right py-3">{lot.quantity_current}</td>
                  {canEdit && isEditMode && (
                    <td className="text-center py-3">
                      {editingLotId === lot.id ? (
                        <div className="flex gap-2 justify-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSaveEdit(lot.id)}
                            disabled={isSaving}
                          >
                            <Check className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleCancelEdit}
                            disabled={isSaving}
                          >
                            <X className="h-4 w-4 text-red-600" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleStartEdit(lot)}
                          disabled={isSaving}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-bold">
                <td colSpan={3} className="py-3">Total Items:</td>
                <td className="text-right py-3">{event.lots.length}</td>
                <td colSpan={canEdit && isEditMode ? 3 : 2}></td>
              </tr>
            </tfoot>
          </table>
        </CardContent>
      </Card>

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  )
}

