import { getOrderById } from "@/app/actions/orders"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { format } from "date-fns"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { UnshipButton } from "@/components/orders/UnshipButton"

interface OrderViewPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function OrderViewPage(props: OrderViewPageProps) {
  const params = await props.params

  try {
    const order = await getOrderById(params.id)

    if (!order) {
      notFound()
    }

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
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/orders">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Orders
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold">
                Order #{order.order_number}
              </h1>
              <p className="text-muted-foreground mt-1">
                View order details, quantities, and pick history
              </p>
            </div>
          </div>
          {order.status === "SHIPPED" && (
            <UnshipButton orderId={order.id} orderPoNumber={order.po_number} />
          )}
        </div>

        {/* Order Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Order Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <span className="text-sm text-muted-foreground">Customer:</span>
                <p className="font-medium">{order.customer.name}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Status:</span>
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
                <span className="text-sm text-muted-foreground">Delivery Date:</span>
                <p className="font-medium">
                  {format(new Date(order.delivery_date), "MMM dd, yyyy")}
                </p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Created:</span>
                <p className="font-medium">
                  {format(new Date(order.createdAt), "MMM dd, yyyy")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle>Order Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Total Ordered</p>
                <p className="text-3xl font-bold mt-2">{totalOrdered}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {isShipped ? "Shipped" : "Picked"}
                </p>
                <p className="text-3xl font-bold text-green-600 mt-2">{totalPicked}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Remaining</p>
                <p
                  className={`text-3xl font-bold mt-2 ${
                    totalOrdered - totalPicked === 0
                      ? "text-green-600"
                      : "text-orange-600"
                  }`}
                >
                  {totalOrdered - totalPicked}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Items Table */}
        <Card>
          <CardHeader>
            <CardTitle>Order Items</CardTitle>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Pick Details */}
        {order.items.some((item) => item.picks.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle>Pick Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {order.items.map((item) => {
                  if (item.picks.length === 0) return null

                  return (
                    <div key={item.id} className="border rounded-lg p-4">
                      <div className="font-semibold mb-4 text-lg">
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
            </CardContent>
          </Card>
        )}
      </div>
    )
  } catch (error) {
    console.error("Error loading order:", error)
    notFound()
  }
}

