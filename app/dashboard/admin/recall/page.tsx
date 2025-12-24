import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { generateRecallReport } from "@/app/actions/admin/recall"
import { RecallReport } from "@/components/admin/RecallReport"

type SearchParams = Record<string, string | string[] | undefined>

export default async function RecallReportPage({
  searchParams,
}: {
  searchParams?: SearchParams
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Allow ADMIN, MANAGER, and SRJLABS roles (consistent with recall actions)
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER" && session.user.role !== "SRJLABS") {
    redirect("/dashboard")
  }

  const type = searchParams?.type === "order" ? "order" : "lot"
  const value = typeof searchParams?.value === "string" ? searchParams.value.trim() : ""

  const report = value
    ? await generateRecallReport({
        lotNumber: type === "lot" ? value : undefined,
        orderNumber: type === "order" ? value : undefined,
      })
    : null

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Recall Report</h2>
        <p className="text-muted-foreground">
          Trace upstream vendor and downstream orders for recalls
        </p>
      </div>

      <RecallReport initialType={type} initialValue={value} report={report} />
    </div>
  )
}


