import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AdminSidebar } from "@/components/admin/AdminSidebar"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Security Check: Only ADMIN and MANAGER roles can access
  if (!session?.user) {
    redirect("/login")
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER" && session.user.role !== "SRJLABS") {
    redirect("/dashboard/inventory")
  }

  const isAdmin = session.user.role === "ADMIN"
  const isManager = session.user.role === "MANAGER"
  const isSrjLabs = session.user.role === "SRJLABS"

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar Navigation */}
      <AdminSidebar isAdmin={isAdmin} isManager={isManager} isSrjLabs={isSrjLabs} />

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
