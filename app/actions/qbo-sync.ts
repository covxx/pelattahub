"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"
import crypto from "crypto"
import {
  mapQboCustomerToWms,
  mapQboItemToWms,
  mapQboVendorToWms,
  getQboConnectionStatus,
  fetchQboByQuery,
} from "@/lib/qbo"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"

type SyncEntity = "customers" | "items" | "vendors" | "invoices"

async function resolveUserId(preferredUserId: string): Promise<string> {
  // Return a user id that exists in DB, fallback to first admin/manager
  const preferred = await prisma.user.findUnique({ where: { id: preferredUserId } })
  if (preferred) return preferred.id

  const fallback = await prisma.user.findFirst({
    where: { role: { in: ["ADMIN", "MANAGER"] } } as any,
    orderBy: { createdAt: "asc" },
  })
  if (fallback) return fallback.id

  throw new Error("No valid user found to attribute QBO sync actions")
}

function safeDateFromMetadata(value: unknown): Date | null {
  if (!value || typeof value !== "string") return null
  const d = new Date(value)
  return isNaN(d.getTime()) ? null : d
}

async function getLastSyncTimestamp(entity: SyncEntity): Promise<Date | null> {
  const settings = await prisma.integrationSettings.findUnique({
    where: { provider: "qbo" },
  })
  const metadata = (settings as any)?.metadata
  const lastSync = metadata?.lastSync?.[entity]
  return safeDateFromMetadata(lastSync)
}

async function setLastSyncTimestamp(entity: SyncEntity, date: Date): Promise<void> {
  const settings = await prisma.integrationSettings.findUnique({
    where: { provider: "qbo" },
  })
  const existingMetadata = ((settings as any)?.metadata || {}) as Record<string, any>
  const existingLastSync = (existingMetadata.lastSync || {}) as Record<string, string>

  const nextMetadata = {
    ...existingMetadata,
    lastSync: {
      ...existingLastSync,
      [entity]: date.toISOString(),
    },
  }

  await prisma.integrationSettings.update({
    where: { provider: "qbo" },
    data: {
      metadata: nextMetadata,
    } as any,
  })
}

function buildSyncQuery(entity: SyncEntity, lastSync: Date | null): string {
  const baseLimit = 1000
  const formattedDate = lastSync ? lastSync.toISOString() : null

  switch (entity) {
    case "customers":
      return formattedDate
        ? `SELECT * FROM Customer WHERE MetaData.LastUpdatedTime > '${formattedDate}' MAXRESULTS ${baseLimit}`
        : `SELECT * FROM Customer MAXRESULTS ${baseLimit}`
    case "items":
      return formattedDate
        ? `SELECT * FROM Item WHERE MetaData.LastUpdatedTime > '${formattedDate}' MAXRESULTS ${baseLimit}`
        : `SELECT * FROM Item MAXRESULTS ${baseLimit}`
    case "vendors":
      return formattedDate
        ? `SELECT * FROM Vendor WHERE MetaData.LastUpdatedTime > '${formattedDate}' MAXRESULTS ${baseLimit}`
        : `SELECT * FROM Vendor MAXRESULTS ${baseLimit}`
    case "invoices":
      // Only open invoices (non-zero balance). Use inequality to avoid parser issues.
      return formattedDate
        ? `SELECT * FROM Invoice WHERE Balance != '0' AND MetaData.LastUpdatedTime > '${formattedDate}' MAXRESULTS 500`
        : `SELECT * FROM Invoice WHERE Balance != '0' MAXRESULTS 500`
    default:
      return ""
  }
}

async function requireAdminOrManager() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    throw new Error("Admin or Manager access required")
  }
  return session
}

/**
 * Import customers from QuickBooks Online
 * Upserts QBO customers into WMS customers table
 */
