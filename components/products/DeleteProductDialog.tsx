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
import { deleteProduct } from "@/app/actions/products"
import type { Product } from "@/types/product"

interface DeleteProductDialogProps {
  product: Product
  open: boolean
  onOpenChange: (open: boolean) => void
  onProductDeleted: (productId: string) => void
}

export function DeleteProductDialog({
  product,
  open,
  onOpenChange,
  onProductDeleted,
}: DeleteProductDialogProps) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      try {
        const result = await deleteProduct(product.id)
        if (result.success) {
          onProductDeleted(product.id)
          onOpenChange(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to delete product")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Product</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete{" "}
            <span className="font-semibold">{product.name}</span> (SKU:{" "}
            <span className="font-mono">{product.sku}</span>)? This action
            cannot be undone.
            {product._count && product._count.lots > 0 && (
              <span className="block mt-2 text-destructive">
                Warning: This product has {product._count.lots} associated
                inventory lot(s). You must remove all lots before deleting this
                product.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setError(null)
              onOpenChange(false)
            }}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending || (product._count && product._count.lots > 0)}
          >
            {isPending ? "Deleting..." : "Delete Product"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

