"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"
import { ReceivingForm } from "./ReceivingForm"

interface Product {
  id: string
  sku: string
  name: string
  variety: string | null
  gtin: string | null
}

interface InboundViewProps {
  products: Product[]
}

export function InboundView({ products }: InboundViewProps) {
  const [isReceivingFormOpen, setIsReceivingFormOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold">Receive New Lot</h2>
          <p className="text-sm text-muted-foreground">
            Create a new inventory lot for incoming shipments
          </p>
        </div>
        <Button onClick={() => setIsReceivingFormOpen(true)} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Receive Inventory
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <div
            key={product.id}
            className="border rounded-lg p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="font-semibold">{product.name}</h3>
                {product.variety && (
                  <p className="text-sm text-muted-foreground">{product.variety}</p>
                )}
              </div>
              {product.gtin ? (
                <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded dark:bg-green-900 dark:text-green-200">
                  ✓ GTIN
                </span>
              ) : (
                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded dark:bg-red-900 dark:text-red-200">
                  ⚠ No GTIN
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-mono">{product.sku}</p>
            {product.gtin && (
              <p className="text-xs text-muted-foreground mt-1">
                GTIN: {product.gtin}
              </p>
            )}
          </div>
        ))}
      </div>

      {products.filter((p) => !p.gtin).length > 0 && (
        <div className="border border-yellow-200 bg-yellow-50 p-4 rounded-lg dark:border-yellow-800 dark:bg-yellow-950">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            <strong>Warning:</strong> {products.filter((p) => !p.gtin).length}{" "}
            product(s) are missing GTIN data. Please update them in Product
            Management before receiving inventory.
          </p>
        </div>
      )}

      <ReceivingForm
        products={products}
        open={isReceivingFormOpen}
        onOpenChange={setIsReceivingFormOpen}
        onLotCreated={() => {
          // Refresh could be added here if needed
        }}
      />
    </div>
  )
}

