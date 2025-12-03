import { getOrders } from "@/app/actions/orders"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { format } from "date-fns"

export default async function OrdersPage() {
  const orders = await getOrders()

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Orders</h1>
        <Link href="/dashboard/orders/create">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Order
          </Button>
        </Link>
      </div>

      {orders.length === 0 ? (
        <Card>
          <CardContent className="pt-6 text-center text-muted-foreground">
            No orders found. Create your first order to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => (
            <Card key={order.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>
                    Order {order.po_number || order.id.slice(0, 8)}
                  </CardTitle>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      order.status === "DRAFT"
                        ? "bg-gray-100 text-gray-800"
                        : order.status === "CONFIRMED"
                        ? "bg-blue-100 text-blue-800"
                        : order.status === "PICKING"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-green-100 text-green-800"
                    }`}
                  >
                    {order.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
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
                    <span className="text-muted-foreground">Created:</span>
                    <p className="font-medium">
                      {format(new Date(order.createdAt), "MMM dd, yyyy")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}


