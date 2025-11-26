import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { InventoryView } from "@/components/inventory/InventoryView"
import { getInventoryLots } from "@/app/actions/inventory"

export default async function InventoryPage() {
  const session = await auth()

  // Security check: Only authenticated users can access
  if (!session?.user) {
    redirect("/")
  }

  const lots = await getInventoryLots()

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Inventory Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          View and manage inventory lots grouped by product
        </p>
      </div>

      <InventoryView initialLots={lots} />
    </div>
  )
}

