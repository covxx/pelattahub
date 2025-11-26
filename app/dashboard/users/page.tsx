import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { UsersTable } from "@/components/users/UsersTable"
import { getUsers } from "@/app/actions/users"

export default async function UsersPage() {
  const session = await auth()

  // Security check: Only admins can access
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/")
  }

  const users = await getUsers()

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Manage system users and their roles
          </p>
        </div>
      </div>

      <UsersTable initialUsers={users} />
    </div>
  )
}

