/**
 * QuickBooks Online Sync Functions for Standalone Scripts
 *
 * These functions are designed to be called from Node.js scripts without
 * HTTP request context. They bypass authentication checks and can be used
 * in automated sync services.
 */

import { prisma } from "@/lib/prisma"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"
import {
  mapQboCustomerToWms,
  mapQboItemToWms,
  mapQboVendorToWms,
  getQboConnectionStatus as getConnectionStatus,
  fetchQboByQuery,
} from "@/lib/qbo"

/**
 * Resolve a valid system user ID for audit logging
 * Finds an existing admin/manager user since audit logs require valid user_id
 */
export async function resolveSystemUserId(): Promise<string> {
  // Try to find an admin user first
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" } as any,
    orderBy: { createdAt: "asc" },
  })

  if (adminUser) return adminUser.id

  // Fallback to manager user
  const managerUser = await prisma.user.findFirst({
    where: { role: "MANAGER" } as any,
    orderBy: { createdAt: "asc" },
  })

  if (managerUser) return managerUser.id

  // If no admin/manager found, this is a critical error
  throw new Error("No admin or manager user found for system audit logging. Please ensure at least one admin user exists.")
}

/**
 * Check QBO connection status (standalone version)
 */
export async function getQboStatus() {
  try {
    const status = await getConnectionStatus()
    return { success: true, ...status }
  } catch (error) {
    return {
      success: false,
      connected: false,
      error: error instanceof Error ? error.message : "Failed to get status",
    }
  }
}

/**
 * Import customers from QuickBooks Online (standalone version)
 */
export async function importQboCustomers() {
  try {
    // Check connection status
    const connectionStatus = await getQboStatus()
    if (!connectionStatus.success || !connectionStatus.connected) {
      return {
        success: false,
        error: "QuickBooks Online is not connected. Please connect first.",
      }
    }

    const userId = await resolveSystemUserId() // Valid admin/manager user for audit logging

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
      userId,
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
 * Import items/products from QuickBooks Online (standalone version)
 */
export async function importQboItems() {
  try {
    // Check connection status
    const connectionStatus = await getQboStatus()
    if (!connectionStatus.success || !connectionStatus.connected) {
      return {
        success: false,
        error: "QuickBooks Online is not connected. Please connect first.",
      }
    }

    const userId = await resolveSystemUserId() // Valid admin/manager user for audit logging

    // Fetch items from QBO
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
      userId,
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
 * Import vendors from QuickBooks Online (standalone version)
 */
export async function importQboVendors() {
  try {
    // Check connection status
    const connectionStatus = await getQboStatus()
    if (!connectionStatus.success || !connectionStatus.connected) {
      return {
        success: false,
        error: "QuickBooks Online is not connected. Please connect first.",
      }
    }

    const userId = await resolveSystemUserId() // Valid admin/manager user for audit logging

    // Fetch vendors from QBO
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
      userId,
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
 * Import invoices from QuickBooks Online (standalone version)
 */
export async function importQboInvoices() {
  try {
    // Check connection status
    const connectionStatus = await getQboStatus()
    if (!connectionStatus.success || !connectionStatus.connected) {
      return {
        success: false,
        error: "QuickBooks Online is not connected. Please connect first.",
      }
    }

    const userId = await resolveSystemUserId() // Valid admin/manager user for audit logging

    // Fetch open invoices from QBO
    const lastSync = await getLastSyncTimestamp("invoices")
    let query = buildSyncQuery("invoices", lastSync)
    let qboInvoices = await fetchQboByQuery(query)
    if (qboInvoices.length === 0 && lastSync) {
      query = buildSyncQuery("invoices", null)
      qboInvoices = await fetchQboByQuery(query)
    }

    console.log(`Found ${qboInvoices.length} open invoices in QuickBooks`)

    if (qboInvoices.length === 0) {
      return {
        success: true,
        imported: 0,
        message: "No open invoices found in QuickBooks Online",
      }
    }

    let imported = 0
    const errors: string[] = []
    console.log(`Processing ${qboInvoices.length} invoices...`)

    // Process each invoice
    for (const qboInvoice of qboInvoices) {
      try {
        // Check if order already exists for this invoice
        const existingOrder = await prisma.order.findFirst({
          where: {
            qbo_id: qboInvoice.Id,
          } as any,
        })

        if (existingOrder) {
          // Skip if already imported
          console.log(`Skipping invoice ${qboInvoice.DocNumber || qboInvoice.Id} - already imported as order ${existingOrder.id}`)
          continue
        }

        // Find customer by qbo_id
        const customer = await prisma.customer.findFirst({
          where: { qbo_id: qboInvoice.CustomerRef.value } as any,
        })

        if (!customer) {
          console.log(`Customer not found for invoice ${qboInvoice.DocNumber || qboInvoice.Id}. Customer QBO ID: ${qboInvoice.CustomerRef.value}`)
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
            const product = await prisma.product.findFirst({
              where: { qbo_id: itemDetail.ItemRef.value } as any,
            })

            if (!product) {
              console.log(`Product not found for item ${itemDetail.ItemRef.name} in invoice ${qboInvoice.DocNumber || qboInvoice.Id}. Product QBO ID: ${itemDetail.ItemRef.value}`)
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
        const order = await prisma.order.create({
          data: {
            customer_id: customer.id,
            status: "DRAFT",
            qbo_id: qboInvoice.Id,
            qbo_sync_token: qboInvoice.SyncToken,
            order_number: qboInvoice.DocNumber || undefined,
            delivery_date: deliveryDate,
            created_by: userId,
            items: {
              create: orderItems.map(item => ({
                product_id: item.productId,
                quantity_ordered: Math.round(item.quantity),
                unit_price: item.unitPrice,
              })),
            },
          } as any,
        })

        console.log(`Successfully created order for invoice ${qboInvoice.DocNumber || qboInvoice.Id}`)
        imported++
      } catch (invoiceError) {
        console.error(`Failed to import invoice ${qboInvoice.DocNumber || qboInvoice.Id}:`, invoiceError)
        errors.push(
          `Failed to import invoice ${qboInvoice.DocNumber || qboInvoice.Id}: ${
            invoiceError instanceof Error ? invoiceError.message : "Unknown error"
          }`
        )
      }
    }

    // Log activity
    await logActivity(
      userId,
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

// Helper functions (duplicated from qbo-sync.ts for standalone use)
type SyncEntity = "customers" | "items" | "vendors" | "invoices"

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