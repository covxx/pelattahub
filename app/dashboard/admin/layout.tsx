import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { AdminSidebar } from "@/components/admin/AdminSidebar"
import { requireAdminOrManager, isAdmin, isAdminOrManager, isSrjLabs } from "@/lib/auth-helpers"

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Security Check: Only ADMIN, MANAGER, and SRJLABS roles can access
  try {
    await requireAdminOrManager()
  } catch {
    redirect("/dashboard/inventory")
  }

  const session = await auth()
  const userRole = session?.user?.role as string | undefined

  const isAdminUser = isAdmin(userRole)
  const isManagerUser = isAdminOrManager(userRole) && !isAdminUser && !isSrjLabs(userRole)
  const isSrjLabsUser = isSrjLabs(userRole)

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Sidebar Navigation */}
      <AdminSidebar isAdmin={isAdminUser} isManager={isManagerUser} isSrjLabs={isSrjLabsUser} />

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  )
}
