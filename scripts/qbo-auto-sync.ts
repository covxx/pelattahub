#!/usr/bin/env tsx

/**
 * QuickBooks Online Automated Sync Script
 *
 * Runs automatic syncs every minute for customers, products, vendors, and invoices.
 * Designed to run as a long-running process in production.
 */

import * as cron from 'node-cron'
import { prisma } from '@/lib/prisma'
import { logActivity, AuditAction, EntityType } from '@/lib/logger'
import {
  importQboCustomers,
  importQboItems,
  importQboVendors,
  importQboInvoices,
  getQboStatus
} from '@/lib/qbo-sync-standalone'
import { resolveSystemUserId } from '@/lib/qbo-sync-standalone'

// Configuration from environment variables
const SYNC_ENABLED = process.env.QBO_AUTO_SYNC_ENABLED === 'true'
const SYNC_INTERVAL_MINUTES = parseInt(process.env.QBO_SYNC_INTERVAL_MINUTES || '1')
const SYNC_CUSTOMERS = process.env.QBO_SYNC_CUSTOMERS !== 'false' // Default true
const SYNC_PRODUCTS = process.env.QBO_SYNC_PRODUCTS !== 'false'   // Default true
const SYNC_VENDORS = process.env.QBO_SYNC_VENDORS !== 'false'     // Default true
const SYNC_INVOICES = process.env.QBO_SYNC_INVOICES !== 'false'   // Default true

// Validate cron expression based on interval
const getCronExpression = (minutes: number): string => {
  if (minutes === 1) return '* * * * *'  // Every minute
  if (minutes === 5) return '*/5 * * * *'  // Every 5 minutes
  if (minutes === 10) return '*/10 * * * *'  // Every 10 minutes
  if (minutes === 15) return '*/15 * * * *'  // Every 15 minutes
  if (minutes === 30) return '*/30 * * * *'  // Every 30 minutes
  if (minutes === 60) return '0 * * * *'  // Every hour

  // Default to every minute if invalid interval
  console.warn(`Invalid sync interval ${minutes}, defaulting to 1 minute`)
  return '* * * * *'
}

