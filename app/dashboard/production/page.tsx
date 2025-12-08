import { ProductionRepackForm } from "@/components/production/ProductionRepackForm"
import { getActiveProducts } from "@/app/actions/products"
import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function ProductionPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Check permissions
  const allowedRoles = ["ADMIN", "RECEIVER", "PACKER", "MANAGER"]
  if (!allowedRoles.includes(session.user.role)) {
    redirect("/dashboard")
  }

  const products = await getActiveProducts()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Production / Repacking
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Convert inventory from source lots to finished products
        </p>
      </div>

      <ProductionRepackForm products={products} />
    </div>
  )
}










