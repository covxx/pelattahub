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
import type { Vendor } from "@/types/receiving"

interface VendorComboboxProps {
  vendors: Vendor[]
  value: string
  onValueChange: (value: string) => void
  disabled?: boolean
}

export function VendorCombobox({
  vendors,
  value,
  onValueChange,
  disabled,
}: VendorComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  const selectedVendor = vendors.find((v) => v.id === value)

  // Filter vendors by name OR code
  const filteredVendors = React.useMemo(() => {
    if (!searchQuery) return vendors

    const query = searchQuery.toLowerCase()
    return vendors.filter(
      (vendor) =>
        vendor.name.toLowerCase().includes(query) ||
        vendor.code.toLowerCase().includes(query)
    )
  }, [vendors, searchQuery])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between text-lg h-14"
          disabled={disabled}
        >
          {selectedVendor ? (
            <span className="font-semibold">
              {selectedVendor.name} ({selectedVendor.code})
            </span>
          ) : (
            <span className="text-muted-foreground">Select vendor...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search vendors..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>No vendor found.</CommandEmpty>
            <CommandGroup>
              {filteredVendors.map((vendor) => (
                <CommandItem
                  key={vendor.id}
                  value={vendor.id}
                  onSelect={() => {
                    onValueChange(vendor.id)
                    setOpen(false)
                    setSearchQuery("")
                  }}
                  className="text-lg py-3"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === vendor.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <div>
                    <div className="font-semibold">{vendor.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Code: {vendor.code}
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
}

