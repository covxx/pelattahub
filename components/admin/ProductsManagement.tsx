"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { DataTable } from "@/components/admin/DataTable"
import { AddProductDialog } from "@/components/products/AddProductDialog"
import { EditProductDialog } from "@/components/products/EditProductDialog"
import { DeleteProductDialog } from "@/components/products/DeleteProductDialog"
import { SmartImportModal } from "@/components/admin/SmartImportModal"
import { Button } from "@/components/ui/button"
import { Upload, Plus } from "lucide-react"
import type { Product } from "@/types/product"

interface ProductsManagementProps {
  products: Product[]
}

export function ProductsManagement({ products: initialProducts }: ProductsManagementProps) {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleProductAdded = (newProduct: Product) => {
    setProducts((prev) => [newProduct, ...prev])
    setIsAddDialogOpen(false)
    router.refresh()
  }

  const handleProductUpdated = (updatedProduct: Product) => {
    setProducts((prev) =>
      prev.map((product) =>
        product.id === updatedProduct.id ? updatedProduct : product
      )
    )
    setEditingProduct(null)
    router.refresh()
  }

  const handleProductDeleted = (productId: string) => {
    setProducts((prev) => prev.filter((product) => product.id !== productId))
    setDeletingProduct(null)
    router.refresh()
  }

  const columns = [
    {
      header: "Image",
      cell: (row: Product) => (
        row.image_url ? (
          <img src={row.image_url} alt={row.name} className="h-10 w-10 object-cover rounded" />
        ) : (
          <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded flex items-center justify-center text-xs text-muted-foreground">
            No img
          </div>
        )
      ),
    },
    {
      header: "Name",
      accessorKey: "name" as keyof Product,
    },
    {
      header: "SKU",
      accessorKey: "sku" as keyof Product,
      cell: (row: Product) => (
        <span className="font-mono text-sm">{row.sku}</span>
      ),
    },
    {
      header: "GTIN",
      accessorKey: "gtin" as keyof Product,
      cell: (row: Product) => (
        <span className="font-mono text-sm">{row.gtin}</span>
      ),
    },
    {
      header: "Unit Type",
      accessorKey: "unit_type" as keyof Product,
    },
    {
      header: "Case Weight",
      cell: (row: Product) => (
        row.standard_case_weight ? (
          <span>{row.standard_case_weight} lbs</span>
        ) : (
          <span className="text-muted-foreground italic">Not set</span>
        )
      ),
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold">Products</h2>
        <div className="flex gap-2">
          <Button onClick={() => setIsAddDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Product
          </Button>
          <Button variant="outline" onClick={() => setIsImportModalOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Import
          </Button>
        </div>
      </div>
      <DataTable
        title=""
        data={products}
        columns={columns}
        searchPlaceholder="Search products by name, SKU, or GTIN..."
        getRowId={(row) => row.id}
        searchKeys={["name", "sku", "gtin"]}
        onEdit={(product) => setEditingProduct(product as Product)}
        onDelete={(product) => setDeletingProduct(product as Product)}
      />

      <SmartImportModal
        open={isImportModalOpen}
        onOpenChange={setIsImportModalOpen}
        type="PRODUCT"
      />

      <AddProductDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
        onProductAdded={handleProductAdded}
      />

      {editingProduct && (
        <EditProductDialog
          product={editingProduct}
          open={!!editingProduct}
          onOpenChange={(open) => !open && setEditingProduct(null)}
          onProductUpdated={handleProductUpdated}
        />
      )}

      {deletingProduct && (
        <DeleteProductDialog
          product={deletingProduct}
          open={!!deletingProduct}
          onOpenChange={(open) => !open && setDeletingProduct(null)}
          onProductDeleted={handleProductDeleted}
        />
      )}
    </div>
  )
}


