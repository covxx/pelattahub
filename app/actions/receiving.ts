"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { unstable_noStore as noStore } from "next/cache"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"

interface BatchReceivingItem {
  productId: string
  quantity: number
}

interface BatchReceivingInput {
  date: Date
  vendorId: string
  items: BatchReceivingItem[]
}

export async function receiveBatchInventory(input: BatchReceivingInput) {
  const session = await auth()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "RECEIVER" && session.user.role !== "MANAGER") {
    throw new Error("Insufficient permissions")
  }

  try {
    // Use transaction to ensure all-or-nothing behavior
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the ReceivingEvent
      const receivingEvent = await tx.receivingEvent.create({
        data: {
          vendor_id: input.vendorId,
          received_date: input.date,
          created_by: session.user.id,
        },
        include: {
          vendor: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      // 2. Process each item
      const lots = []

      for (const item of input.items) {
        // Fetch product details
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          select: {
            id: true,
            sku: true,
            name: true,
            gtin: true,
            default_origin_country: true,
            unit_type: true,
            variety: true,
            standard_case_weight: true,
          },
        })

        if (!product) {
          throw new Error(`Product not found: ${item.productId}`)
        }

        if (!product.gtin) {
          throw new Error(`Product ${product.name} is missing GTIN`)
        }

        // Generate lot number: Format YYYYMMDD-{VendorCode}-{ProductSKU}-RAND
        const dateStr = input.date.toISOString().split("T")[0].replace(/-/g, "")
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
        const lotNumber = `${dateStr}-${receivingEvent.vendor.code}-${product.sku}-${randomSuffix}`

        // Calculate expiry date (10 days from received date for produce)
        const expiryDate = new Date(input.date)
        expiryDate.setDate(expiryDate.getDate() + 10)

        // Create inventory lot
        const lot = await tx.inventoryLot.create({
          data: {
            lot_number: lotNumber,
            product_id: product.id,
            receiving_event_id: receivingEvent.id,
            original_quantity: item.quantity,
            quantity_received: item.quantity,
            quantity_current: item.quantity,
            received_date: input.date,
            expiry_date: expiryDate,
            origin_country: product.default_origin_country,
            status: "RECEIVED",
          },
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                gtin: true,
                variety: true,
                unit_type: true,
                standard_case_weight: true,
              },
            },
          },
        })

        lots.push(lot)
      }

      // Return the complete receiving event with all lots and product details
      return {
        ...receivingEvent,
        lots,
      }
    })

    // Log the receiving event
    await logActivity(
      session.user.id,
      AuditAction.RECEIVE,
      EntityType.RECEIVING_EVENT,
      result.id,
      {
        vendor: result.vendor.name,
        vendor_code: result.vendor.code,
        items_count: result.lots.length,
        total_quantity: result.lots.reduce((sum, lot) => sum + lot.original_quantity, 0),
        summary: `Created receiving event with ${result.lots.length} lot(s)`,
      }
    )

    revalidatePath("/dashboard/inventory")
    revalidatePath("/dashboard/receiving")

    return { success: true, receivingEvent: result }
  } catch (error) {
    console.error("Error in batch receiving:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to process batch receiving",
    }
  }
}

/**
 * Get all receiving events with their lots
 * 
 * Note: Uses noStore() to prevent caching - receiving data is highly dynamic
 */
export async function getReceivingEvents(limit = 50) {
  // Prevent Next.js from caching this data - receiving events change frequently
  noStore()
  
  const events = await prisma.receivingEvent.findMany({
    take: limit,
    orderBy: {
      received_date: "desc",
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
            },
          },
        },
      },
    },
  })

  return events
}

/**
 * Get a single receiving event by ID
 */
export async function getReceivingEvent(id: string) {
  const event = await prisma.receivingEvent.findUnique({
    where: { id },
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
              id: true,
              sku: true,
              name: true,
              gtin: true,
              variety: true,
              unit_type: true,
              standard_case_weight: true,
            },
          },
        },
      },
    },
  })

  return event
}

/**
 * Get receiving events with date range filter
 * 
 * Note: Uses noStore() to prevent caching - receiving history is highly dynamic
 */
export async function getReceivingHistory(filters?: {
  startDate?: Date
  endDate?: Date
  vendorId?: string
  status?: "OPEN" | "FINALIZED"
}) {
  // Prevent Next.js from caching this data - receiving events change frequently
  noStore()
  
  const where: any = {}

  if (filters?.startDate || filters?.endDate) {
    where.received_date = {}
    if (filters.startDate) where.received_date.gte = filters.startDate
    if (filters.endDate) where.received_date.lte = filters.endDate
  }

  if (filters?.vendorId) {
    where.vendor_id = filters.vendorId
  }

  if (filters?.status) {
    where.status = filters.status
  }

  const events = await prisma.receivingEvent.findMany({
    where,
    orderBy: {
      received_date: "desc",
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
        select: {
          id: true,
          original_quantity: true,
          product: {
            select: {
              unit_type: true,
            },
          },
        },
      },
    },
  })

  return events
}

/**
 * Update a lot's quantity (only allowed if receiving event is OPEN)
 */
