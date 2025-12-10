"use client"

import { Button } from "@/components/ui/button"
import { Eye } from "lucide-react"
import Link from "next/link"

interface OrderDetailButtonProps {
  order: {
    id: string
  }
}

export function OrderDetailButton({ order }: OrderDetailButtonProps) {
  return (
    <Link href={`/dashboard/orders/${order.id}/view`}>
      <Button variant="outline" size="sm">
        <Eye className="h-4 w-4 mr-2" />
        View Details
      </Button>
    </Link>
  )
}

