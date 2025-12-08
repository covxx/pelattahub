import { ReportsDashboard } from "@/components/reports/ReportsDashboard"
import { getActiveVendors } from "@/app/actions/vendors"
import { getActiveCustomers } from "@/app/actions/customers"
import { getActiveProducts } from "@/app/actions/products"

export default async function ReportsPage() {
  // Fetch all data needed for filters
  const [vendors, customers, products] = await Promise.all([
    getActiveVendors(),
    getActiveCustomers(),
    getActiveProducts(),
  ])

  return <ReportsDashboard vendors={vendors} customers={customers} products={products} />
}