export async function updateLotQuantity(
  lotId: string,
  newQuantity: number
) {
  const session = await auth()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "RECEIVER" && session.user.role !== "MANAGER") {
    throw new Error("Insufficient permissions")
  }

  try {
    // Check if the lot's receiving event is still OPEN
    const lot = await prisma.inventoryLot.findUnique({
      where: { id: lotId },
      include: {
        receivingEvent: true,
      },
    })

    if (!lot) {
      throw new Error("Lot not found")
    }

    if (lot.receivingEvent?.status === "FINALIZED") {
      throw new Error("Cannot modify finalized receiving event")
    }

    // Update the lot
    const updatedLot = await prisma.inventoryLot.update({
      where: { id: lotId },
      data: {
        original_quantity: newQuantity,
        quantity_received: newQuantity,
        quantity_current: newQuantity,
      },
      include: {
        product: { select: { name: true, sku: true } },
      },
    })

    // Log the change
    await logActivity(
      session.user.id,
      AuditAction.UPDATE,
      EntityType.LOT,
      lotId,
      {
        lot_number: lot.lot_number,
        product: updatedLot.product.name,
        old_quantity: lot.original_quantity,
        new_quantity: newQuantity,
        summary: `Updated lot ${lot.lot_number} quantity from ${lot.original_quantity} to ${newQuantity}`,
      }
    )

    revalidatePath("/dashboard/receiving/history")
    return { success: true }
  } catch (error) {
    console.error("Error updating lot quantity:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update lot",
    }
  }
}

/**
 * Delete a lot (only allowed if receiving event is OPEN)
 */
export async function deleteLot(lotId: string) {
  const session = await auth()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "RECEIVER" && session.user.role !== "MANAGER") {
    throw new Error("Insufficient permissions")
  }

  try {
    // Check if the lot's receiving event is still OPEN
    const lot = await prisma.inventoryLot.findUnique({
      where: { id: lotId },
      include: {
        receivingEvent: true,
        product: { select: { name: true } },
      },
    })

    if (!lot) {
      throw new Error("Lot not found")
    }

    if (lot.receivingEvent?.status === "FINALIZED") {
      throw new Error("Cannot modify finalized receiving event")
    }

    // Log before deleting
    await logActivity(
      session.user.id,
      AuditAction.DELETE,
      EntityType.LOT,
      lotId,
      {
        lot_number: lot.lot_number,
        product: lot.product?.name,
        quantity: lot.original_quantity,
        summary: `Deleted lot ${lot.lot_number}`,
      }
    )

    // Delete the lot
    await prisma.inventoryLot.delete({
      where: { id: lotId },
    })

    revalidatePath("/dashboard/receiving/history")
    return { success: true }
  } catch (error) {
    console.error("Error deleting lot:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete lot",
    }
  }
}

/**
 * Finalize a receiving event (prevent further edits)
 */
export async function finalizeReceivingEvent(eventId: string) {
  const session = await auth()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  if (session.user.role !== "ADMIN") {
    throw new Error("Only admins can finalize receiving events")
  }

  try {
    const event = await prisma.receivingEvent.update({
      where: { id: eventId },
      data: {
        status: "FINALIZED",
        finalized_at: new Date(),
      },
      include: {
        vendor: { select: { name: true } },
        lots: { select: { id: true } },
      },
    })

    // Log the finalization
    await logActivity(
      session.user.id,
      AuditAction.FINALIZE,
      EntityType.RECEIVING_EVENT,
      eventId,
      {
        vendor: event.vendor.name,
        lots_count: event.lots.length,
        summary: `Finalized receiving event for ${event.vendor.name}`,
      }
    )

    revalidatePath("/dashboard/receiving/history")
    return { success: true }
  } catch (error) {
    console.error("Error finalizing receiving event:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to finalize event",
    }
  }
}

/**
 * Finalize all OPEN receiving events older than 24 hours (End of Day action)
 */
export async function finalizePreviousDays() {
  const session = await auth()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  if (session.user.role !== "ADMIN") {
    throw new Error("Only admins can finalize previous days")
  }

  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    yesterday.setHours(0, 0, 0, 0)

    const result = await prisma.receivingEvent.updateMany({
      where: {
        status: "OPEN",
        received_date: {
          lt: yesterday,
        },
      },
      data: {
        status: "FINALIZED",
        finalized_at: new Date(),
      },
    })

    // Log the bulk finalization
    await logActivity(
      session.user.id,
      AuditAction.FINALIZE,
      EntityType.RECEIVING_EVENT,
      "BULK",
      {
        count: result.count,
        cutoff_date: yesterday.toISOString(),
        summary: `Bulk finalized ${result.count} receiving event(s) older than ${yesterday.toLocaleDateString()}`,
      }
    )

    revalidatePath("/dashboard/receiving/history")
    return { success: true, count: result.count }
  } catch (error) {
    console.error("Error finalizing previous days:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to finalize events",
    }
  }
}

/**
 * Get top 5 most frequent vendors from receiving history
 */
export async function getTopVendors(limit = 5) {
  const vendors = await prisma.receivingEvent.groupBy({
    by: ["vendor_id"],
    _count: {
      vendor_id: true,
    },
    orderBy: {
      _count: {
        vendor_id: "desc",
      },
    },
    take: limit,
  })

  // Fetch full vendor details
  const vendorIds = vendors.map((v) => v.vendor_id)
  const vendorDetails = await prisma.vendor.findMany({
    where: {
      id: {
        in: vendorIds,
      },
    },
  })

  // Sort by frequency
  return vendorDetails.sort((a, b) => {
    const aCount = vendors.find((v) => v.vendor_id === a.id)?._count.vendor_id || 0
    const bCount = vendors.find((v) => v.vendor_id === b.id)?._count.vendor_id || 0
    return bCount - aCount
  })
}
