import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { QboSyncDashboard } from "@/components/integrations/QboSyncDashboard"
import { getQboStatus } from "@/app/actions/qbo-sync"

// Force dynamic rendering to handle OAuth callback query params
export const dynamic = 'force-dynamic'

export default async function QuickBooksOnlinePage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    redirect("/dashboard")
  }

  // Get connection status
  const statusResult = await getQboStatus()
  const isConnected = statusResult.success && "connected" in statusResult && statusResult.connected

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">QuickBooks Online Integration</h1>
        <p className="text-muted-foreground">
          Sync customers, products, vendors, and invoices from QuickBooks Online
        </p>
      </div>

      <QboSyncDashboard isConnected={isConnected} />
    </div>
  )
}