async function runAutoSync() {
  const startTime = new Date()

  try {
    // Check if auto-sync is enabled in settings
    const settings = await prisma.integrationSettings.findUnique({
      where: { provider: "qbo" },
    })

    const autoSyncEnabled = (settings as any)?.metadata?.autoSyncEnabled !== false
    if (!autoSyncEnabled) {
      console.log('QBO auto-sync disabled in settings, skipping sync')
      return
    }

    // Check QBO connection status
    const status = await getQboStatus()
    if (!status.success || !status.connected) {
      console.warn('QBO not connected, skipping auto-sync')
      return
    }

    console.log('Starting QBO auto-sync cycle')

    const results = {
      customers: null as any,
      products: null as any,
      vendors: null as any,
      invoices: null as any,
      success: true,
      errors: [] as string[]
    }

    // Sync customers first (needed for invoices)
    if (SYNC_CUSTOMERS) {
      try {
        console.log('Syncing QBO customers...')
        const customerResult = await importQboCustomers()
        results.customers = customerResult
        if (customerResult.success) {
          console.log(`Synced ${customerResult.imported || 0} new, ${customerResult.updated || 0} updated customers`)
        } else {
          console.error(`Customer sync failed: ${customerResult.error}`)
          results.errors.push(`Customers: ${customerResult.error}`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Customer sync error: ${errorMsg}`)
        results.errors.push(`Customers: ${errorMsg}`)
      }
    }

    // Sync products (needed for invoices)
    if (SYNC_PRODUCTS) {
      try {
        console.log('Syncing QBO products...')
        const productResult = await importQboItems()
        results.products = productResult
        if (productResult.success) {
          console.log(`Synced ${productResult.imported || 0} new, ${productResult.updated || 0} updated products`)
        } else {
          console.error(`Product sync failed: ${productResult.error}`)
          results.errors.push(`Products: ${productResult.error}`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Product sync error: ${errorMsg}`)
        results.errors.push(`Products: ${errorMsg}`)
      }
    }

    // Sync vendors
    if (SYNC_VENDORS) {
      try {
        console.log('Syncing QBO vendors...')
        const vendorResult = await importQboVendors()
        results.vendors = vendorResult
        if (vendorResult.success) {
          console.log(`Synced ${vendorResult.imported || 0} new, ${vendorResult.updated || 0} updated vendors`)
        } else {
          console.error(`Vendor sync failed: ${vendorResult.error}`)
          results.errors.push(`Vendors: ${vendorResult.error}`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Vendor sync error: ${errorMsg}`)
        results.errors.push(`Vendors: ${errorMsg}`)
      }
    }

    // Sync invoices (sales orders)
    if (SYNC_INVOICES) {
      try {
        console.log('Syncing QBO invoices (sales orders)...')
        const invoiceResult = await importQboInvoices()
        results.invoices = invoiceResult
        if (invoiceResult.success) {
          console.log(`Synced ${invoiceResult.imported || 0} orders from invoices`)
        } else {
          console.error(`Invoice sync failed: ${invoiceResult.error}`)
          results.errors.push(`Invoices: ${invoiceResult.error}`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Invoice sync error: ${errorMsg}`)
        results.errors.push(`Invoices: ${errorMsg}`)
      }
    }

    const duration = Date.now() - startTime.getTime()
    results.success = results.errors.length === 0

    // Log completion with audit trail
    const systemUserId = await resolveSystemUserId()
    await logActivity(
      systemUserId,
      AuditAction.SYNC,
      EntityType.SYSTEM,
      'QBO_AUTO_SYNC',
      {
        summary: `Auto-sync completed in ${duration}ms`,
        duration,
        results,
        timestamp: startTime.toISOString(),
      }
    )

    if (results.success) {
      console.log(`QBO auto-sync completed successfully in ${duration}ms`)
    } else {
      console.warn(`QBO auto-sync completed with ${results.errors.length} errors in ${duration}ms`)
    }

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    const duration = Date.now() - startTime.getTime()

    console.error(`QBO auto-sync failed after ${duration}ms: ${errorMsg}`)

    // Log error to audit trail
    try {
      const systemUserId = await resolveSystemUserId()
      await logActivity(
        systemUserId,
        AuditAction.ERROR,
        EntityType.SYSTEM,
        'QBO_AUTO_SYNC_ERROR',
        {
          error: errorMsg,
          duration,
          timestamp: startTime.toISOString(),
        }
      )
    } catch (logError) {
      console.error('Failed to log sync error:', logError)
    }
  }
}

async function main() {
  if (!SYNC_ENABLED) {
    console.log('❌ QBO auto-sync is disabled via QBO_AUTO_SYNC_ENABLED environment variable')
    process.exit(0)
  }

  console.log('🚀 Starting QBO Auto-Sync Service')
  console.log(`📅 Sync interval: Every ${SYNC_INTERVAL_MINUTES} minute(s)`)
  console.log(`👥 Sync customers: ${SYNC_CUSTOMERS}`)
  console.log(`📦 Sync products: ${SYNC_PRODUCTS}`)
  console.log(`🏢 Sync vendors: ${SYNC_VENDORS}`)
  console.log(`📄 Sync invoices: ${SYNC_INVOICES}`)

  const cronExpression = getCronExpression(SYNC_INTERVAL_MINUTES)
  console.log(`⏰ Cron expression: ${cronExpression}`)

  // Schedule the sync job
  const scheduledTask = cron.schedule(cronExpression, runAutoSync)

  // Run initial sync on startup
  console.log('🔄 Running initial sync...')
  await runAutoSync()

  // Start the scheduled job
  scheduledTask.start()

  console.log('✅ QBO Auto-Sync Service started successfully')

  // Keep the process running
  process.on('SIGINT', () => {
    console.log('🛑 Shutting down QBO Auto-Sync Service...')
    scheduledTask.stop()
    scheduledTask.destroy()
    process.exit(0)
  })

  process.on('SIGTERM', () => {
    console.log('🛑 Shutting down QBO Auto-Sync Service...')
    scheduledTask.stop()
    scheduledTask.destroy()
    process.exit(0)
  })
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception in QBO Auto-Sync:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection in QBO Auto-Sync:', reason)
  process.exit(1)
})

// Run the service
main().catch((error) => {
  console.error('💥 Failed to start QBO Auto-Sync Service:', error)
  process.exit(1)
})
