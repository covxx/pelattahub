import { getOrdersForPicking } from "@/app/actions/picking"
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Package } from "lucide-react"
import { format } from "date-fns"
import { Progress } from "@/components/ui/progress"

export default async function PickingPage() {
  const orders = await getOrdersForPicking()

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Picking Queue</h1>
          <p className="text-muted-foreground mt-1">
            Orders ready for picking - sorted by delivery date
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No orders ready for picking. All orders are either completed or not yet allocated.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    Order #{order.order_number}
                  </CardTitle>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      order.status === "CONFIRMED"
                        ? "bg-blue-100 text-blue-800"
                        : order.status === "PICKING" || order.status === "PARTIAL_PICK"
                        ? "bg-yellow-100 text-yellow-800"
                        : order.status === "READY_TO_SHIP"
                        ? "bg-purple-100 text-purple-800"
                        : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-muted-foreground">Customer:</span>
                    <p className="font-medium">{order.customer.name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Delivery Date:</span>
                    <p className="font-medium">
                      {format(new Date(order.delivery_date), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Items:</span>
                    <p className="font-medium">{order.items.length} item(s)</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Progress:</span>
                    <p className="font-medium">
                      {order.totalPicked} / {order.totalOrdered} picked
                    </p>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Picking Progress</span>
                    <span>{Math.round(order.progressPercentage)}%</span>
                  </div>
                  <Progress value={order.progressPercentage} className="h-2" />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Link href={`/dashboard/orders/${order.id}/pick`}>
                  <Button variant="default" size="sm">
                    <Package className="h-4 w-4 mr-2" />
                    {order.progressPercentage === 100 ? "Review Order" : "Pick Order"}
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

