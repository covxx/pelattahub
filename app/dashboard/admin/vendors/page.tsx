import { getAllVendors } from "@/app/actions/admin/vendors"
import { VendorsManagement } from "@/components/admin/VendorsManagement"

export default async function VendorsPage() {
  const vendors = await getAllVendors()

  return <VendorsManagement vendors={vendors} />
}


