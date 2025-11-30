import { InventoryHub } from "@/components/inventory/InventoryHub"
import { getInventoryCatalog } from "@/app/actions/inventory"

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: { search?: string; showOutOfStock?: string }
}) {
  const search = searchParams.search || ""
  const showOutOfStock = searchParams.showOutOfStock === "true"

  const catalog = await getInventoryCatalog({
    activeOnly: !showOutOfStock,
    search,
  })

  return <InventoryHub initialCatalog={catalog} />
}
