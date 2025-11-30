import { getAllCustomers } from "@/app/actions/admin/customers"
import { CustomersManagement } from "@/components/admin/CustomersManagement"

export default async function CustomersPage() {
  const customers = await getAllCustomers()

  return <CustomersManagement customers={customers} />
}


