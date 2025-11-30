"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { format } from "date-fns"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Lock, Eye } from "lucide-react"
import { finalizePreviousDays } from "@/app/actions/receiving"
import type { ReceivingStatus } from "@/types/receiving"

interface ReceivingEvent {
  id: string
  received_date: Date | string
  status: ReceivingStatus
  vendor: {
    name: string
    code: string
  }
  user: {
    name: string | null
  }
  lots: Array<{
    id: string
    original_quantity: number
    product: {
      unit_type: string
    }
  }>
}

interface ReceivingHistoryTableProps {
  events: ReceivingEvent[]
  userRole: string
}

export function ReceivingHistoryTable({
  events,
  userRole,
}: ReceivingHistoryTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dateFilter, setDateFilter] = useState("")
  const [vendorFilter, setVendorFilter] = useState("")

  const handleFinalizePreviousDays = async () => {
    if (!confirm("Finalize all open events older than yesterday?")) return

    startTransition(async () => {
      const result = await finalizePreviousDays()
      if (result.success) {
        alert(`Successfully finalized ${result.count} events`)
        router.refresh()
      } else {
        alert(`Error: ${result.error}`)
      }
    })
  }

  // Filter events
  const filteredEvents = events.filter((event) => {
    if (dateFilter) {
      const eventDate = format(new Date(event.received_date), "yyyy-MM-dd")
      if (!eventDate.includes(dateFilter)) return false
    }
    if (vendorFilter) {
      if (
        !event.vendor.name.toLowerCase().includes(vendorFilter.toLowerCase())
      ) {
        return false
      }
    }
    return true
  })

  // Calculate totals for each event
  const eventsWithTotals = filteredEvents.map((event) => {
    const totalQty = event.lots.reduce(
      (sum, lot) => sum + lot.original_quantity,
      0
    )
    const itemsCount = event.lots.length
    return { ...event, totalQty, itemsCount }
  })

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Receiving Events</CardTitle>
          {userRole === "ADMIN" && (
            <Button
              onClick={handleFinalizePreviousDays}
              disabled={isPending}
              variant="outline"
              className="gap-2"
            >
              <Lock className="h-4 w-4" />
              Finalize Previous Days
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex gap-4 mt-4">
          <Input
            type="date"
            placeholder="Filter by date..."
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="max-w-xs"
          />
          <Input
            placeholder="Filter by vendor..."
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="max-w-xs"
          />
        </div>
      </CardHeader>

      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total Qty</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Received By</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventsWithTotals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No receiving events found
                </TableCell>
              </TableRow>
            ) : (
              eventsWithTotals.map((event) => (
                <TableRow key={event.id}>
                  <TableCell>
                    {format(new Date(event.received_date), "MM/dd/yyyy")}
                  </TableCell>
                  <TableCell>
                    {event.vendor.name}
                    <span className="text-xs text-muted-foreground ml-2">
                      ({event.vendor.code})
                    </span>
                  </TableCell>
                  <TableCell className="text-right">{event.itemsCount}</TableCell>
                  <TableCell className="text-right">{event.totalQty}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        event.status === "OPEN"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                      }`}
                    >
                      {event.status === "OPEN" ? (
                        <>🟢 Open</>
                      ) : (
                        <>🔒 Finalized</>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">
                    {event.user.name || "Unknown"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        router.push(`/dashboard/receiving/history/${event.id}`)
                      }
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {eventsWithTotals.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {eventsWithTotals.length} of {events.length} events
          </div>
        )}
      </CardContent>
    </Card>
  )
}

