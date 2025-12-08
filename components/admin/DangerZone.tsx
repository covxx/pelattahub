"use client"

import { useState, useTransition } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { AlertTriangle, Trash2 } from "lucide-react"
import { resetDatabase } from "@/app/actions/settings"
import { useToast } from "@/hooks/useToast"
import { ToastContainer } from "@/components/ui/toast"
import { useRouter } from "next/navigation"

export function DangerZone() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [confirmationText, setConfirmationText] = useState("")
  const [isResetting, startReset] = useTransition()
  const { toast, toasts, removeToast } = useToast()
  const router = useRouter()

  const requiredText = "DELETE-ALL-DATA"
  const isConfirmationValid = confirmationText === requiredText

  const handleReset = () => {
    setIsDialogOpen(true)
  }

  const handleConfirmReset = () => {
    if (!isConfirmationValid) return

    // Close dialog and show processing message
    setIsDialogOpen(false)
    toast("Resetting database... This may take a moment.", "info")

    // Proceed with reset
    startReset(async () => {
      try {
        const result = await resetDatabase()

        if (result.success) {
          const counts = result.deletedCounts
          toast(
            `Database reset complete. Deleted: ${counts?.products || 0} products, ${counts?.customers || 0} customers, ${counts?.vendors || 0} vendors, ${counts?.orders || 0} orders, ${counts?.inventoryLots || 0} lots, and related data.`,
            "success"
          )
          setConfirmationText("")
          router.refresh()
        } else {
          toast(result.error || "Failed to reset database", "error")
        }
      } catch (error) {
        toast("Failed to reset database", "error")
        console.error("Reset error:", error)
      }
    })
  }

  return (
    <>
      <Card className="border-red-500 border-2">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-500" />
            <CardTitle className="text-red-600">Danger Zone</CardTitle>
          </div>
          <CardDescription>
            Irreversible and destructive actions. Use with extreme caution.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Reset Database</h3>
            <p className="text-sm text-muted-foreground">
              Permanently delete all products, customers, vendors, orders, inventory lots, and
              receiving events. User accounts will be preserved.
            </p>
            <Button
              variant="destructive"
              onClick={handleReset}
              className="mt-2"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Reset Database
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Confirm Database Reset
            </DialogTitle>
            <DialogDescription>
              This action will permanently delete all operational data from the database. This
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-4">
              <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                What will be deleted:
              </p>
              <ul className="text-sm text-red-800 dark:text-red-200 space-y-1 list-disc list-inside">
                <li>All Products</li>
                <li>All Customers</li>
                <li>All Vendors</li>
                <li>All Orders and Order Items</li>
                <li>All Inventory Lots</li>
                <li>All Receiving Events</li>
                <li>All Order Picks and Allocations</li>
              </ul>
              <p className="text-sm font-medium text-red-900 dark:text-red-100 mt-3 mb-1">
                What will be preserved:
              </p>
              <ul className="text-sm text-red-800 dark:text-red-200 space-y-1 list-disc list-inside">
                <li>All User Accounts</li>
                <li>System Settings</li>
                <li>Audit Logs (reset event will be logged)</li>
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmation">
                Type <strong>{requiredText}</strong> to confirm:
              </Label>
              <Input
                id="confirmation"
                value={confirmationText}
                onChange={(e) => setConfirmationText(e.target.value)}
                placeholder={requiredText}
                className="font-mono"
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDialogOpen(false)
                setConfirmationText("")
              }}
              disabled={isResetting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReset}
              disabled={!isConfirmationValid || isResetting}
            >
              {isResetting ? "Resetting..." : "Confirm Reset"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </>
  )
}

