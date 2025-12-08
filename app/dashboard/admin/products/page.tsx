import { getActiveProducts } from "@/app/actions/products"
import { ProductsManagement } from "@/components/admin/ProductsManagement"

export default async function AdminProductsPage() {
  try {
    const products = await getActiveProducts()
    return <ProductsManagement products={products} />
  } catch (error) {
    console.error("Error loading products:", error)
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
        <h2 className="text-xl font-bold text-red-800 dark:text-red-200 mb-2">Error Loading Products</h2>
        <p className="text-red-600 dark:text-red-300">
          {error instanceof Error ? error.message : "Failed to load products. Please check the database connection."}
        </p>
      </div>
    )
  }
}


