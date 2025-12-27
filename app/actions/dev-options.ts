"use server"

import { prisma } from "@/lib/prisma"
import { generateUniqueGTIN, isValidGTIN } from "@/lib/gtin"
import { revalidatePath } from "next/cache"
import { requireAdmin } from "@/lib/auth-helpers"

/**
 * Clear all inventory lots
 */
export async function clearInventory() {
  await requireAdmin()

  // Delete dependent records first due to foreign key restrictions:
  // - order_picks -> inventory_lots (Restrict)
  // - order_allocations -> inventory_lots (Restrict)
  // - production_runs -> inventory_lots (Restrict)
  const result = await prisma.$transaction(async (tx) => {
    const picks = await tx.orderPick.deleteMany({})
    const allocations = await tx.orderAllocation.deleteMany({})
    const productionRuns = await tx.productionRun.deleteMany({})
    const lots = await tx.inventoryLot.deleteMany({})

    return {
      picks: picks.count,
      allocations: allocations.count,
      productionRuns: productionRuns.count,
      lots: lots.count,
    }
  })

  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: result.lots }
}

/**
 * Clear all orders (and related data)
 */
export async function clearOrders() {
  await requireAdmin()

  // Delete in order due to foreign key constraints
  await prisma.orderPick.deleteMany({})
  await prisma.orderAllocation.deleteMany({})
  await prisma.orderItem.deleteMany({})
  const count = await prisma.order.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all customers
 */
export async function clearCustomers() {
  await requireAdmin()

  const count = await prisma.customer.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all products
 */
export async function clearProducts() {
  await requireAdmin()

  const result = await prisma.$transaction(async (tx) => {
    // Remove dependents first due to FK restrictions (picks/allocations/prod runs -> lots -> products, orderItems -> products)
    const picks = await tx.orderPick.deleteMany({})
    const allocations = await tx.orderAllocation.deleteMany({})
    const productionRuns = await tx.productionRun.deleteMany({})
    const orderItems = await tx.orderItem.deleteMany({})
    const lots = await tx.inventoryLot.deleteMany({})
    const products = await tx.product.deleteMany({})

    return {
      picks: picks.count,
      allocations: allocations.count,
      productionRuns: productionRuns.count,
      orderItems: orderItems.count,
      lots: lots.count,
      products: products.count,
    }
  })
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: result.products }
}

/**
 * Clear all products and reimport from QBO with proper GTIN generation
 */
export async function clearAndReimportProducts() {
  await requireAdmin()

  try {
    // Clear all products (and dependents) first
    const cleared = await prisma.$transaction(async (tx) => {
      const picks = await tx.orderPick.deleteMany({})
      const allocations = await tx.orderAllocation.deleteMany({})
      const productionRuns = await tx.productionRun.deleteMany({})
      const orderItems = await tx.orderItem.deleteMany({})
      const lots = await tx.inventoryLot.deleteMany({})
      const products = await tx.product.deleteMany({})
      return {
        picks: picks.count,
        allocations: allocations.count,
        productionRuns: productionRuns.count,
        orderItems: orderItems.count,
        lots: lots.count,
        products: products.count,
      }
    })
    
    // Reimport from QBO (this will use the new GTIN generation)
    const { importQboItems } = await import("@/app/actions/qbo-sync")
    const importResult = await importQboItems()
    
    revalidatePath("/dashboard/admin/dev-options")
    return { 
      success: importResult.success, 
      deleted: cleared.products,
      imported: importResult.imported || 0,
      updated: importResult.updated || 0,
      error: importResult.error
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Clear all vendors
 */
export async function clearVendors() {
  await requireAdmin()

  const count = await prisma.vendor.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all receiving events
 * Note: Also clears related inventory lots and their dependencies due to foreign key constraints
 */
export async function clearReceivingEvents() {
  await requireAdmin()

  try {
    // Delete in order due to foreign key constraints:
    // 1. Order picks (reference inventory lots with onDelete: Restrict)
    // 2. Order allocations (reference inventory lots with onDelete: Restrict)
    // 3. Production runs (reference inventory lots with onDelete: Restrict)
    // 4. Inventory lots (reference receiving events with onDelete: SetNull, but we delete them anyway)
    // 5. Receiving events
    
    // First, get all lots that have receiving_event_id set
    const lotsWithEvents = await prisma.inventoryLot.findMany({
      where: {
        receiving_event_id: { not: null }
      },
      select: { id: true }
    })
    const lotIds = lotsWithEvents.map(l => l.id)
    
    // Delete dependent records if there are any lots
    if (lotIds.length > 0) {
      await prisma.orderPick.deleteMany({
        where: {
          inventory_lot_id: { in: lotIds }
        }
      })
      
      await prisma.orderAllocation.deleteMany({
        where: {
          inventory_lot_id: { in: lotIds }
        }
      })
      
      await prisma.productionRun.deleteMany({
        where: {
          OR: [
            { source_lot_id: { in: lotIds } },
            { destination_lot_id: { in: lotIds } }
          ]
        }
      })
    }
    
    // Delete inventory lots that reference receiving events
    const lotsDeleted = await prisma.inventoryLot.deleteMany({
      where: {
        receiving_event_id: { not: null }
      }
    })
    
    // Finally, delete receiving events
    const count = await prisma.receivingEvent.deleteMany({})
    
    revalidatePath("/dashboard/admin/dev-options")
    return { 
      success: true, 
      count: count.count
    }
  } catch (error) {
    console.error("Error clearing receiving events:", error)
    console.error("Error details:", error instanceof Error ? error.stack : error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to clear receiving events"
    }
  }
}

/**
 * Clear all production runs
 */
export async function clearProductionRuns() {
  await requireAdmin()

  const count = await prisma.productionRun.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all audit logs
 */
export async function clearAuditLogs() {
  await requireAdmin()

  const count = await prisma.auditLog.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all system settings
 */
export async function clearSystemSettings() {
  await requireAdmin()

  const count = await prisma.systemSetting.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all integration settings
 */
export async function clearIntegrationSettings() {
  await requireAdmin()

  const count = await prisma.integrationSettings.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear entire database (all tables except users and auth tables)
 * WARNING: This is destructive!
 */
export async function clearAllData() {
  await requireAdmin()

  // Delete in order due to foreign key constraints
  await prisma.orderPick.deleteMany({})
  await prisma.orderAllocation.deleteMany({})
  await prisma.orderItem.deleteMany({})
  await prisma.order.deleteMany({})
  await prisma.inventoryLot.deleteMany({})
  await prisma.receivingEvent.deleteMany({})
  await prisma.productionRun.deleteMany({})
  await prisma.product.deleteMany({})
  await prisma.customer.deleteMany({})
  await prisma.vendor.deleteMany({})
  await prisma.auditLog.deleteMany({})
  await prisma.systemSetting.deleteMany({})
  await prisma.integrationSettings.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true }
}

/**
 * Repair invalid or duplicate GTINs on products by regenerating unique GTIN14 values.
 * - Regenerates GTINs that are not 14 numeric digits.
 * - Regenerates any GTIN that appears more than once.
 */
export async function repairProductGtins() {
  await requireAdmin()

  const gs1Setting = await prisma.systemSetting.findUnique({
    where: { key: "gs1_prefix" },
  })
  const gs1Prefix = gs1Setting?.value || "000000"

  const products = await prisma.product.findMany({
    select: { id: true, gtin: true },
  })

  const counts = new Map<string, number>()
  for (const p of products) {
    if (p.gtin) {
      counts.set(p.gtin, (counts.get(p.gtin) || 0) + 1)
    }
  }

  const toRepair = products.filter((p) => !isValidGTIN(p.gtin) || (p.gtin ? counts.get(p.gtin)! > 1 : false))

  const updated: { id: string; old: string | null; new: string }[] = []
  const errors: string[] = []

  for (const product of toRepair) {
    try {
      const newGtin = await generateUniqueGTIN(gs1Prefix, product.id, async (candidate) => {
        const exists = await prisma.product.findUnique({ where: { gtin: candidate } })
        return exists !== null && exists.id !== product.id
      })

      await prisma.product.update({
        where: { id: product.id },
        data: { gtin: newGtin },
      })

      updated.push({ id: product.id, old: product.gtin, new: newGtin })
    } catch (err) {
      errors.push(
        `Failed to repair product ${product.id}: ${
          err instanceof Error ? err.message : "Unknown error"
        }`
      )
    }
  }

  revalidatePath("/dashboard/admin/dev-options")
  return {
    success: errors.length === 0,
    repaired: updated.length,
    errors: errors.length > 0 ? errors : undefined,
    details: updated,
  }
}

/**
 * Get database statistics for dev options page
 * Allows ADMIN and SRJLABS (read-only operation)
 */
export async function getDevStats() {
  await requireAdmin()

  const [
    inventoryCount,
    orderCount,
    customerCount,
    productCount,
    vendorCount,
    receivingCount,
    productionCount,
    auditCount,
  ] = await Promise.all([
    prisma.inventoryLot.count(),
    prisma.order.count(),
    prisma.customer.count(),
    prisma.product.count(),
    prisma.vendor.count(),
    prisma.receivingEvent.count(),
    prisma.productionRun.count(),
    prisma.auditLog.count(),
  ])

  return {
    inventoryCount,
    orderCount,
    customerCount,
    productCount,
    vendorCount,
    receivingCount,
    productionCount,
    auditCount,
  }
}

