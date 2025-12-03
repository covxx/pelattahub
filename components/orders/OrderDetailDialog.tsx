"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { format } from "date-fns"
import type { Order } from "@prisma/client"

interface OrderDetailDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  order: {
    id: string
    po_number: string | null
    status: string
    delivery_date: Date | string
    createdAt: Date | string
    customer: {
      name: string
      code: string
    }
    items: Array<{
      id: string
      quantity_ordered: number
      product: {
        name: string
        sku: string
        unit_type: string
      }
      picks: Array<{
        id: string
        quantity_picked: number
        picked_at: Date | string
        inventory_lot: {
          lot_number: string
        }
        picked_by_user: {
          name: string | null
          email: string
        } | null
      }>
    }>
  }
}

export function OrderDetailDialog({
  open,
  onOpenChange,
  order,
}: OrderDetailDialogProps) {
  // Calculate totals
  const totalOrdered = order.items.reduce(
    (sum, item) => sum + item.quantity_ordered,
    0
  )
  const totalPicked = order.items.reduce((sum, item) => {
    const itemPicked = item.picks.reduce(
      (pickSum, pick) => pickSum + pick.quantity_picked,
      0
    )
    return sum + itemPicked
  }, 0)

  const isShipped = order.status === "SHIPPED"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Order Details: #{order.order_number}
          </DialogTitle>
          <DialogDescription>
            View order items, quantities ordered, and what was picked/shipped
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Customer:</span>
              <p className="font-medium">{order.customer.name}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Status:</span>
              <p className="font-medium">
                <Badge
                  variant={
                    order.status === "SHIPPED"
                      ? "default"
                      : order.status === "READY_TO_SHIP"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {order.status}
                </Badge>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Delivery Date:</span>
              <p className="font-medium">
                {format(new Date(order.delivery_date), "MMM dd, yyyy")}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Created:</span>
              <p className="font-medium">
                {format(new Date(order.createdAt), "MMM dd, yyyy")}
              </p>
            </div>
          </div>

          {/* Summary */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Total Ordered</p>
                <p className="text-2xl font-bold">{totalOrdered}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {isShipped ? "Shipped" : "Picked"}
                </p>
                <p className="text-2xl font-bold text-green-600">{totalPicked}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p
                  className={`text-2xl font-bold ${
                    totalOrdered - totalPicked === 0
                      ? "text-green-600"
                      : "text-orange-600"
                  }`}
                >
                  {totalOrdered - totalPicked}
                </p>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Order Items</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead className="text-right">Ordered</TableHead>
                  <TableHead className="text-right">
                    {isShipped ? "Shipped" : "Picked"}
                  </TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {order.items.map((item) => {
                  const itemPicked = item.picks.reduce(
                    (sum, pick) => sum + pick.quantity_picked,
                    0
                  )
                  const remaining = item.quantity_ordered - itemPicked
                  const isComplete = remaining === 0

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.product.name}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {item.product.sku}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.quantity_ordered} {item.product.unit_type}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            isComplete ? "text-green-600 font-semibold" : ""
                          }
                        >
                          {itemPicked} {item.product.unit_type}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={
                            remaining === 0
                              ? "text-green-600"
                              : remaining > 0
                              ? "text-orange-600"
                              : "text-red-600"
                          }
                        >
                          {remaining} {item.product.unit_type}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={isComplete ? "default" : "outline"}
                          className={
                            isComplete
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          }
                        >
                          {isComplete ? "Complete" : "Incomplete"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          {/* Pick Details (if any picks exist) */}
          {order.items.some((item) => item.picks.length > 0) && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Pick Details</h3>
              <div className="space-y-4">
                {order.items.map((item) => {
                  if (item.picks.length === 0) return null

                  return (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="font-semibold mb-2">
                        {item.product.name} ({item.product.sku})
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Lot #</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead>Picked By</TableHead>
                            <TableHead>Picked At</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {item.picks.map((pick) => (
                            <TableRow key={pick.id}>
                              <TableCell className="font-mono text-sm">
                                {pick.inventory_lot.lot_number}
                              </TableCell>
                              <TableCell className="text-right">
                                {pick.quantity_picked} {item.product.unit_type}
                              </TableCell>
                              <TableCell>
                                {pick.picked_by_user?.name ||
                                  pick.picked_by_user?.email ||
                                  "Unknown"}
                              </TableCell>
                              <TableCell>
                                {format(
                                  new Date(pick.picked_at),
                                  "MMM dd, yyyy HH:mm"
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

