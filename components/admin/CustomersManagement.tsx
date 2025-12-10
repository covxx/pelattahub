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
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/app/actions/admin/customers"

interface Customer {
  id: string
  name: string
  code: string
  address: string | null
  contact_email: string | null
  active: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

interface CustomersManagementProps {
  customers: Customer[]
}

export function CustomersManagement({ customers }: CustomersManagementProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null)
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    address: "",
    contact_email: "",
    active: true,
  })
  const [error, setError] = useState<string | null>(null)

  const handleAdd = () => {
    setEditingCustomer(null)
    setFormData({ name: "", code: "", address: "", contact_email: "", active: true })
    setError(null)
    setDialogOpen(true)
  }

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer)
    setFormData({
      name: customer.name,
      code: customer.code,
      address: customer.address || "",
      contact_email: customer.contact_email || "",
      active: customer.active,
    })
    setError(null)
    setDialogOpen(true)
  }

  const handleDelete = async (customer: Customer) => {
    if (!confirm(`Delete customer "${customer.name}"? This cannot be undone.`)) {
      return
    }

    startTransition(async () => {
      const result = await deleteCustomer(customer.id)
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
      const result = editingCustomer
        ? await updateCustomer(editingCustomer.id, {
            ...formData,
            address: formData.address || null,
            contact_email: formData.contact_email || null,
          })
        : await createCustomer({
            ...formData,
            address: formData.address || undefined,
            contact_email: formData.contact_email || undefined,
          })

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
      accessorKey: "name" as keyof Customer,
    },
    {
      header: "Code",
      accessorKey: "code" as keyof Customer,
      cell: (row: Customer) => (
        <span className="font-mono font-semibold">{row.code}</span>
      ),
    },
    {
      header: "Contact Email",
      cell: (row: Customer) => row.contact_email || <span className="text-muted-foreground italic">Not set</span>,
    },
    {
      header: "Status",
      cell: (row: Customer) => (
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
        <h2 className="text-2xl font-bold">Customers</h2>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>
      </div>
      <DataTable
        title=""
        data={customers}
        columns={columns}
        searchPlaceholder="Search customers by name or code..."
        addButtonLabel="Add Customer"
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        getRowId={(row) => row.id}
        searchKeys={["name", "code"]}
      />

      <SmartImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        type="CUSTOMER"
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCustomer ? "Edit Customer" : "Add New Customer"}
            </DialogTitle>
            <DialogDescription>
              {editingCustomer
                ? "Update customer information"
                : "Create a new customer for order management"}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Customer Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="ABC Restaurant"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="code">Customer Code *</Label>
                <Input
                  id="code"
                  value={formData.code}
                  onChange={(e) =>
                    setFormData({ ...formData, code: e.target.value.toUpperCase() })
                  }
                  placeholder="ABC001"
                  required
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Unique code (e.g., ABC001, REST123)
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Address</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
                placeholder="123 Main St, City, State 12345"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_email">Contact Email</Label>
              <Input
                id="contact_email"
                type="email"
                value={formData.contact_email}
                onChange={(e) =>
                  setFormData({ ...formData, contact_email: e.target.value })
                }
                placeholder="contact@customer.com"
              />
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
                  : editingCustomer
                  ? "Save Changes"
                  : "Create Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}


