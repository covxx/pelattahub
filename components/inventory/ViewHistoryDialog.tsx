"use client"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { InventoryLot } from "@/types/inventory"

interface ViewHistoryDialogProps {
  lot: InventoryLot
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ViewHistoryDialog({
  lot,
  open,
  onOpenChange,
}: ViewHistoryDialogProps) {
  // TODO: Implement audit log system
  // For now, show basic lot information

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Lot History</DialogTitle>
          <DialogDescription>
            Audit log for Lot {lot.lot_number}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="border rounded-lg p-4 space-y-2">
            <h3 className="font-semibold mb-3">Lot Information</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Product:</span>
                <p className="font-medium">{lot.product.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">SKU:</span>
                <p className="font-mono">{lot.product.sku}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Lot Number:</span>
                <p className="font-mono">{lot.lot_number}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <p className="font-medium">{lot.status}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Received:</span>
                <p>{formatDate(lot.received_date)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Expires:</span>
                <p>{formatDate(lot.expiry_date)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Quantity Received:</span>
                <p>{lot.quantity_received}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Current Quantity:</span>
                <p className="font-medium">{lot.quantity_current}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Origin:</span>
                <p>{lot.origin_country}</p>
              </div>
              {lot.grower_id && (
                <div>
                  <span className="text-muted-foreground">Grower ID:</span>
                  <p>{lot.grower_id}</p>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Created:</span>
                <p>{formatDate(lot.createdAt)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Last Updated:</span>
                <p>{formatDate(lot.updatedAt)}</p>
              </div>
            </div>
          </div>

          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3">Activity History</h3>
            <p className="text-sm text-muted-foreground">
              Audit log system coming soon. This will track all changes to the
              lot including quantity adjustments, status changes, and user
              actions.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

