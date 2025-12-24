"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { unstable_noStore as noStore } from "next/cache"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"
import { getNextLotNumber } from "@/lib/lot-number"
import { getQboConnectionStatus, createQboBill, fetchQboItemById } from "@/lib/qbo"

interface BatchReceivingItem {
  productId: string
  quantity: number
  unitType: "CASE" | "LBS" | "EACH"
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

  if (!session.user.id) {
    throw new Error("Invalid session: User ID is missing. Please log out and log in again.")
  }

  if (session.user.role !== "ADMIN" && session.user.role !== "RECEIVER" && session.user.role !== "MANAGER") {
    throw new Error("Insufficient permissions")
  }

  try {
    // Verify user exists in database before proceeding
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true },
    })

    if (!user) {
      console.error(
        `[Receiving] User not found in database. Session user ID: ${session.user.id}, Email: ${session.user.email}`
      )
      throw new Error(
        `User not found in database. Please log out and log in again. (User ID: ${session.user.id})`
      )
    }

    // Use transaction to ensure all-or-nothing behavior
    const result = await prisma.$transaction(async (tx) => {
      // 1. Generate receipt number
      const { getNextReceiptNumber } = await import("@/lib/receipt-number")
      const receiptNumber = await getNextReceiptNumber(tx)
      
      // 2. Create the ReceivingEvent
      // Note: Using type assertion because Prisma client types are out of sync with schema
      const receivingEvent = await tx.receivingEvent.create({
        data: {
          receipt_number: receiptNumber,
          vendor_id: input.vendorId,
          received_date: input.date,
          created_by: session.user.id,
        } as any,
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

        // Generate sequential lot number: Format 01 + 6-digit sequence (e.g., 01000001)
        const lotNumber = await getNextLotNumber(tx)

        // Calculate expiry date (10 days from received date for produce)
        const expiryDate = new Date(input.date)
        expiryDate.setDate(expiryDate.getDate() + 10)

        // Convert quantity based on unit type
        // If receiving in LBS but product unit_type is CASE, convert to cases
        // If receiving in CASE and product unit_type is CASE, use as-is
        let finalQuantity = item.quantity
        if (item.unitType === "LBS" && product.unit_type === "CASE") {
          if (!product.standard_case_weight || product.standard_case_weight <= 0) {
            throw new Error(
              `Product ${product.name} requires standard_case_weight to convert from LBS to CASE`
            )
          }
          // Convert pounds to cases: divide by case weight
          finalQuantity = item.quantity / product.standard_case_weight
        } else if (item.unitType === "CASE" && product.unit_type === "LBS") {
          // If receiving in CASE but product unit_type is LBS, convert to pounds
          if (!product.standard_case_weight || product.standard_case_weight <= 0) {
            throw new Error(
              `Product ${product.name} requires standard_case_weight to convert from CASE to LBS`
            )
          }
          // Convert cases to pounds: multiply by case weight
          finalQuantity = item.quantity * product.standard_case_weight
        }
        // If unit types match (CASE/CASE or LBS/LBS), use quantity as-is

        // Create inventory lot
        const lot = await tx.inventoryLot.create({
          data: {
            lot_number: lotNumber,
            product_id: product.id,
            receiving_event_id: receivingEvent.id,
            original_quantity: finalQuantity,
            quantity_received: finalQuantity,
            quantity_current: finalQuantity,
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
    // Note: Using type assertion because Prisma client types are out of sync with schema
    const resultWithVendor = result as any
    await logActivity(
      session.user.id,
      AuditAction.RECEIVE,
      EntityType.RECEIVING_EVENT,
      result.id,
      {
        vendor: resultWithVendor.vendor?.name || "Unknown",
        vendor_code: resultWithVendor.vendor?.code || "Unknown",
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
 * Also creates a Bill in QuickBooks Online if QBO is connected
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
    // Fetch the full receiving event with vendor and lots
    const event = await prisma.receivingEvent.findUnique({
      where: { id: eventId },
      include: {
        vendor: {
          select: {
            id: true,
            name: true,
            qbo_id: true,
          },
        },
        lots: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                qbo_id: true,
                unit_type: true,
              },
            },
          },
        },
      },
    })

    if (!event) {
      throw new Error("Receiving event not found")
    }

    // Try to create QBO bill if QBO is connected and vendor/product have QBO IDs
    let qboBillId: string | null = null
    let qboSyncToken: string | null = null
    let qboError: string | null = null

    try {
      const qboStatus = await getQboConnectionStatus()
      
      if (qboStatus.connected && event.vendor.qbo_id) {
        // Check if all products have QBO IDs
        const allProductsHaveQboId = event.lots.every(
          lot => lot.product.qbo_id
        )

        if (allProductsHaveQboId) {
          // Fetch purchase costs from QBO for each product
          const lineItems = await Promise.all(
            event.lots.map(async (lot) => {
              const product = lot.product
              if (!product.qbo_id) {
                throw new Error(`Product ${product.name} missing QBO ID`)
              }

              // Fetch item from QBO to get purchase cost
              const qboItem = await fetchQboItemById(product.qbo_id)
              const unitPrice = qboItem?.PurchaseCost || 0

              return {
                itemQboId: product.qbo_id,
                itemName: product.name,
                quantity: lot.quantity_received,
                unitPrice: unitPrice,
              }
            })
          )

          // Create bill in QBO
          const bill = await createQboBill(
            event.vendor.qbo_id,
            event.receipt_number,
            event.received_date,
            lineItems
          )

          qboBillId = bill.Id
          qboSyncToken = bill.SyncToken

          console.log(
            `✅ Created QBO bill ${bill.Id} for receiving event ${eventId}`
          )
        } else {
          qboError = "Some products are missing QBO IDs. Sync products from QBO first."
          console.warn(
            `⚠️  Cannot create QBO bill: ${qboError}`
          )
        }
      } else if (qboStatus.connected && !event.vendor.qbo_id) {
        qboError = "Vendor is missing QBO ID. Sync vendors from QBO first."
        console.warn(`⚠️  Cannot create QBO bill: ${qboError}`)
      }
    } catch (qboSyncError) {
      // Don't fail finalization if QBO sync fails - just log the error
      qboError = qboSyncError instanceof Error 
        ? qboSyncError.message 
        : "Unknown QBO sync error"
      console.error(
        `❌ Failed to create QBO bill for receiving event ${eventId}:`,
        qboSyncError
      )
    }

    // Update status to FINALIZED and include QBO bill info if created
    const updatedEvent = await prisma.receivingEvent.update({
      where: { id: eventId },
      data: {
        status: "FINALIZED",
        finalized_at: new Date(),
        ...(qboBillId && qboSyncToken ? {
          qbo_id: qboBillId,
          qbo_sync_token: qboSyncToken,
        } : {}),
      } as any,
      include: {
        vendor: { select: { name: true } },
        lots: { select: { id: true } },
      },
    })

    // Log the finalization (include QBO sync status)
    await logActivity(
      session.user.id,
      AuditAction.FINALIZE,
      EntityType.RECEIVING_EVENT,
      eventId,
      {
        vendor: updatedEvent.vendor.name,
        lots_count: updatedEvent.lots.length,
        summary: `Finalized receiving event for ${updatedEvent.vendor.name}`,
        qbo_bill_id: qboBillId || undefined,
        qbo_sync_error: qboError || undefined,
      }
    )

    revalidatePath("/dashboard/receiving/history")
    return {
      success: true,
      qboBillId: qboBillId || undefined,
      qboError: qboError || undefined,
    }
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
