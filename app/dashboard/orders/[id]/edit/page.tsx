import { getOrderById } from "@/app/actions/orders"
import { getAllCustomers } from "@/app/actions/admin/customers"
import { getProducts } from "@/app/actions/products"
import { EditOrderForm } from "@/components/orders/EditOrderForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { notFound } from "next/navigation"

interface EditOrderPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditOrderPage(props: EditOrderPageProps) {
  const params = await props.params
  
  try {
    const [order, customers, products] = await Promise.all([
      getOrderById(params.id),
      getAllCustomers(),
      getProducts(),
    ])

    if (!order) {
      notFound()
    }

    // Only allow editing DRAFT orders
    if (order.status !== "DRAFT") {
      return (
        <div className="container mx-auto py-6">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">
                This order cannot be edited. Only DRAFT orders can be modified.
                Current status: {order.status}
              </p>
            </CardContent>
          </Card>
        </div>
      )
    }

    // Filter to only active customers
    const activeCustomers = customers.filter((c) => c.active)

    return (
      <div className="container mx-auto py-6 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-3xl">Edit Order</CardTitle>
          </CardHeader>
          <CardContent>
            <EditOrderForm
              order={order}
              customers={activeCustomers}
              products={products}
            />
          </CardContent>
        </Card>
      </div>
    )
  } catch (error) {
    console.error("Error loading order for editing:", error)
    notFound()
  }
}

