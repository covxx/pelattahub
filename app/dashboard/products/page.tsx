import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ProductsTable } from "@/components/products/ProductsTable"
import { getProducts } from "@/app/actions/products"

interface ProductsPageProps {
  searchParams: {
    search?: string
  }
}

export default async function ProductsPage({
  searchParams,
}: ProductsPageProps) {
  const session = await auth()

  // Security check: Only admins can access
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/")
  }

  const products = await getProducts(searchParams.search)

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Product Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage product SKUs and catalog
          </p>
        </div>
      </div>

      <ProductsTable initialProducts={products} />
    </div>
  )
}

