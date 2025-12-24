"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"

async function requireAdminOrManager() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER" && session.user.role !== "SRJLABS") {
    throw new Error("Admin or Manager access required")
  }
  return session
}

/**
 * Get a single system setting by key
 */
export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
  })
  return setting?.value || null
}

/**
 * Get all system settings as a key-value object
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const settings = await prisma.systemSetting.findMany()
  
  const result: Record<string, string> = {}
  settings.forEach((setting) => {
    result[setting.key] = setting.value
  })
  
  return result
}

/**
 * Get company-specific settings for labels and receipts
 */
export async function getCompanySettings() {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: ["company_name", "company_address", "gs1_prefix", "company_logo_url"],
      },
    },
  })

  const result = {
    name: "",
    address: "",
    gs1_prefix: "000000",
    logo_url: "",
  }

  settings.forEach((setting) => {
    if (setting.key === "company_name") result.name = setting.value
    if (setting.key === "company_address") result.address = setting.value
    if (setting.key === "gs1_prefix") result.gs1_prefix = setting.value
    if (setting.key === "company_logo_url") result.logo_url = setting.value
  })

  return result
}

/**
 * Update company settings
 * Only ADMIN can update settings
 */
export async function updateCompanySettings(data: {
  company_name?: string
  company_address?: string
  gs1_prefix?: string
  company_logo_url?: string
}) {
  const session = await requireAdminOrManager()

  try {
    const updates = []

    // Prepare updates for each provided field
    if (data.company_name !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: "company_name" },
          create: {
            key: "company_name",
            value: data.company_name,
            description: "Company name displayed on labels and receipts",
            updatedAt: new Date(),
          },
          update: {
            value: data.company_name,
            updatedAt: new Date(),
          },
        })
      )
    }

    if (data.company_address !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: "company_address" },
          create: {
            key: "company_address",
            value: data.company_address,
            description: "Company address for receipts",
            updatedAt: new Date(),
          },
          update: {
            value: data.company_address,
            updatedAt: new Date(),
          },
        })
      )
    }

    if (data.gs1_prefix !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: "gs1_prefix" },
          create: {
            key: "gs1_prefix",
            value: data.gs1_prefix,
            description: "GS1 Company Prefix for GTIN validation",
            updatedAt: new Date(),
          },
          update: {
            value: data.gs1_prefix,
            updatedAt: new Date(),
          },
        })
      )
    }

    // Execute all updates
    await prisma.$transaction(updates)

    // Log the settings update
    await logActivity(
      session.user.id,
      AuditAction.UPDATE,
      EntityType.PRODUCT, // Using PRODUCT as proxy for SETTINGS
      "SYSTEM_SETTINGS",
      {
        changes: data,
        summary: "Updated company settings",
      }
    )

    revalidatePath("/dashboard/admin/settings")
    revalidatePath("/dashboard/receiving")

    return { success: true }
  } catch (error) {
    console.error("Error updating settings:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update settings",
    }
  }
}

/**
 * Update a single setting (generic)
 */
export async function updateSetting(
  key: string,
  value: string,
  description?: string
) {
  await requireAdminOrManager()

  const setting = await prisma.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value,
      description,
      updatedAt: new Date(),
    },
    update: {
      value,
      updatedAt: new Date(),
    },
  })

  revalidatePath("/dashboard/admin/settings")
  return setting
}

/**
 * Require ADMIN role strictly (no MANAGER access)
 */
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
 * Reset database - DANGEROUS OPERATION
 * Deletes all operational data but preserves users
 * 
 * CRITICAL: Only ADMIN can perform this operation
 * CRITICAL: User table is NOT deleted to prevent lockout
 */
