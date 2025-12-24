"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "SRJLABS") {
    throw new Error("Admin access required")
  }
  return session
}

/**
 * Get audit logs with filters
 */
export async function getAuditLogs(filters?: {
  userId?: string
  action?: string
  entityType?: string
  startDate?: Date
  endDate?: Date
  limit?: number
  page?: number
  search?: string
}) {
  await requireAdmin()

  const where: any = {}

  if (filters?.userId) {
    where.user_id = filters.userId
  }

  if (filters?.action) {
    where.action = filters.action
  }

  if (filters?.entityType) {
    where.entity_type = filters.entityType
  }

  if (filters?.search) {
    const search = filters.search.trim()
    if (search.length > 0) {
      where.OR = [
        { entity_id: { contains: search, mode: "insensitive" } },
        { entity_type: { contains: search, mode: "insensitive" } },
        { action: { contains: search, mode: "insensitive" } },
        { user: { name: { contains: search, mode: "insensitive" } } },
        { user: { email: { contains: search, mode: "insensitive" } } },
        // Try to match summary inside details JSON if available
        { details: { path: ["summary"], string_contains: search } },
      ]
    }
  }

  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = filters.startDate
    if (filters.endDate) where.createdAt.lte = filters.endDate
  }

  const take = filters?.limit && filters.limit > 0 ? filters.limit : 100
  const page = filters?.page && filters.page > 0 ? filters.page : 1
  const skip = (page - 1) * take

  const total = await prisma.auditLog.count({ where })

  const logs = await prisma.auditLog.findMany({
    where,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    skip,
    take,
  })

  return {
    logs,
    total,
    page,
    limit: take,
  }
}

/**
 * Get audit logs for a specific entity
 */
