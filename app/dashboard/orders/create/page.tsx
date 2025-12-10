import { CreateOrderForm } from "@/components/orders/CreateOrderForm"
import { getAllCustomers } from "@/app/actions/admin/customers"
import { getProducts } from "@/app/actions/products"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default async function CreateOrderPage() {
  // Fetch customers and products in parallel
  const [customers, products] = await Promise.all([
    getAllCustomers(),
    getProducts(), // Use getProducts to get full Product objects
  ])

  // Filter to only active customers
  const activeCustomers = customers.filter((c) => c.active)

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-3xl">Create Outbound Order</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateOrderForm
            customers={activeCustomers}
            products={products}
          />
        </CardContent>
      </Card>
    </div>
  )
}

