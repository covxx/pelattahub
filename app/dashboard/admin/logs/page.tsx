import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getAuditLogs, getAuditActions } from "@/app/actions/admin/audit"
import { getAllUsers } from "@/app/actions/admin/users"
import { AuditLogsTable } from "@/components/admin/AuditLogsTable"

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // System Logs is ADMIN-only
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard")
  }
  const page = Number(searchParams?.page) > 0 ? Number(searchParams?.page) : 1
  const pageSize =
    Number(searchParams?.pageSize) > 0 && Number(searchParams?.pageSize) <= 200
      ? Number(searchParams?.pageSize)
      : 50
  const search =
    typeof searchParams?.q === "string" && searchParams.q.trim().length > 0
      ? searchParams.q.trim()
      : undefined

  const [auditResult, actions, users] = await Promise.all([
    getAuditLogs({ limit: pageSize, page, search }),
    getAuditActions(),
    getAllUsers(),
  ])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">System Logs</h2>
        <p className="text-muted-foreground">
          Audit trail of all system activities
        </p>
      </div>

      <AuditLogsTable
        logs={auditResult.logs}
        total={auditResult.total}
        page={auditResult.page}
        pageSize={auditResult.limit}
        search={search}
        actions={actions}
        users={users}
      />
    </div>
  )
}


