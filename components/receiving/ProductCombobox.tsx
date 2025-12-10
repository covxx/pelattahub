"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Product } from "@/types/product"

interface ProductComboboxProps {
  products: Product[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
}

export const ProductCombobox = React.memo(function ProductCombobox({
  products,
  value,
  onValueChange,
  disabled,
}: ProductComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const selectedProduct = products.find((p) => p.id === value)

  // Filter products by name, SKU, OR GTIN
  const filteredProducts = React.useMemo(() => {
    if (!searchQuery) return products

    const query = searchQuery.toLowerCase()
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        product.gtin.toLowerCase().includes(query)
    )
  }, [products, searchQuery])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-2xl h-16 font-semibold"
          disabled={disabled}
        >
          {selectedProduct ? (
            <span>{selectedProduct.name}</span>
          ) : (
            <span className="text-muted-foreground font-normal">
              Select Product...
            </span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by name, SKU, or GTIN..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup>
              {filteredProducts.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.id}
                  onSelect={() => {
                    onValueChange(product.id)
                    setOpen(false)
                    setSearchQuery("")
                  }}
                  className="text-xl py-3"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === product.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div className="flex-1">
                    <div className="font-semibold">{product.name}</div>
                    <div className="text-sm text-muted-foreground space-x-2">
                      <span>SKU: {product.sku}</span>
                      <span>•</span>
                      <span>GTIN: {product.gtin}</span>
                      {product.variety && (
                        <>
                          <span>•</span>
                          <span>{product.variety}</span>
                        </>
                      )}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
})

