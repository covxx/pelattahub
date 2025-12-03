import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { getAuditLogs, getAuditActions } from "@/app/actions/admin/audit"
import { getAllUsers } from "@/app/actions/admin/users"
import { AuditLogsTable } from "@/components/admin/AuditLogsTable"

export default async function AuditLogsPage() {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // System Logs is ADMIN-only
  if (session.user.role !== "ADMIN") {
    redirect("/dashboard")
  }
  const [logs, actions, users] = await Promise.all([
    getAuditLogs({ limit: 100 }),
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

      <AuditLogsTable logs={logs} actions={actions} users={users} />
    </div>
  )
}


