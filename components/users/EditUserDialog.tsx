"use client"

import { useState, useTransition } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateUserRole } from "@/app/actions/users"
import { Role } from "@prisma/client"
import type { User } from "@/types/user"

interface EditUserDialogProps {
  user: User
  open: boolean
  onOpenChange: (open: boolean) => void
  onUserUpdated: (user: User) => void
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
  onUserUpdated,
}: EditUserDialogProps) {
  const [selectedRole, setSelectedRole] = useState<Role>(user.role)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleSave = () => {
    if (selectedRole === user.role) {
      onOpenChange(false)
      return
    }

    setError(null)
    startTransition(async () => {
      try {
        const result = await updateUserRole(user.id, selectedRole)
        if (result.success && result.user) {
          const updatedUser: User = {
            ...user,
            role: result.user.role,
          }
          onUserUpdated(updatedUser)
          onOpenChange(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update user")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
          <DialogDescription>
            Update the role for {user.email}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Name</label>
            <p className="text-sm text-muted-foreground">
              {user.name || "—"}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Email</label>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">Role</label>
            <Select
              value={selectedRole}
              onValueChange={(value) => setSelectedRole(value as Role)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={Role.ADMIN}>Admin</SelectItem>
                <SelectItem value={Role.RECEIVER}>Receiver</SelectItem>
                <SelectItem value={Role.PACKER}>Packer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSelectedRole(user.role)
              setError(null)
              onOpenChange(false)
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

