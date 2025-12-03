"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"

/**
 * Get comprehensive audit history for a specific lot
 */
export async function getLotHistory(lotId: string) {
  const session = await auth()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  try {
    // Fetch the lot to get its lot_number
    const lot = await prisma.inventoryLot.findUnique({
      where: { id: lotId },
      select: { lot_number: true },
    })

    if (!lot) {
      throw new Error("Lot not found")
    }

    // Query audit logs that are directly related to this lot ID
    // This includes:
    // 1. Events where entity_type is LOT and entity_id is the lotId
    // 2. PICK events where the lot_id is in the details JSON
    const directLogs = await prisma.auditLog.findMany({
      where: {
        entity_id: lotId,
        entity_type: "LOT",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    })

    // Also fetch PICK events where this lot is referenced in details
    // Note: Prisma doesn't easily support JSON queries, so we'll fetch all PICK events
    // and filter in memory (for small datasets this is acceptable)
    // In production, you might want to use raw SQL or a different approach
    const allPickLogs = await prisma.auditLog.findMany({
      where: {
        action: "PICK",
        entity_type: "ORDER",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 1000, // Limit to recent picks to avoid performance issues
    })

    // Filter PICK logs where lot_id matches
    const pickLogsForLot = allPickLogs.filter((log) => {
      const details = log.details as any
      return details?.lot_id === lotId
    })

    // Combine and sort by date
    const allLogs = [...directLogs, ...pickLogsForLot].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    return allLogs
  } catch (error) {
    console.error("Error fetching lot history:", error)
    throw new Error("Failed to fetch lot history")
  }
}

/**
 * Get history for all lots of a specific product
 */
export async function getProductLotHistory(productId: string, limit = 50) {
  const session = await auth()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  try {
    // Get all lot IDs for this product
    const lots = await prisma.inventoryLot.findMany({
      where: { product_id: productId },
      select: { id: true },
    })

    const lotIds = lots.map((lot) => lot.id)

    // Fetch audit logs for these lots
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        entity_id: {
          in: lotIds,
        },
        entity_type: "LOT",
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
    })

    return auditLogs
  } catch (error) {
    console.error("Error fetching product lot history:", error)
    throw new Error("Failed to fetch product history")
  }
}

