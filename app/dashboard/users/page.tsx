import { UsersTable } from "@/components/users/UsersTable"
import { getUsers } from "@/app/actions/users"

export const dynamic = "force-dynamic"

export default async function UsersPage() {
  const users = await getUsers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">User Management</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Manage system users and their roles
        </p>
      </div>

      <UsersTable initialUsers={users} />
    </div>
  )
}

