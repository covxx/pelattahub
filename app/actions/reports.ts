"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { format } from "date-fns"
import { UnitType, LotStatus } from "@prisma/client"

/**
 * Helper function to normalize quantities to LBS
 * @param qty - Quantity value
 * @param unit - Unit type (CASE, LBS, or EACH)
 * @param caseWeight - Weight in LBS of 1 case (from product.standard_case_weight)
 * @returns Quantity normalized to LBS
 */
function normalizeToLbs(qty: number, unit: UnitType, caseWeight?: number | null): number {
  if (unit === "LBS") {
    return qty
  }
  if (unit === "CASE") {
    return qty * (caseWeight || 0)
  }
  // For EACH, we can't convert without additional info, return 0 or the qty as-is
  // For reporting purposes, EACH items typically don't have weight, so return 0
  return 0
}

/**
 * Zod schema for inbound report filters
 */
const inboundReportFiltersSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  vendorId: z.string().uuid().optional(),
  productId: z.string().optional(),
})

/**
 * Zod schema for outbound report filters
 */
const outboundReportFiltersSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  customerId: z.string().uuid().optional(),
  productId: z.string().optional(),
})

/**
 * Zod schema for inventory snapshot filters
 */
const inventorySnapshotFiltersSchema = z.object({
  productId: z.string().optional(),
  status: z.nativeEnum(LotStatus).optional(),
}).optional()

/**
 * Check if current user is authenticated (reports accessible to all authenticated users)
 */
async function requireAuth() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  return session
}

/**
 * Check Data Health
 * 
 * Finds products where unit_type is 'CASE' but standard_case_weight is NULL or 0.
 * This indicates data integrity issues that will cause inaccurate weight reports.
 */
export async function checkDataHealth() {
  await requireAuth()

  const invalidProducts = await prisma.product.findMany({
    where: {
      unit_type: "CASE",
      OR: [
        { standard_case_weight: null },
        { standard_case_weight: 0 },
      ],
    },
    select: {
      id: true,
      name: true,
      sku: true,
      unit_type: true,
      standard_case_weight: true,
    },
    orderBy: {
      name: "asc",
    },
    take: 5, // Top 5 for display
  })

  return {
    count: invalidProducts.length,
    products: invalidProducts.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
    })),
    hasIssues: invalidProducts.length > 0,
  }
}

/**
 * Generate Inbound Report
 * 
 * Fetches InventoryLot records joined with ReceivingEvent and calculates:
 * - totalCases: Sum of quantities where unit = 'CASE'
 * - totalLbs: Sum of quantities where unit = 'LBS' + (Cases * CaseWeight)
 * 
 * Returns data grouped by Vendor and by Product
 */
