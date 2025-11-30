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
    const auditLogs = await prisma.auditLog.findMany({
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

    return auditLogs
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

