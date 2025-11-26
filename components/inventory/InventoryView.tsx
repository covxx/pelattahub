"use client"

import { useState, useMemo } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LotRow } from "./LotRow"
import type { InventoryLot } from "@/types/inventory"

interface InventoryViewProps {
  initialLots: InventoryLot[]
}

export function InventoryView({ initialLots }: InventoryViewProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(
    new Set()
  )
  const [lots] = useState<InventoryLot[]>(initialLots)

  // Group lots by product
  const groupedLots = useMemo(() => {
    const groups = new Map<string, InventoryLot[]>()
    lots.forEach((lot) => {
      const productId = lot.product.id
      if (!groups.has(productId)) {
        groups.set(productId, [])
      }
      groups.get(productId)!.push(lot)
    })
    return groups
  }, [lots])

  const toggleProduct = (productId: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) {
        next.delete(productId)
      } else {
        next.add(productId)
      }
      return next
    })
  }

  const getDaysLeft = (expiryDate: Date | string) => {
    const expiry = new Date(expiryDate)
    const now = new Date()
    const daysUntilExpiry = Math.ceil(
      (expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    )
    return daysUntilExpiry
  }

  const getExpiryStatus = (daysLeft: number) => {
    if (daysLeft < 0) {
      return "expired" // Red
    } else if (daysLeft <= 3) {
      return "warning" // Yellow
    }
    return "ok" // Normal
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Product / Lot</TableHead>
            <TableHead>Lot #</TableHead>
            <TableHead>Qty</TableHead>
            <TableHead>Received Date</TableHead>
            <TableHead>Expiry Date</TableHead>
            <TableHead>Days Left</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from(groupedLots.entries()).map(([productId, productLots]) => {
            const product = productLots[0].product
            const isExpanded = expandedProducts.has(productId)
            const totalLots = productLots.length
            const totalQuantity = productLots.reduce(
              (sum, lot) => sum + lot.quantity_current,
              0
            )

            return (
              <>
                {/* Product Group Header */}
                <TableRow
                  key={`product-${productId}`}
                  className="bg-muted/50 cursor-pointer hover:bg-muted"
                  onClick={() => toggleProduct(productId)}
                >
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleProduct(productId)
                      }}
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </TableCell>
                  <TableCell className="font-semibold">
                    {product.name}
                    {product.variety && (
                      <span className="text-muted-foreground font-normal ml-2">
                        ({product.variety})
                      </span>
                    )}
                    <span className="text-sm text-muted-foreground font-normal ml-2">
                      SKU: {product.sku}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {totalLots} lot{totalLots !== 1 ? "s" : ""}
                    </span>
                  </TableCell>
                  <TableCell className="font-medium">
                    {totalQuantity.toLocaleString()}
                  </TableCell>
                  <TableCell colSpan={5}></TableCell>
                </TableRow>

                {/* Individual Lots */}
                {isExpanded &&
                  productLots.map((lot) => {
                    const daysLeft = getDaysLeft(lot.expiry_date)
                    const expiryStatus = getExpiryStatus(daysLeft)
                    return (
                      <LotRow
                        key={lot.id}
                        lot={lot}
                        daysLeft={daysLeft}
                        expiryStatus={expiryStatus}
                      />
                    )
                  })}
              </>
            )
          })}

          {groupedLots.size === 0 && (
            <TableRow>
              <TableCell
                colSpan={9}
                className="text-center text-muted-foreground"
              >
                No inventory lots found
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

