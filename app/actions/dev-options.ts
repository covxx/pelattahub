"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

/**
 * Check if current user is SRJLABS (super admin)
 */
async function requireSrjLabs() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  if (session.user.role !== "SRJLABS") {
    throw new Error("SRJLABS access required")
  }
  return session
}

/**
 * Clear all inventory lots
 */
export async function clearInventory() {
  await requireSrjLabs()

  const count = await prisma.inventoryLot.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all orders (and related data)
 */
export async function clearOrders() {
  await requireSrjLabs()

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
  await requireSrjLabs()

  const count = await prisma.customer.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all products
 */
export async function clearProducts() {
  await requireSrjLabs()

  const count = await prisma.product.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all products and reimport from QBO with proper GTIN generation
 */
export async function clearAndReimportProducts() {
  await requireSrjLabs()

  try {
    // Clear all products
    const deletedCount = await prisma.product.deleteMany({})
    
    // Reimport from QBO (this will use the new GTIN generation)
    const { importQboItems } = await import("@/app/actions/qbo-sync")
    const importResult = await importQboItems()
    
    revalidatePath("/dashboard/admin/dev-options")
    return { 
      success: importResult.success, 
      deleted: deletedCount.count,
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
  await requireSrjLabs()

  const count = await prisma.vendor.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all receiving events
 */
export async function clearReceivingEvents() {
  await requireSrjLabs()

  const count = await prisma.receivingEvent.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all production runs
 */
export async function clearProductionRuns() {
  await requireSrjLabs()

  const count = await prisma.productionRun.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all audit logs
 */
export async function clearAuditLogs() {
  await requireSrjLabs()

  const count = await prisma.auditLog.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all system settings
 */
export async function clearSystemSettings() {
  await requireSrjLabs()

  const count = await prisma.systemSetting.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear all integration settings
 */
export async function clearIntegrationSettings() {
  await requireSrjLabs()

  const count = await prisma.integrationSettings.deleteMany({})
  
  revalidatePath("/dashboard/admin/dev-options")
  return { success: true, count: count.count }
}

/**
 * Clear entire database (all tables except users and auth tables)
 * WARNING: This is destructive!
 */
export async function clearAllData() {
  await requireSrjLabs()

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
 * Get database statistics for dev options page
 */
export async function getDevStats() {
  await requireSrjLabs()

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