export async function generateInboundReport(filters: unknown) {
  await requireAuth()

  // Validate input
  const validated = inboundReportFiltersSchema.parse(filters)

  const { startDate, endDate, vendorId, productId } = validated

  // Build where clause
  const where = {
    received_date: {
      gte: startDate,
      lte: endDate,
    },
    ...(vendorId && {
      receivingEvent: {
        vendor_id: vendorId,
      },
    }),
    ...(productId && {
      product_id: productId,
    }),
  }

  // Fetch lots with related data
  const lots = await prisma.inventoryLot.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit_type: true,
          standard_case_weight: true,
        },
      },
      receivingEvent: {
        include: {
          vendor: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
    },
  })

  // Process and group data
  interface VendorGroup {
    vendorId: string
    vendorName: string
    vendorCode: string
    totalCases: number
    totalLbs: number
    products: Array<{
      productId: string
      productName: string
      productSku: string
      totalCases: number
      totalLbs: number
    }>
  }

  interface ProductGroup {
    productId: string
    productName: string
    productSku: string
    unitType: UnitType
    totalCases: number
    totalLbs: number
    vendors: Array<{
      vendorId: string
      vendorName: string
      vendorCode: string
      totalCases: number
      totalLbs: number
    }>
  }

  const vendorMap = new Map<string, VendorGroup>()
  const productMap = new Map<string, ProductGroup>()

  for (const lot of lots) {
    if (!lot.receivingEvent || !lot.product) continue

    const vendor = lot.receivingEvent.vendor
    const product = lot.product
    const quantity = lot.quantity_received || lot.original_quantity || 0

    // Calculate cases and lbs
    const isCase = product.unit_type === "CASE"
    const cases = isCase ? quantity : 0
    const lbs = normalizeToLbs(quantity, product.unit_type, product.standard_case_weight)

    // Group by Vendor
    if (!vendorMap.has(vendor.id)) {
      vendorMap.set(vendor.id, {
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorCode: vendor.code,
        totalCases: 0,
        totalLbs: 0,
        products: [],
      })
    }
    const vendorGroup = vendorMap.get(vendor.id)!
    vendorGroup.totalCases += cases
    vendorGroup.totalLbs += lbs

    // Add to vendor's product list
    let vendorProduct = vendorGroup.products.find((p) => p.productId === product.id)
    if (!vendorProduct) {
      vendorProduct = {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        totalCases: 0,
        totalLbs: 0,
      }
      vendorGroup.products.push(vendorProduct)
    }
    vendorProduct.totalCases += cases
    vendorProduct.totalLbs += lbs

    // Group by Product
    if (!productMap.has(product.id)) {
      productMap.set(product.id, {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        unitType: product.unit_type,
        totalCases: 0,
        totalLbs: 0,
        vendors: [],
      })
    }
    const productGroup = productMap.get(product.id)!
    productGroup.totalCases += cases
    productGroup.totalLbs += lbs

    // Add to product's vendor list
    let productVendor = productGroup.vendors.find((v) => v.vendorId === vendor.id)
    if (!productVendor) {
      productVendor = {
        vendorId: vendor.id,
        vendorName: vendor.name,
        vendorCode: vendor.code,
        totalCases: 0,
        totalLbs: 0,
      }
      productGroup.vendors.push(productVendor)
    }
    productVendor.totalCases += cases
    productVendor.totalLbs += lbs
  }

  // Group by date for charting
  const dateMap = new Map<string, { totalCases: number; totalLbs: number }>()
  for (const lot of lots) {
    if (!lot.receivingEvent || !lot.product) continue

    const dateKey = format(lot.received_date, "yyyy-MM-dd")
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, { totalCases: 0, totalLbs: 0 })
    }
    const dateEntry = dateMap.get(dateKey)!

    const quantity = lot.quantity_received || lot.original_quantity || 0
    const isCase = lot.product.unit_type === "CASE"
    const cases = isCase ? quantity : 0
    const lbs = normalizeToLbs(quantity, lot.product.unit_type, lot.product.standard_case_weight)

    dateEntry.totalCases += cases
    dateEntry.totalLbs += lbs
  }

  const byDate = Array.from(dateMap.entries())
    .map(([date, values]) => ({
      date,
      totalCases: values.totalCases,
      totalLbs: values.totalLbs,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    summary: {
      totalLots: lots.length,
      totalCases: Array.from(vendorMap.values()).reduce((sum, v) => sum + v.totalCases, 0),
      totalLbs: Array.from(vendorMap.values()).reduce((sum, v) => sum + v.totalLbs, 0),
    },
    byVendor: Array.from(vendorMap.values()),
    byProduct: Array.from(productMap.values()),
    byDate,
  }
}

/**
 * Generate Outbound Report
 * 
 * Fetches OrderPick records joined with Order and Product.
 * Calculates totalCases and totalLbs shipped.
 * 
 * Returns data grouped by Customer and by Product
 */
export async function generateOutboundReport(filters: unknown) {
  await requireAuth()

  // Validate input
  const validated = outboundReportFiltersSchema.parse(filters)

  const { startDate, endDate, customerId, productId } = validated

  // Build where clause
  const where = {
    picked_at: {
      gte: startDate,
      lte: endDate,
    },
    ...(customerId && {
      order_item: {
        order: {
          customer_id: customerId,
        },
      },
    }),
    ...(productId && {
      order_item: {
        product_id: productId,
      },
    }),
  }

  // Fetch picks with related data
  const picks = await prisma.orderPick.findMany({
    where,
    include: {
      order_item: {
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit_type: true,
              standard_case_weight: true,
            },
          },
          order: {
            include: {
              customer: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                },
              },
            },
          },
        },
      },
    },
  })

  // Process and group data
  interface CustomerGroup {
    customerId: string
    customerName: string
    customerCode: string
    totalCases: number
    totalLbs: number
    products: Array<{
      productId: string
      productName: string
      productSku: string
      totalCases: number
      totalLbs: number
    }>
  }

  interface ProductGroup {
    productId: string
    productName: string
    productSku: string
    unitType: UnitType
    totalCases: number
    totalLbs: number
    customers: Array<{
      customerId: string
      customerName: string
      customerCode: string
      totalCases: number
      totalLbs: number
    }>
  }

  const customerMap = new Map<string, CustomerGroup>()
  const productMap = new Map<string, ProductGroup>()

  for (const pick of picks) {
    const orderItem = pick.order_item
    if (!orderItem.product || !orderItem.order.customer) continue

    const customer = orderItem.order.customer
    const product = orderItem.product
    const quantity = pick.quantity_picked

    // Calculate cases and lbs
    const isCase = product.unit_type === "CASE"
    const cases = isCase ? quantity : 0
    const lbs = normalizeToLbs(quantity, product.unit_type, product.standard_case_weight)

    // Group by Customer
    if (!customerMap.has(customer.id)) {
      customerMap.set(customer.id, {
        customerId: customer.id,
        customerName: customer.name,
        customerCode: customer.code,
        totalCases: 0,
        totalLbs: 0,
        products: [],
      })
    }
    const customerGroup = customerMap.get(customer.id)!
    customerGroup.totalCases += cases
    customerGroup.totalLbs += lbs

    // Add to customer's product list
    let customerProduct = customerGroup.products.find((p) => p.productId === product.id)
    if (!customerProduct) {
      customerProduct = {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        totalCases: 0,
        totalLbs: 0,
      }
      customerGroup.products.push(customerProduct)
    }
    customerProduct.totalCases += cases
    customerProduct.totalLbs += lbs

    // Group by Product
    if (!productMap.has(product.id)) {
      productMap.set(product.id, {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        unitType: product.unit_type,
        totalCases: 0,
        totalLbs: 0,
        customers: [],
      })
    }
    const productGroup = productMap.get(product.id)!
    productGroup.totalCases += cases
    productGroup.totalLbs += lbs

    // Add to product's customer list
    let productCustomer = productGroup.customers.find((c) => c.customerId === customer.id)
    if (!productCustomer) {
      productCustomer = {
        customerId: customer.id,
        customerName: customer.name,
        customerCode: customer.code,
        totalCases: 0,
        totalLbs: 0,
      }
      productGroup.customers.push(productCustomer)
    }
    productCustomer.totalCases += cases
    productCustomer.totalLbs += lbs
  }

  // Group by date for charting
  const dateMap = new Map<string, { totalCases: number; totalLbs: number }>()
  for (const pick of picks) {
    const orderItem = pick.order_item
    if (!orderItem.product) continue

    const dateKey = format(pick.picked_at, "yyyy-MM-dd")
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, { totalCases: 0, totalLbs: 0 })
    }
    const dateEntry = dateMap.get(dateKey)!

    const quantity = pick.quantity_picked
    const isCase = orderItem.product.unit_type === "CASE"
    const cases = isCase ? quantity : 0
    const lbs = normalizeToLbs(quantity, orderItem.product.unit_type, orderItem.product.standard_case_weight)

    dateEntry.totalCases += cases
    dateEntry.totalLbs += lbs
  }

  const byDate = Array.from(dateMap.entries())
    .map(([date, values]) => ({
      date,
      totalCases: values.totalCases,
      totalLbs: values.totalLbs,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return {
    summary: {
      totalPicks: picks.length,
      totalCases: Array.from(customerMap.values()).reduce((sum, c) => sum + c.totalCases, 0),
      totalLbs: Array.from(customerMap.values()).reduce((sum, c) => sum + c.totalLbs, 0),
    },
    byCustomer: Array.from(customerMap.values()),
    byProduct: Array.from(productMap.values()),
    byDate,
  }
}

/**
 * Get Inventory Snapshot
 * 
 * Fetches all current active lots (quantity > 0).
 * Returns metrics including:
 * - Total Valuation (Lbs)
 * - Expiry Risk (qty expiring < 7 days)
 */
export async function getInventorySnapshot(filters?: unknown) {
  await requireAuth()

  // Validate input (optional)
  const validated = inventorySnapshotFiltersSchema.parse(filters || {})

  // Build where clause
  const where: {
    quantity_current: { gt: number }
    status?: { in: LotStatus[] }
    product_id?: string
  } = {
    quantity_current: {
      gt: 0,
    },
  }

  if (validated?.status) {
    where.status = {
      in: [validated.status],
    }
  }

  if (validated?.productId) {
    where.product_id = validated.productId
  }

  // Fetch active lots with product data
  const lots = await prisma.inventoryLot.findMany({
    where,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit_type: true,
          standard_case_weight: true,
        },
      },
    },
  })

  // Calculate metrics
  const now = new Date()
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

  let totalLbs = 0
  let expiryRiskLbs = 0
  let expiryRiskLots = 0
  const expiringLots: Array<{
    lotId: string
    lotNumber: string
    productName: string
    productSku: string
    quantity: number
    quantityLbs: number
    expiryDate: Date
    daysUntilExpiry: number
  }> = []

  for (const lot of lots) {
    if (!lot.product) continue

    const quantity = lot.quantity_current
    const quantityLbs = normalizeToLbs(quantity, lot.product.unit_type, lot.product.standard_case_weight)

    totalLbs += quantityLbs

    // Check expiry risk
    if (lot.expiry_date <= sevenDaysFromNow) {
      expiryRiskLbs += quantityLbs
      expiryRiskLots += 1

      const daysUntilExpiry = Math.ceil(
        (lot.expiry_date.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      )

      expiringLots.push({
        lotId: lot.id,
        lotNumber: lot.lot_number,
        productName: lot.product.name,
        productSku: lot.product.sku,
        quantity,
        quantityLbs,
        expiryDate: lot.expiry_date,
        daysUntilExpiry,
      })
    }
  }

  // Group by product
  const productMap = new Map<
    string,
    {
      productId: string
      productName: string
      productSku: string
      totalLots: number
      totalQuantity: number
      totalLbs: number
    }
  >()

  for (const lot of lots) {
    if (!lot.product) continue

    const quantity = lot.quantity_current
    const quantityLbs = normalizeToLbs(quantity, lot.product.unit_type, lot.product.standard_case_weight)

    if (!productMap.has(lot.product.id)) {
      productMap.set(lot.product.id, {
        productId: lot.product.id,
        productName: lot.product.name,
        productSku: lot.product.sku,
        totalLots: 0,
        totalQuantity: 0,
        totalLbs: 0,
      })
    }

    const productGroup = productMap.get(lot.product.id)!
    productGroup.totalLots += 1
    productGroup.totalQuantity += quantity
    productGroup.totalLbs += quantityLbs
  }

  return {
    summary: {
      totalLots: lots.length,
      totalLbs,
      expiryRiskLots,
      expiryRiskLbs,
    },
    byProduct: Array.from(productMap.values()),
    expiringLots: expiringLots.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry),
  }
}

