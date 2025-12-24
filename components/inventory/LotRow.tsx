"use client"

import { useState, useEffect } from "react"
import {
  TableRow,
  TableCell,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreVertical, Printer, Edit, History, Package } from "lucide-react"
import { AdjustQuantityDialog } from "./AdjustQuantityDialog"
import { ViewHistoryDialog } from "./ViewHistoryDialog"
import { getCompanySettings } from "@/app/actions/settings"
import { getLotWithReceivingEvent } from "@/app/actions/inventory"
import { usePrintLabel } from "@/hooks/usePrintLabel"
import { useToast } from "@/hooks/useToast"
import type { InventoryLot } from "@/types/inventory"

interface LotRowProps {
  lot: InventoryLot
  daysLeft: number
  expiryStatus: "ok" | "warning" | "expired"
}

export function LotRow({ lot, daysLeft, expiryStatus }: LotRowProps) {
  const [isAdjustOpen, setIsAdjustOpen] = useState(false)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [companySettings, setCompanySettings] = useState<any>(null)
  const { toast } = useToast()
  
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

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  }

  const getRowClassName = () => {
    if (expiryStatus === "expired") {
      return "bg-red-100 text-red-900 dark:bg-red-950/40 dark:text-red-100"
    } else if (expiryStatus === "warning") {
      return "bg-yellow-100 text-yellow-900 dark:bg-yellow-950/40 dark:text-yellow-100"
    }
    return ""
  }

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "AVAILABLE":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      case "QC_PENDING":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
      case "RECEIVED":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
      case "EXPIRED":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200"
    }
  }

  const handleReprintPallet = async () => {
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

      // Prepare lot data for master label
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
        name: lot.product.name,
        unit_type: lot.product.unit_type || "CASE",
        gtin: lot.product.gtin || undefined
      }

      printPalletLabel({
        lot: lotForLabel,
        product: productForLabel
      })

      toast("Generating PDF label...", "info")
    } catch (err) {
      toast(
        `Print failed: ${err instanceof Error ? err.message : "Failed to generate PDF label."}`,
        "error"
      )
    }
  }

  const handleReprint = () => {
    if (!lot.product.gtin) {
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
          name: lot.product.name,
          gtin: lot.product.gtin,
        variety: lot.product.variety || null
      }

      printCaseLabel({
        lot: lotForLabel,
        product: productForLabel,
        companySettings: companySettings || undefined
      })

      toast("Generating PDF label...", "info")
    } catch (err) {
      toast(
        `Print failed: ${err instanceof Error ? err.message : "Failed to generate PDF label."}`,
        "error"
      )
    }
  }

  return (
    <>
      <TableRow className={getRowClassName()}>
        <TableCell></TableCell>
        <TableCell className="pl-8">
          <span className="text-sm text-muted-foreground">Lot</span>
        </TableCell>
        <TableCell className="font-mono font-medium">
          {lot.lot_number}
        </TableCell>
        <TableCell>
          <span className="font-medium">{lot.quantity_current}</span>
          <span className="text-sm text-muted-foreground ml-1">
            / {lot.quantity_received}
          </span>
        </TableCell>
        <TableCell className="text-sm">{formatDate(lot.received_date)}</TableCell>
        <TableCell className="text-sm">{formatDate(lot.expiry_date)}</TableCell>
        <TableCell>
          <span
            className={
              expiryStatus === "expired"
                ? "font-bold"
                : expiryStatus === "warning"
                ? "font-bold"
                : ""
            }
          >
            {daysLeft < 0 ? `${Math.abs(daysLeft)} days ago` : `${daysLeft} days`}
          </span>
        </TableCell>
        <TableCell>
          <span
            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(lot.status)}`}
          >
            {lot.status}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={handleReprint}>
                <Printer className="h-4 w-4 mr-2" />
                Reprint Case Label
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleReprintPallet}>
                <Package className="h-4 w-4 mr-2" />
                Reprint Pallet Label
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsAdjustOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Adjust Qty
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setIsHistoryOpen(true)}>
                <History className="h-4 w-4 mr-2" />
                View History
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>

      <AdjustQuantityDialog
        lot={lot}
        open={isAdjustOpen}
        onOpenChange={setIsAdjustOpen}
      />

      <ViewHistoryDialog
        lot={lot}
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
      />
    </>
  )
}