export async function resetDatabase(): Promise<{
  success: boolean
  error?: string
  deletedCounts?: {
    orderPicks: number
    orderAllocations: number
    orderItems: number
    orders: number
    inventoryLots: number
    receivingEvents: number
    products: number
    customers: number
    vendors: number
  }
}> {
  const session = await requireAdmin()

  try {
    // Log the reset event BEFORE deletion (so it's preserved)
    // We'll create a special audit log entry
    const currentUserId = session.user.id
    const currentUserEmail = session.user.email

    // Get counts before deletion for reporting
    const [
      orderPicksCount,
      orderAllocationsCount,
      orderItemsCount,
      ordersCount,
      inventoryLotsCount,
      receivingEventsCount,
      productsCount,
      customersCount,
      vendorsCount,
    ] = await Promise.all([
      prisma.orderPick.count(),
      prisma.orderAllocation.count(),
      prisma.orderItem.count(),
      prisma.order.count(),
      prisma.inventoryLot.count(),
      prisma.receivingEvent.count(),
      prisma.product.count(),
      prisma.customer.count(),
      prisma.vendor.count(),
    ])

    // Perform deletion in transaction
    // Order matters due to foreign key constraints (Restrict/Cascade)
    // Delete child tables first, respecting Restrict constraints
    await prisma.$transaction(async (tx) => {
      // 1. Delete OrderPick (references OrderItem, InventoryLot - both will be deleted)
      await tx.orderPick.deleteMany({})
      
      // 2. Delete OrderAllocation (references OrderItem, InventoryLot)
      await tx.orderAllocation.deleteMany({})
      
      // 3. Delete OrderItem (must be deleted before Product due to Restrict constraint)
      await tx.orderItem.deleteMany({})
      
      // 4. Delete Order (must be deleted before Customer due to Restrict constraint)
      await tx.order.deleteMany({})
      
      // 5. Delete InventoryLot (references Product with Cascade, ReceivingEvent with SetNull)
      await tx.inventoryLot.deleteMany({})
      
      // 6. Delete ReceivingEvent (must be deleted before Vendor due to Restrict constraint)
      await tx.receivingEvent.deleteMany({})
      
      // 7. Delete Product (no blocking constraints after OrderItem is deleted)
      await tx.product.deleteMany({})
      
      // 8. Delete Customer (no blocking constraints after Order is deleted)
      await tx.customer.deleteMany({})
      
      // 9. Delete Vendor (no blocking constraints after ReceivingEvent is deleted)
      await tx.vendor.deleteMany({})
      
      // NOTE: User table, AuditLog, SystemSetting, and IntegrationSettings are NOT deleted
    })

    // Log the reset event AFTER deletion (re-create audit log)
    // This ensures the log entry exists even if we deleted audit logs
    try {
      await prisma.auditLog.create({
        data: {
          user_id: currentUserId,
          action: "DATABASE_RESET",
          entity_type: "SYSTEM",
          entity_id: "FULL_RESET",
          details: {
            summary: "Database reset - all operational data deleted",
            deletedCounts: {
              orderPicks: orderPicksCount,
              orderAllocations: orderAllocationsCount,
              orderItems: orderItemsCount,
              orders: ordersCount,
              inventoryLots: inventoryLotsCount,
              receivingEvents: receivingEventsCount,
              products: productsCount,
              customers: customersCount,
              vendors: vendorsCount,
            },
            performedBy: currentUserEmail,
            timestamp: new Date().toISOString(),
          },
        },
      })
    } catch (logError) {
      // If logging fails, continue - the reset was successful
      console.error("Failed to log database reset:", logError)
    }

    // Revalidate all paths
    revalidatePath("/", "layout")

    return {
      success: true,
      deletedCounts: {
        orderPicks: orderPicksCount,
        orderAllocations: orderAllocationsCount,
        orderItems: orderItemsCount,
        orders: ordersCount,
        inventoryLots: inventoryLotsCount,
        receivingEvents: receivingEventsCount,
        products: productsCount,
        customers: customersCount,
        vendors: vendorsCount,
      },
    }
  } catch (error) {
    console.error("Database reset error:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reset database",
    }
  }
}


