"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { DataTable } from "@/components/admin/DataTable"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
} from "@/app/actions/admin/users"

interface User {
  id: string
  name: string | null
  email: string
  role: "ADMIN" | "RECEIVER" | "PACKER"
  createdAt: Date | string
  updatedAt: Date | string
}

interface UsersManagementProps {
  users: User[]
}

export function UsersManagement({ users }: UsersManagementProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [resettingUser, setResettingUser] = useState<User | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    role: "RECEIVER" as "ADMIN" | "RECEIVER" | "PACKER",
  })
  const [newPassword, setNewPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    setEditingUser(null)
    setFormData({ name: "", email: "", password: "", role: "RECEIVER" })
    setError(null)
    setDialogOpen(true)
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setFormData({
      name: user.name || "",
      email: user.email,
      password: "",
      role: user.role,
    })
    setError(null)
    setDialogOpen(true)
  }

  const handleResetPassword = (user: User) => {
    setResettingUser(user)
    setNewPassword("")
    setError(null)
    setResetPasswordDialogOpen(true)
  }

  const handleDelete = async (user: User) => {
    if (!confirm(`Delete user "${user.name || user.email}"? This cannot be undone.`)) {
      return
    }

    startTransition(async () => {
      const result = await deleteUser(user.id)
      if (result.success) {
        router.refresh()
      } else {
        alert(result.error)
      }
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      const result = editingUser
        ? await updateUser(editingUser.id, {
            name: formData.name,
            email: formData.email,
            role: formData.role,
          })
        : await createUser(formData)

      if (result.success) {
        setDialogOpen(false)
        router.refresh()
      } else {
        setError(result.error || "Operation failed")
      }
    })
  }

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!resettingUser) return

    startTransition(async () => {
      const result = await resetUserPassword(resettingUser.id, newPassword)
      if (result.success) {
        setResetPasswordDialogOpen(false)
        alert("Password reset successfully")
      } else {
        setError(result.error || "Failed to reset password")
      }
    })
  }

  const columns = [
    {
      header: "Name",
      cell: (row: User) => row.name || <span className="text-muted-foreground italic">No name</span>,
    },
    {
      header: "Email",
      accessorKey: "email" as keyof User,
    },
    {
      header: "Role",
      cell: (row: User) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.role === "ADMIN"
              ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400"
              : row.role === "RECEIVER"
              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
              : "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
          }`}
        >
          {row.role}
        </span>
      ),
    },
    {
      header: "Created",
      cell: (row: User) => format(new Date(row.createdAt), "MM/dd/yyyy"),
    },
  ]

  return (
    <>
      <DataTable
        title="Users"
        data={users}
        columns={columns}
        searchPlaceholder="Search users by name or email..."
        addButtonLabel="Add User"
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        getRowId={(row) => row.id}
        searchKeys={["name", "email"]}
      />

      {/* Add/Edit User Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingUser ? "Edit User" : "Add New User"}
            </DialogTitle>
            <DialogDescription>
              {editingUser
                ? "Update user information. Use 'Reset Password' button to change password."
                : "Create a new user account"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="John Doe"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                placeholder="john@example.com"
                required
              />
            </div>

            {!editingUser && (
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="••••••••"
                  required
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">
                  Minimum 6 characters
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="role">Role *</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData({ ...formData, role: value as any })
                }
              >
                <SelectTrigger id="role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Admin</SelectItem>
                  <SelectItem value="RECEIVER">Receiver</SelectItem>
                  <SelectItem value="PACKER">Packer</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                ADMIN: Full system access. RECEIVER: Receiving operations. PACKER: Order fulfillment.
              </p>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                {error}
              </div>
            )}

            <DialogFooter className="gap-2">
              {editingUser && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setDialogOpen(false)
                    handleResetPassword(editingUser)
                  }}
                >
                  Reset Password
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Saving..."
                  : editingUser
                  ? "Save Changes"
                  : "Create User"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter a new password for {resettingUser?.name || resettingUser?.email}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password *</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Minimum 6 characters
              </p>
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setResetPasswordDialogOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Resetting..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}


