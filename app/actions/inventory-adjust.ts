"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"
import { revalidatePath } from "next/cache"
import { LotStatus } from "@prisma/client"

interface AdjustLotQuantityInput {
  lotId: string
  newQuantity: number
  reason: string
  notes?: string
}

/**
 * Adjust inventory lot quantity with full audit logging
 */
export async function adjustLotQuantity(input: AdjustLotQuantityInput) {
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: "Unauthorized - Please log in",
    }
  }

  // Allow ADMIN, RECEIVER, and MANAGER roles to adjust inventory
  const allowedRoles = ["ADMIN", "RECEIVER", "MANAGER"]
  if (!allowedRoles.includes(session.user.role)) {
    return {
      success: false,
      error: "Insufficient permissions to adjust inventory",
    }
  }

  const { lotId, newQuantity, reason, notes } = input

  // Validate quantity
  if (newQuantity < 0) {
    return {
      success: false,
      error: "Quantity cannot be negative",
    }
  }

  try {
    // Fetch the current lot with product details
    const lot = await prisma.inventoryLot.findUnique({
      where: { id: lotId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            unit_type: true,
          },
        },
        receivingEvent: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    })

    if (!lot) {
      return {
        success: false,
        error: "Lot not found",
      }
    }

    const oldQuantity = lot.quantity_current
    const diff = newQuantity - oldQuantity

    // Determine new status based on quantity
    let newStatus = lot.status
    if (newQuantity === 0) {
      // If quantity is zero, mark as DEPLETED
      newStatus = LotStatus.DEPLETED
    } else if ((lot.status === LotStatus.EXPIRED || lot.status === LotStatus.DEPLETED) && newQuantity > 0) {
      // If restoring quantity to a previously expired/depleted lot, mark as AVAILABLE
      newStatus = LotStatus.AVAILABLE
    }

    // Update the lot
    const updatedLot = await prisma.inventoryLot.update({
      where: { id: lotId },
      data: {
        quantity_current: newQuantity,
        status: newStatus,
      },
    })

    // Create comprehensive audit log
    await logActivity(
      session.user.id,
      AuditAction.ADJUST_QTY,
      EntityType.LOT,
      lotId,
      {
        lot_number: lot.lot_number,
        product_id: lot.product.id,
        product_name: lot.product.name,
        product_sku: lot.product.sku,
        old_qty: oldQuantity,
        new_qty: newQuantity,
        diff: diff,
        unit_type: lot.product.unit_type,
        reason: reason,
        notes: notes || null,
        old_status: lot.status,
        new_status: newStatus,
        adjusted_by: session.user.name || session.user.email,
        summary: `${reason}: Adjusted ${lot.product.name} (Lot ${lot.lot_number}) from ${oldQuantity} to ${newQuantity} ${lot.product.unit_type} (${diff > 0 ? '+' : ''}${diff})`,
      }
    )

    // Revalidate relevant paths
    revalidatePath("/dashboard/inventory")
    revalidatePath("/dashboard/receiving/history")
    revalidatePath("/dashboard/admin/traceability")

    return {
      success: true,
      data: {
        lot: updatedLot,
        oldQuantity,
        newQuantity,
        diff,
        statusChanged: newStatus !== lot.status,
      },
    }
  } catch (error) {
    console.error("Error adjusting lot quantity:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to adjust inventory",
    }
  }
}

/**
 * Get adjustment history for a specific lot
 */
export async function getLotAdjustmentHistory(lotId: string) {
  const session = await auth()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  try {
    const adjustments = await prisma.auditLog.findMany({
      where: {
        entity_id: lotId,
        entity_type: EntityType.LOT,
        action: AuditAction.ADJUST_QTY,
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
        createdAt: "desc",
      },
    })

    return adjustments
  } catch (error) {
    console.error("Error fetching adjustment history:", error)
    return []
  }
}

