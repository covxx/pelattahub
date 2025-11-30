"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  if (session.user.role !== "ADMIN") {
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

  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = filters.startDate
    if (filters.endDate) where.createdAt.lte = filters.endDate
  }

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
    take: filters?.limit || 100,
  })

  return logs
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
    },
  })

  if (!lot) {
    return null
  }

  // Get all audit logs for this lot
  const auditTrail = await prisma.auditLog.findMany({
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

  return {
    lot,
    auditTrail,
  }
}

/**
 * Search for receiving events by PO number, lot number, or vendor
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

  return {
    events,
    lots,
  }
}