export async function getEntityAuditTrail(entityType: string, entityId: string) {
  await requireAdmin()

  const logs = await prisma.auditLog.findMany({
    where: {
      entity_type: entityType,
      entity_id: entityId,
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return logs
}

/**
 * Get unique action types for filtering
 */
export async function getAuditActions() {
  await requireAdmin()

  const actions = await prisma.auditLog.findMany({
    select: {
      action: true,
    },
    distinct: ["action"],
    orderBy: {
      action: "asc",
    },
  })

  return actions.map((a) => a.action)
}

/**
 * Get lot lifecycle data for traceability
 */
export async function getLotLifecycle(lotId: string) {
  await requireAdmin()

  // Get the lot with all related data
  // Note: Using type assertion because Prisma client types are out of sync with schema
  const lot = await prisma.inventoryLot.findUnique({
    where: { id: lotId },
    include: {
      product: true,
      receivingEvent: {
        include: {
          vendor: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
      parentLot: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      },
      childLots: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      },
    } as any,
  })

  if (!lot) {
    return null
  }

  // Get production run for this lot (if it was produced from a parent)
  // Note: Using type assertion because Prisma client types are out of sync with schema
  let parentProductionRun = null
  const lotWithParent = lot as any
  if (lotWithParent.parent_lot_id) {
    parentProductionRun = await (prisma as any).productionRun.findFirst({
      where: {
        destination_lot_id: lotId,
        source_lot_id: lotWithParent.parent_lot_id,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        created_at: "desc",
      },
    })
  }

  // Get production runs for child lots (if this lot was consumed)
  // Note: Using type assertion because Prisma client types are out of sync with schema
  const childProductionRuns = await (prisma as any).productionRun.findMany({
    where: {
      source_lot_id: lotId,
    },
    include: {
      destinationLot: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      },
      user: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      created_at: "desc",
    },
  })

  // Get all audit logs for this lot
  const lotAuditLogs = await prisma.auditLog.findMany({
    where: {
      entity_type: "LOT",
      entity_id: lotId,
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  // Also get audit logs for the receiving event (if lot was received)
  let receivingEventAuditLogs: any[] = []
  const lotWithEvent = lot as any
  if (lotWithEvent.receivingEvent?.id) {
    receivingEventAuditLogs = await prisma.auditLog.findMany({
      where: {
        entity_type: "RECEIVING_EVENT",
        entity_id: lotWithEvent.receivingEvent.id,
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })
  }

  // Combine and sort all audit logs by date (most recent first)
  const auditTrail = [...lotAuditLogs, ...receivingEventAuditLogs].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  )

  // Get outbound shipping history - orders where this lot was picked
  let outboundHistory: any[] = []
  try {
    outboundHistory = await prisma.orderPick.findMany({
      where: {
        inventory_lot_id: lotId,
      },
      include: {
        order_item: {
          include: {
            order: {
              include: {
                customer: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                  },
                },
              },
            },
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit_type: true,
              },
            },
          },
        },
        picked_by_user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        picked_at: "desc",
      },
    })
  } catch (error) {
    console.error("Error fetching outbound history:", error)
    // Return empty array if query fails - don't break the entire page
    outboundHistory = []
  }

  return {
    lot,
    auditTrail,
    parentProductionRun,
    childProductionRuns,
    outboundHistory,
  }
}

/**
 * Search for receiving events by PO number, lot number, vendor, or order number
 */
export async function searchTraceability(query: string) {
  await requireAdmin()

  // Search receiving events by vendor name or code
  const events = await prisma.receivingEvent.findMany({
    where: {
      OR: [
        { vendor: { name: { contains: query, mode: "insensitive" } } },
        { vendor: { code: { contains: query, mode: "insensitive" } } },
      ],
    },
    include: {
      vendor: true,
      user: {
        select: {
          name: true,
          email: true,
        },
      },
      lots: {
        include: {
          product: {
            select: {
              name: true,
              sku: true,
              unit_type: true,
            },
          },
        },
      },
    },
    take: 10,
    orderBy: {
      received_date: "desc",
    },
  })

  // Search lots by lot number
  const lots = await prisma.inventoryLot.findMany({
    where: {
      lot_number: { contains: query, mode: "insensitive" },
    },
    include: {
      product: true,
      receivingEvent: {
        include: {
          vendor: true,
          user: {
            select: {
              name: true,
            },
          },
        },
      },
    },
    take: 10,
  })

  // Normalize query for status matching
  const normalizedQuery = query.trim().toLowerCase().replace(/[_-]/g, " ")
  
  // Determine if query matches order statuses (using string values)
  const statusMatches: string[] = []
  if (normalizedQuery.includes("ready") && normalizedQuery.includes("ship")) {
    statusMatches.push("READY_TO_SHIP")
  }
  if (normalizedQuery.includes("shipped") || normalizedQuery === "ship") {
    statusMatches.push("SHIPPED")
  }
  if (normalizedQuery.includes("confirmed")) {
    statusMatches.push("CONFIRMED")
  }
  if (normalizedQuery.includes("picking") && !normalizedQuery.includes("partial")) {
    statusMatches.push("PICKING")
  }
  if (normalizedQuery.includes("partial") && normalizedQuery.includes("pick")) {
    statusMatches.push("PARTIAL_PICK")
  }
  if (normalizedQuery.includes("draft")) {
    statusMatches.push("DRAFT")
  }

  // Build where clause for orders
  const orderWhere: any = {
    OR: [
      { order_number: { contains: query, mode: "insensitive" } },
      { po_number: { contains: query, mode: "insensitive" } },
    ],
  }

  // Add status filter if query matches a status
  if (statusMatches.length > 0) {
    orderWhere.OR.push({ status: { in: statusMatches } })
  }

  // Search orders by order_number, po_number, or status
  const orders = await prisma.order.findMany({
    where: orderWhere,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      items: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit_type: true,
            },
          },
          picks: {
            include: {
              inventory_lot: {
                select: {
                  id: true,
                  lot_number: true,
                },
              },
            },
          },
        },
      },
    },
    take: 10,
    orderBy: {
      delivery_date: "desc",
    },
  })

  return {
    events,
    lots,
    orders,
  }
}


