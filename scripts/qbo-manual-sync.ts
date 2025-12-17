#!/usr/bin/env tsx

/**
 * QuickBooks Online Manual Sync Script
 *
 * Runs a one-time full sync of customers, products, vendors, and invoices.
 * Useful for testing and manual synchronization.
 */

import { prisma } from '@/lib/prisma'
import {
  importQboCustomers,
  importQboItems,
  importQboVendors,
  importQboInvoices,
  getQboStatus
} from '@/app/actions/qbo-sync'

async function main() {
  console.log('🚀 Starting QBO Manual Sync')

  try {
    // Check QBO connection status
    const status = await getQboStatus()
    if (!status.success || !status.connected) {
      console.error('❌ QBO not connected. Please connect first.')
      process.exit(1)
    }

    console.log('✅ QBO connected, starting sync...')

    const results = {
      customers: null as any,
      products: null as any,
      vendors: null as any,
      invoices: null as any,
      success: true,
      errors: [] as string[]
    }

    // Sync customers
    try {
      console.log('👥 Syncing customers...')
      const customerResult = await importQboCustomers()
      results.customers = customerResult
      if (customerResult.success) {
        console.log(`✅ Synced ${customerResult.imported || 0} new, ${customerResult.updated || 0} updated customers`)
      } else {
        console.error(`❌ Customer sync failed: ${customerResult.error}`)
        results.errors.push(`Customers: ${customerResult.error}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`💥 Customer sync error: ${errorMsg}`)
      results.errors.push(`Customers: ${errorMsg}`)
    }

    // Sync products
    try {
      console.log('📦 Syncing products...')
      const productResult = await importQboItems()
      results.products = productResult
      if (productResult.success) {
        console.log(`✅ Synced ${productResult.imported || 0} new, ${productResult.updated || 0} updated products`)
      } else {
        console.error(`❌ Product sync failed: ${productResult.error}`)
        results.errors.push(`Products: ${productResult.error}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`💥 Product sync error: ${errorMsg}`)
      results.errors.push(`Products: ${errorMsg}`)
    }

    // Sync vendors
    try {
      console.log('🏢 Syncing vendors...')
      const vendorResult = await importQboVendors()
      results.vendors = vendorResult
      if (vendorResult.success) {
        console.log(`✅ Synced ${vendorResult.imported || 0} new, ${vendorResult.updated || 0} updated vendors`)
      } else {
        console.error(`❌ Vendor sync failed: ${vendorResult.error}`)
        results.errors.push(`Vendors: ${vendorResult.error}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`💥 Vendor sync error: ${errorMsg}`)
      results.errors.push(`Vendors: ${errorMsg}`)
    }

    // Sync invoices
    try {
      console.log('📄 Syncing invoices (sales orders)...')
      const invoiceResult = await importQboInvoices()
      results.invoices = invoiceResult
      if (invoiceResult.success) {
        console.log(`✅ Synced ${invoiceResult.imported || 0} orders from invoices`)
      } else {
        console.error(`❌ Invoice sync failed: ${invoiceResult.error}`)
        results.errors.push(`Invoices: ${invoiceResult.error}`)
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error(`💥 Invoice sync error: ${errorMsg}`)
      results.errors.push(`Invoices: ${errorMsg}`)
    }

    results.success = results.errors.length === 0

    if (results.success) {
      console.log('🎉 Manual sync completed successfully!')
    } else {
      console.error(`⚠️  Manual sync completed with ${results.errors.length} errors`)
      console.error('Errors:', results.errors)
      process.exit(1)
    }

  } catch (error) {
    console.error('💥 Manual sync failed:', error)
    process.exit(1)
  }
}

// Run the manual sync
main().catch((error) => {
  console.error('💥 Failed to run manual sync:', error)
  process.exit(1)
})