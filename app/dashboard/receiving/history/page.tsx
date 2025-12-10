import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getReceivingHistory } from "@/app/actions/receiving"
import { ReceivingHistoryTable } from "@/components/receiving/ReceivingHistoryTable"

export default async function ReceivingHistoryPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Fetch all receiving events
  const events = await getReceivingHistory()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Receiving History</h1>
        <p className="text-muted-foreground">
          View and manage past receiving events
        </p>
      </div>

      <ReceivingHistoryTable events={events} userRole={session.user.role} />
    </div>
  )
}

