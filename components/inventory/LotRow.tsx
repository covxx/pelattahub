"use client"

import { useState } from "react"
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
import { MoreVertical, Printer, Edit, History } from "lucide-react"
import { AdjustQuantityDialog } from "./AdjustQuantityDialog"
import { ViewHistoryDialog } from "./ViewHistoryDialog"
import { useZebraPrinter } from "@/contexts/ZebraPrinterContext"
import { generateGS1Label } from "@/lib/zpl-generator"
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
  const { print, isConnected } = useZebraPrinter()
  const { showToast } = useToast()

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

  const handleReprint = async () => {
    if (!isConnected) {
      showToast("Please connect to a Zebra printer first", "error")
      return
    }

    if (!lot.product.gtin) {
      showToast("Cannot print: Product missing GTIN", "error")
      return
    }

    try {
      const zpl = generateGS1Label(
        {
          lot_number: lot.lot_number,
          received_date: lot.received_date,
        },
        {
          name: lot.product.name,
          gtin: lot.product.gtin,
          variety: lot.product.variety,
        }
      )
      await print(zpl)
      showToast(`Label sent to printer for Lot #${lot.lot_number}`, "success")
    } catch (err) {
      showToast(
        `Print failed: ${err instanceof Error ? err.message : "Unknown error"}`,
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
              <DropdownMenuItem
                onSelect={handleReprint}
                disabled={!isConnected}
              >
                <Printer className="h-4 w-4 mr-2" />
                Reprint Label {!isConnected && "(Printer not connected)"}
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

