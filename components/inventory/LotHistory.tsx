"use client"

import { useEffect, useState } from "react"
import { getLotHistory } from "@/app/actions/lot-history"
import { formatDistanceToNow } from "date-fns"
import {
  TruckIcon,
  Printer,
  Edit,
  Lock,
  CheckCircle,
  AlertCircle,
  Clock,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AuditLog {
  id: string
  action: string
  entity_type: string
  entity_id: string
  createdAt: Date
  details: any
  user: {
    id: string
    name: string | null
    email: string
  }
}

interface LotHistoryProps {
  lotId: string
  lotNumber: string
}

export function LotHistory({ lotId, lotNumber }: LotHistoryProps) {
  const [history, setHistory] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true)
        setError(null)
        const data = await getLotHistory(lotId)
        setHistory(data as AuditLog[])
      } catch (err) {
        console.error("Failed to fetch lot history:", err)
        setError("Failed to load history")
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [lotId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4 animate-spin" />
          Loading history...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      </div>
    )
  }

  if (history.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-muted-foreground">
          No history available for this lot
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
        History Timeline
      </h3>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gray-200 dark:bg-gray-700" />

        {/* Timeline events */}
        <div className="space-y-4">
          {history.map((event, index) => (
            <TimelineEvent
              key={event.id}
              event={event}
              isLast={index === history.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function TimelineEvent({
  event,
  isLast,
}: {
  event: AuditLog
  isLast: boolean
}) {
  const { icon, color, title, description } = getEventDetails(event)

  return (
    <div className="relative flex gap-3 pb-4">
      {/* Event icon */}
      <div
        className={cn(
          "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-white dark:border-gray-900",
          color
        )}
      >
        {icon}
      </div>

      {/* Event content */}
      <div className="flex-1 pt-0.5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 flex-1">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {title}
            </p>
            {description && (
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Metadata */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-500">
          <div className="flex items-center gap-1">
            <User className="h-3 w-3" />
            <span>{event.user.name || event.user.email}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>
              {formatDistanceToNow(new Date(event.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>

        {/* Additional details */}
        {event.details && shouldShowDetails(event) && (
          <div className="mt-2 rounded-lg bg-gray-50 dark:bg-gray-800/50 p-3 text-xs space-y-1">
            {renderEventDetails(event)}
          </div>
        )}
      </div>
    </div>
  )
}

function getEventDetails(event: AuditLog): {
  icon: React.ReactNode
  color: string
  title: string
  description?: string
} {
  const details = event.details as any

  switch (event.action) {
    case "RECEIVE":
      return {
        icon: <TruckIcon className="h-4 w-4 text-white" />,
        color: "bg-green-500",
        title: "Received from Vendor",
        description: details?.summary || `Received ${details?.quantity_received || 0} units`,
      }

    case "PRINT_LABEL":
      return {
        icon: <Printer className="h-4 w-4 text-white" />,
        color: "bg-purple-500",
        title: "Label Printed",
        description: details?.summary || "PTI compliance label printed",
      }

    case "ADJUST_QTY":
    case "ADJUST_QUANTITY":
      const diff = details?.diff || 0
      const sign = diff > 0 ? "+" : ""
      return {
        icon: <Edit className="h-4 w-4 text-white" />,
        color: "bg-orange-500",
        title: "Quantity Adjusted",
        description: details?.summary || 
          `${details?.old_qty || 0} → ${details?.new_qty || 0} (${sign}${diff})`,
      }

    case "UPDATE":
      return {
        icon: <Edit className="h-4 w-4 text-white" />,
        color: "bg-blue-500",
        title: "Updated",
        description: details?.summary || "Lot information updated",
      }

    case "FINALIZE":
      return {
        icon: <Lock className="h-4 w-4 text-white" />,
        color: "bg-gray-500",
        title: "Receipt Finalized",
        description: details?.summary || "Receiving event finalized",
      }

    case "CREATE":
      return {
        icon: <CheckCircle className="h-4 w-4 text-white" />,
        color: "bg-green-600",
        title: "Lot Created",
        description: details?.summary || "Inventory lot created",
      }

    case "DELETE":
      return {
        icon: <AlertCircle className="h-4 w-4 text-white" />,
        color: "bg-red-500",
        title: "Deleted",
        description: details?.summary || "Lot deleted",
      }

    default:
      return {
        icon: <Clock className="h-4 w-4 text-white" />,
        color: "bg-gray-400",
        title: event.action.replace(/_/g, " ").toLowerCase(),
        description: details?.summary,
      }
  }
}

function shouldShowDetails(event: AuditLog): boolean {
  // Show details for adjustments, updates, and receives
  return ["ADJUST_QTY", "ADJUST_QUANTITY", "UPDATE", "RECEIVE"].includes(
    event.action
  )
}

function renderEventDetails(event: AuditLog) {
  const details = event.details as any

  switch (event.action) {
    case "ADJUST_QTY":
    case "ADJUST_QUANTITY":
      return (
        <>
          {details.reason && (
            <div className="flex justify-between">
              <span className="font-medium text-gray-600 dark:text-gray-400">
                Reason:
              </span>
              <span className="text-gray-900 dark:text-white">
                {details.reason}
              </span>
            </div>
          )}
          {details.notes && (
            <div className="flex justify-between">
              <span className="font-medium text-gray-600 dark:text-gray-400">
                Notes:
              </span>
              <span className="text-gray-900 dark:text-white">
                {details.notes}
              </span>
            </div>
          )}
          {details.old_status !== details.new_status && (
            <div className="flex justify-between">
              <span className="font-medium text-gray-600 dark:text-gray-400">
                Status:
              </span>
              <span className="text-gray-900 dark:text-white">
                {details.old_status} → {details.new_status}
              </span>
            </div>
          )}
        </>
      )

    case "RECEIVE":
      return (
        <>
          {details.vendor_name && (
            <div className="flex justify-between">
              <span className="font-medium text-gray-600 dark:text-gray-400">
                Vendor:
              </span>
              <span className="text-gray-900 dark:text-white">
                {details.vendor_name}
              </span>
            </div>
          )}
          {details.origin_country && (
            <div className="flex justify-between">
              <span className="font-medium text-gray-600 dark:text-gray-400">
                Origin:
              </span>
              <span className="text-gray-900 dark:text-white">
                {details.origin_country}
              </span>
            </div>
          )}
        </>
      )

    case "UPDATE":
      return (
        <>
          {details.old_quantity !== undefined &&
            details.new_quantity !== undefined && (
              <div className="flex justify-between">
                <span className="font-medium text-gray-600 dark:text-gray-400">
                  Quantity:
                </span>
                <span className="text-gray-900 dark:text-white">
                  {details.old_quantity} → {details.new_quantity}
                </span>
              </div>
            )}
        </>
      )

    default:
      return null
  }
}

