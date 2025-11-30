import { getActiveProducts } from "@/app/actions/products"
import { ProductsManagement } from "@/components/admin/ProductsManagement"

export default async function AdminProductsPage() {
  const products = await getActiveProducts()

  return <ProductsManagement products={products} />
}


