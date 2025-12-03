"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { DataTable } from "@/components/admin/DataTable"
import { SmartImportModal } from "@/components/admin/SmartImportModal"
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
import { Upload } from "lucide-react"
import {
  createVendor,
  updateVendor,
  deleteVendor,
} from "@/app/actions/admin/vendors"

interface Vendor {
  id: string
  name: string
  code: string
  active: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

interface VendorsManagementProps {
  vendors: Vendor[]
}

export function VendorsManagement({ vendors }: VendorsManagementProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    active: true,
  })
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    setEditingVendor(null)
    setFormData({ name: "", code: "", active: true })
    setError(null)
    setDialogOpen(true)
  }

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor)
    setFormData({
      name: vendor.name,
      code: vendor.code,
      active: vendor.active,
    })
    setError(null)
    setDialogOpen(true)
  }

  const handleDelete = async (vendor: Vendor) => {
    if (!confirm(`Delete vendor "${vendor.name}"? This cannot be undone.`)) {
      return
    }

    startTransition(async () => {
      const result = await deleteVendor(vendor.id)
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
      const result = editingVendor
        ? await updateVendor(editingVendor.id, formData)
        : await createVendor(formData)

      if (result.success) {
        setDialogOpen(false)
        router.refresh()
      } else {
        setError(result.error || "Operation failed")
      }
    })
  }

  const columns = [
    {
      header: "Name",
      accessorKey: "name" as keyof Vendor,
    },
    {
      header: "Vendor Code",
      accessorKey: "code" as keyof Vendor,
      cell: (row: Vendor) => (
        <span className="font-mono font-semibold">{row.code}</span>
      ),
    },
    {
      header: "Status",
      cell: (row: Vendor) => (
        <span
          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
            row.active
              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
              : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
          }`}
        >
          {row.active ? "Active" : "Inactive"}
        </span>
      ),
    },
  ]

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Vendors</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>
      </div>
      <DataTable
        title=""
        data={vendors}
        columns={columns}
        searchPlaceholder="Search vendors by name or code..."
        addButtonLabel="Add Vendor"
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        getRowId={(row) => row.id}
        searchKeys={["name", "code"]}
      />

      <SmartImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        type="VENDOR"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingVendor ? "Edit Vendor" : "Add New Vendor"}
            </DialogTitle>
            <DialogDescription>
              {editingVendor
                ? "Update vendor information"
                : "Create a new vendor for receiving"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Vendor Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Sysco Foods"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="code">Vendor Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value.toUpperCase() })
                }
                placeholder="SYSCO"
                required
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Unique code for quick selection (e.g., SYSCO, LOCAL, GPRO)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="active">Status</Label>
              <Select
                value={formData.active ? "true" : "false"}
                onValueChange={(value) =>
                  setFormData({ ...formData, active: value === "true" })
                }
              >
                <SelectTrigger id="active">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
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
                onClick={() => setDialogOpen(false)}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? "Saving..."
                  : editingVendor
                  ? "Save Changes"
                  : "Create Vendor"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}