export async function importQboCustomers() {
  const session = await requireAdminOrManager()

  try {
    // Check connection status
    const connectionStatus = await getQboConnectionStatus()
    if (!connectionStatus.connected) {
      return {
        success: false,
        error: "QuickBooks Online is not connected. Please connect first.",
      }
    }

    const actorUserId = await resolveUserId(session.user.id)

    // Fetch customers from QBO (with fallback if lastSync yields zero)
    const lastSync = await getLastSyncTimestamp("customers")
    let query = buildSyncQuery("customers", lastSync)
    let qboCustomers = await fetchQboByQuery(query)
    if (qboCustomers.length === 0 && lastSync) {
      query = buildSyncQuery("customers", null)
      qboCustomers = await fetchQboByQuery(query)
    }

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
      // Note: Using type assertion because Prisma client types are out of sync with schema
      const existing = await prisma.customer.findFirst({
        where: { qbo_id: qboCustomer.Id } as any,
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
          } as any,
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
          } as any,
        })
        imported++
      }
    }

    // Log activity
    await logActivity(
      session.user.id,
      AuditAction.SYNC,
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
    await setLastSyncTimestamp("customers", new Date())
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
  const session = await requireAdminOrManager()

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
    const actorUserId = await resolveUserId(session.user.id)
    const lastSync = await getLastSyncTimestamp("items")
    let query = buildSyncQuery("items", lastSync)
    let qboItems = await fetchQboByQuery(query)
    if (qboItems.length === 0 && lastSync) {
      query = buildSyncQuery("items", null)
      qboItems = await fetchQboByQuery(query)
    }

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
        // Note: Using type assertion because Prisma client types are out of sync with schema
        const existing = await prisma.product.findFirst({
          where: { qbo_id: qboItem.Id } as any,
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
            } as any,
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
            } as any,
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
      AuditAction.SYNC,
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
    await setLastSyncTimestamp("items", new Date())
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
 * Import vendors from QuickBooks Online
 * Upserts QBO vendors into WMS vendors table
 */
export async function importQboVendors() {
  const session = await requireAdminOrManager()

  try {
    // Check connection status
    const connectionStatus = await getQboConnectionStatus()
    if (!connectionStatus.connected) {
      return {
        success: false,
        error: "QuickBooks Online is not connected. Please connect first.",
      }
    }

    // Fetch vendors from QBO
    const actorUserId = await resolveUserId(session.user.id)
    const lastSync = await getLastSyncTimestamp("vendors")
    let query = buildSyncQuery("vendors", lastSync)
    let qboVendors = await fetchQboByQuery(query)
    if (qboVendors.length === 0 && lastSync) {
      query = buildSyncQuery("vendors", null)
      qboVendors = await fetchQboByQuery(query)
    }

    if (qboVendors.length === 0) {
      return {
        success: true,
        imported: 0,
        updated: 0,
        message: "No vendors found in QuickBooks Online",
      }
    }

    let imported = 0
    let updated = 0

    // Upsert each vendor
    for (const qboVendor of qboVendors) {
      const wmsData = mapQboVendorToWms(qboVendor)

      // Check if vendor exists by qbo_id
      // Note: Using type assertion because Prisma client types are out of sync with schema
      const existing = await prisma.vendor.findFirst({
        where: { qbo_id: qboVendor.Id } as any,
      })

      if (existing) {
        // Update existing vendor
        await prisma.vendor.update({
          where: { id: existing.id },
          data: {
            name: wmsData.name,
            code: wmsData.code,
            qbo_sync_token: wmsData.qbo_sync_token,
            active: wmsData.active,
          } as any,
        })
        updated++
      } else {
        // Check if code already exists
        const codeExists = await prisma.vendor.findUnique({
          where: { code: wmsData.code },
        })

        if (codeExists) {
          // Generate alternative code
          const altCode = `${wmsData.code}-${qboVendor.Id.slice(-2)}`
          await prisma.vendor.create({
            data: {
              name: wmsData.name,
              code: altCode,
              qbo_id: wmsData.qbo_id,
              qbo_sync_token: wmsData.qbo_sync_token,
              active: wmsData.active,
            } as any,
          })
        } else {
          await prisma.vendor.create({
            data: {
              name: wmsData.name,
              code: wmsData.code,
              qbo_id: wmsData.qbo_id,
              qbo_sync_token: wmsData.qbo_sync_token,
              active: wmsData.active,
            } as any,
          })
        }
        imported++
      }
    }

    // Log activity
    await logActivity(
      session.user.id,
      AuditAction.SYNC,
      EntityType.VENDOR,
      "QBO_IMPORT",
      {
        summary: `Imported ${imported} new and updated ${updated} vendors from QuickBooks Online`,
        imported,
        updated,
        total: qboVendors.length,
      }
    )

    revalidatePath("/dashboard/admin/integrations/qbo")
    await setLastSyncTimestamp("vendors", new Date())
    return {
      success: true,
      imported,
      updated,
      total: qboVendors.length,
    }
  } catch (error) {
    console.error("Error importing QBO vendors:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to import vendors",
    }
  }
}

/**
 * Import invoices from QuickBooks Online
 * Creates DRAFT orders in WMS from open QBO invoices
 */
export async function importQboInvoices() {
  const session = await requireAdminOrManager()

  try {
    // Check connection status
    const connectionStatus = await getQboConnectionStatus()
    if (!connectionStatus.connected) {
      return {
        success: false,
        error: "QuickBooks Online is not connected. Please connect first.",
      }
    }

    // Fetch open invoices from QBO
    const actorUserId = await resolveUserId(session.user.id)
    const lastSync = await getLastSyncTimestamp("invoices")
    let query = buildSyncQuery("invoices", lastSync)
    let qboInvoices = await fetchQboByQuery(query)
    if (qboInvoices.length === 0 && lastSync) {
      query = buildSyncQuery("invoices", null)
      qboInvoices = await fetchQboByQuery(query)
    }

    if (qboInvoices.length === 0) {
      return {
        success: true,
        imported: 0,
        message: "No open invoices found in QuickBooks Online",
      }
    }

    let imported = 0
    const errors: string[] = []

    // Process each invoice
    for (const qboInvoice of qboInvoices) {
      try {
        // Check if order already exists for this invoice
        // Note: Using type assertion because Prisma client types are out of sync with schema
        const existingOrder = await prisma.order.findFirst({
          where: {
            qbo_id: qboInvoice.Id,
          } as any,
        })

        if (existingOrder) {
          // Skip if already imported
          continue
        }

        // Find customer by qbo_id
        // Note: Using type assertion because Prisma client types are out of sync with schema
        const customer = await prisma.customer.findFirst({
          where: { qbo_id: qboInvoice.CustomerRef.value } as any,
        })

        if (!customer) {
          errors.push(
            `Customer not found for invoice ${qboInvoice.DocNumber || qboInvoice.Id}. Please sync customers first.`
          )
          continue
        }

        // Create order items from invoice lines
        const orderItems: Array<{
          productId: string
          quantity: number
          unitPrice: number
        }> = []

        for (const line of qboInvoice.Line || []) {
          if (line.DetailType === "SalesItemLineDetail" && line.SalesItemLineDetail) {
            const itemDetail = line.SalesItemLineDetail
            
            // Find product by qbo_id
            // Note: Using type assertion because Prisma client types are out of sync with schema
            const product = await prisma.product.findFirst({
              where: { qbo_id: itemDetail.ItemRef.value } as any,
            })

            if (!product) {
              errors.push(
                `Product not found for item ${itemDetail.ItemRef.name} in invoice ${qboInvoice.DocNumber || qboInvoice.Id}. Please sync products first.`
              )
              continue
            }

            orderItems.push({
              productId: product.id,
              quantity: itemDetail.Qty || 1,
              unitPrice: itemDetail.UnitPrice || 0,
            })
          }
        }

        if (orderItems.length === 0) {
          errors.push(
            `No valid items found in invoice ${qboInvoice.DocNumber || qboInvoice.Id}`
          )
          continue
        }

        // Parse invoice date or use current date + 7 days for delivery
        const invoiceDate = qboInvoice.TxnDate 
          ? new Date(qboInvoice.TxnDate)
          : new Date()
        const deliveryDate = qboInvoice.DueDate
          ? new Date(qboInvoice.DueDate)
          : new Date(invoiceDate.getTime() + 7 * 24 * 60 * 60 * 1000) // Default: 7 days from invoice date

        // Create order with DRAFT status
        // Note: Using type assertion because Prisma client types are out of sync with schema
        const order = await prisma.order.create({
          data: {
            customer_id: customer.id,
            status: "DRAFT",
            qbo_id: qboInvoice.Id,
            qbo_sync_token: qboInvoice.SyncToken,
            order_number: qboInvoice.DocNumber || undefined,
            delivery_date: deliveryDate,
            created_by: actorUserId,
            items: {
              create: orderItems.map(item => ({
                product_id: item.productId,
                quantity_ordered: Math.round(item.quantity),
                unit_price: item.unitPrice,
              })),
            },
          } as any,
        })

        imported++
      } catch (invoiceError) {
        errors.push(
          `Failed to import invoice ${qboInvoice.DocNumber || qboInvoice.Id}: ${
            invoiceError instanceof Error ? invoiceError.message : "Unknown error"
          }`
        )
      }
    }

    // Log activity
    await logActivity(
      actorUserId,
      AuditAction.SYNC,
      EntityType.ORDER,
      "QBO_IMPORT",
      {
        summary: `Imported ${imported} orders from QuickBooks Online invoices`,
        imported,
        total: qboInvoices.length,
        errors: errors.length > 0 ? errors : undefined,
      }
    )

    revalidatePath("/dashboard/admin/integrations/qbo")
    await setLastSyncTimestamp("invoices", new Date())
    return {
      success: true,
      imported,
      total: qboInvoices.length,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error) {
    console.error("Error importing QBO invoices:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to import invoices",
    }
  }
}

/**
 * Get QBO connection status
 */
export async function getQboStatus() {
  await requireAdminOrManager()

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

/**
 * Get QuickBooks OAuth authorization URL
 * Returns the URL that the user should be redirected to for OAuth authorization
 */
export async function getQboAuthUrl() {
  await requireAdminOrManager()

  try {
    const state = crypto.randomBytes(32).toString("hex")
    const cookieStore = await cookies()
    cookieStore.set("qbo_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/api/auth/qbo",
      maxAge: 10 * 60, // 10 minutes
    })

    const { getQboAuthUrl: getAuthUrl } = await import("@/lib/qbo-auth")
    const authUrl = getAuthUrl(state)
    return { success: true, authUrl }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate auth URL",
    }
  }
}


