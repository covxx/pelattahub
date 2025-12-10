import { getAllUsers } from "@/app/actions/admin/users"
import { UsersManagement } from "@/components/admin/UsersManagement"

export default async function UsersPage() {
  const users = await getAllUsers()

  return <UsersManagement users={users} />
}


