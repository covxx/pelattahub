import { BatchReceivingForm } from "@/components/receiving/BatchReceivingForm"
import { getActiveProducts } from "@/app/actions/products"
import { getActiveVendors } from "@/app/actions/vendors"
import { getTopVendors } from "@/app/actions/receiving"
import { Button } from "@/components/ui/button"
import { History } from "lucide-react"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function ReceivingPage() {
  const [products, vendors, topVendors] = await Promise.all([
    getActiveProducts(),
    getActiveVendors(),
    getTopVendors(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Batch Receiving
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-1">
            Receive multiple items from a vendor and print labels
          </p>
        </div>
        <Link href="/dashboard/receiving/history" className="self-start sm:self-auto">
          <Button variant="outline" size="sm" className="w-full sm:w-auto">
            <History className="h-4 w-4 mr-2" />
            View Receiving History
          </Button>
        </Link>
      </div>

      <BatchReceivingForm products={products} vendors={vendors} topVendors={topVendors} />
    </div>
  )
}

