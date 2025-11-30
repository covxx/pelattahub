"use client"

import { useState } from "react"
import { DataTable } from "@/components/admin/DataTable"
import type { Product } from "@/types/product"

interface ProductsManagementProps {
  products: Product[]
}

export function ProductsManagement({ products }: ProductsManagementProps) {
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
      <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Note:</strong> Products management is now in the Admin workspace. The existing
          product dialogs in the main /dashboard/products page still work for now, but will be
          fully migrated here in the next update.
        </p>
      </div>
      
      <DataTable
        title="Products"
        data={products}
        columns={columns}
        searchPlaceholder="Search products by name, SKU, or GTIN..."
        addButtonLabel="Add Product"
        getRowId={(row) => row.id}
        searchKeys={["name", "sku", "gtin"]}
      />
    </div>
  )
}


