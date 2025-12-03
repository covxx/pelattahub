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
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Batch Receiving
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Receive multiple items from a vendor and print labels
          </p>
        </div>
        <Link href="/dashboard/receiving/history">
          <Button variant="outline">
            <History className="h-4 w-4 mr-2" />
            View Receiving History
          </Button>
        </Link>
      </div>

      <BatchReceivingForm products={products} vendors={vendors} topVendors={topVendors} />
    </div>
  )
}

