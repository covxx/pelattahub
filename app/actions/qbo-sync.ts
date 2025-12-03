"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import {
  fetchQboCustomers,
  fetchQboItems,
  mapQboCustomerToWms,
  mapQboItemToWms,
  getQboConnectionStatus,
} from "@/lib/qbo"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"

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
 * Import customers from QuickBooks Online
 * Upserts QBO customers into WMS customers table
 */
export async function importQboCustomers() {
  const session = await requireAdmin()

  try {
    // Check connection status
    const connectionStatus = await getQboConnectionStatus()
    if (!connectionStatus.connected) {
      return {
        success: false,
        error: "QuickBooks Online is not connected. Please connect first.",
      }
    }

    // Fetch customers from QBO
    const qboCustomers = await fetchQboCustomers()

    if (qboCustomers.length === 0) {
      return {
        success: true,
        imported: 0,
        updated: 0,
        message: "No customers found in QuickBooks Online",
      }
    }

    let imported = 0
    let updated = 0

    // Upsert each customer
    for (const qboCustomer of qboCustomers) {
      const wmsData = mapQboCustomerToWms(qboCustomer)

      // Check if customer exists by qbo_id
      const existing = await prisma.customer.findFirst({
        where: { qbo_id: qboCustomer.Id },
      })

      if (existing) {
        // Update existing customer
        await prisma.customer.update({
          where: { id: existing.id },
          data: {
            name: wmsData.name,
            code: wmsData.code,
            address: wmsData.address,
            contact_email: wmsData.contact_email,
            qbo_sync_token: wmsData.qbo_sync_token,
            active: wmsData.active,
          },
        })
        updated++
      } else {
        // Create new customer
        await prisma.customer.create({
          data: {
            name: wmsData.name,
            code: wmsData.code,
            address: wmsData.address,
            contact_email: wmsData.contact_email,
            qbo_id: wmsData.qbo_id,
            qbo_sync_token: wmsData.qbo_sync_token,
            active: wmsData.active,
          },
        })
        imported++
      }
    }

    // Log activity
    await logActivity(
      session.user.id,
      "SYNC",
      EntityType.CUSTOMER,
      "QBO_IMPORT",
      {
        summary: `Imported ${imported} new and updated ${updated} customers from QuickBooks Online`,
        imported,
        updated,
        total: qboCustomers.length,
      }
    )

    revalidatePath("/dashboard/admin/integrations/qbo")
    return {
      success: true,
      imported,
      updated,
      total: qboCustomers.length,
    }
  } catch (error) {
    console.error("Error importing QBO customers:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to import customers",
    }
  }
}

/**
 * Import items/products from QuickBooks Online
 * Upserts QBO items into WMS products table
 */
export async function importQboItems() {
  const session = await requireAdmin()

  try {
    // Check connection status
    const connectionStatus = await getQboConnectionStatus()
    if (!connectionStatus.connected) {
      return {
        success: false,
        error: "QuickBooks Online is not connected. Please connect first.",
      }
    }

    // Fetch items from QBO
    const qboItems = await fetchQboItems()

    if (qboItems.length === 0) {
      return {
        success: true,
        imported: 0,
        updated: 0,
        message: "No items found in QuickBooks Online",
      }
    }

    let imported = 0
    let updated = 0
    const errors: string[] = []

    // Upsert each item
    for (const qboItem of qboItems) {
      try {
        const wmsData = mapQboItemToWms(qboItem)

        // Check if product exists by qbo_id
        const existing = await prisma.product.findFirst({
          where: { qbo_id: qboItem.Id },
        })

        if (existing) {
          // Update existing product
          await prisma.product.update({
            where: { id: existing.id },
            data: {
              name: wmsData.name,
              sku: wmsData.sku,
              gtin: wmsData.gtin,
              description: wmsData.description,
              qbo_sync_token: wmsData.qbo_sync_token,
            },
          })
          updated++
        } else {
          // Check if SKU already exists (to avoid conflicts)
          const skuExists = await prisma.product.findUnique({
            where: { sku: wmsData.sku },
          })

          if (skuExists) {
            errors.push(
              `SKU ${wmsData.sku} already exists. Skipping ${qboItem.Name}`
            )
            continue
          }

          // Create new product
          await prisma.product.create({
            data: {
              name: wmsData.name,
              sku: wmsData.sku,
              gtin: wmsData.gtin,
              description: wmsData.description,
              default_origin_country: "USA", // Default value
              unit_type: "CASE", // Default value
              qbo_id: wmsData.qbo_id,
              qbo_sync_token: wmsData.qbo_sync_token,
            },
          })
          imported++
        }
      } catch (itemError) {
        errors.push(
          `Failed to import ${qboItem.Name}: ${
            itemError instanceof Error ? itemError.message : "Unknown error"
          }`
        )
      }
    }

    // Log activity
    await logActivity(
      session.user.id,
      "SYNC",
      EntityType.PRODUCT,
      "QBO_IMPORT",
      {
        summary: `Imported ${imported} new and updated ${updated} products from QuickBooks Online`,
        imported,
        updated,
        total: qboItems.length,
        errors: errors.length > 0 ? errors : undefined,
      }
    )

    revalidatePath("/dashboard/admin/integrations/qbo")
    return {
      success: true,
      imported,
      updated,
      total: qboItems.length,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error("Error importing QBO items:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to import items",
    }
  }
}

/**
 * Get QBO connection status
 */
export async function getQboStatus() {
  await requireAdmin()

  try {
    const status = await getQboConnectionStatus()
    return { success: true, ...status }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get status",
    }
  }
}


