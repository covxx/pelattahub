"use client"

import { useState, useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Search, ChevronRight, Package } from "lucide-react"
import { ProductDetailSheet } from "./ProductDetailSheet"

interface Product {
  id: string
  sku: string
  name: string
  variety: string | null
  gtin: string | null
  unit_type: string
  standard_case_weight: number | null
  total_on_hand: number
  active_lot_count: number
  lots: Array<{
    id: string
    lot_number: string
    quantity_received: number
    quantity_current: number
    received_date: Date | string
    expiry_date: Date | string
    origin_country: string
    status: string
  }>
}

interface InventoryHubProps {
  initialCatalog: Product[]
}

export function InventoryHub({ initialCatalog }: InventoryHubProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") || "")
  const [showOutOfStock, setShowOutOfStock] = useState(
    searchParams.get("showOutOfStock") === "true"
  )
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [catalog, setCatalog] = useState(initialCatalog)

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set("search", value)
      } else {
        params.delete("search")
      }
      router.push(`?${params.toString()}`)
    })
  }

  const handleToggleOutOfStock = (checked: boolean) => {
    setShowOutOfStock(checked)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (checked) {
        params.set("showOutOfStock", "true")
      } else {
        params.delete("showOutOfStock")
      }
      router.push(`?${params.toString()}`)
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Inventory</h1>
        <p className="text-muted-foreground">
          View and manage product inventory across all lots
        </p>
      </div>

      {/* Search & Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by Name, SKU, or GTIN..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10 text-lg h-12"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={showOutOfStock}
            onCheckedChange={handleToggleOutOfStock}
            id="show-out-of-stock"
          />
          <label
            htmlFor="show-out-of-stock"
            className="text-sm font-medium cursor-pointer"
          >
            Show Out of Stock
          </label>
        </div>
      </div>

      {/* Master Table */}
      <div className="border rounded-lg overflow-hidden">
        {catalog.length === 0 ? (
          <div className="text-center py-12">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-lg font-semibold">No products found</p>
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? `No products match "${searchQuery}"`
                : "No products in inventory"}
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {/* Table Header */}
            <div className="bg-muted/50 px-6 py-3 grid grid-cols-12 gap-4 text-sm font-semibold">
              <div className="col-span-5">Product</div>
              <div className="col-span-2">SKU</div>
              <div className="col-span-2">Stock Status</div>
              <div className="col-span-2">Lots</div>
              <div className="col-span-1"></div>
            </div>

            {/* Table Rows */}
            {catalog.map((product) => (
              <button
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className="w-full px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-accent/50 transition-colors text-left"
              >
                {/* Product Name & Variety */}
                <div className="col-span-5">
                  <p className="text-lg font-bold">{product.name}</p>
                  {product.variety && (
                    <p className="text-sm text-muted-foreground">
                      {product.variety}
                    </p>
                  )}
                </div>

                {/* SKU */}
                <div className="col-span-2 font-mono text-sm">
                  {product.sku}
                </div>

                {/* Stock Status */}
                <div className="col-span-2">
                  {product.total_on_hand > 0 ? (
                    <Badge className="bg-green-500 text-white">
                      {product.total_on_hand} {product.unit_type}
                    </Badge>
                  ) : (
                    <Badge variant="secondary">Out of Stock</Badge>
                  )}
                </div>

                {/* Active Lots */}
                <div className="col-span-2 text-sm text-muted-foreground">
                  {product.active_lot_count} active
                </div>

                {/* Action */}
                <div className="col-span-1 flex justify-end">
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Detail Sheet */}
      <ProductDetailSheet
        product={selectedProduct}
        open={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  )
}


