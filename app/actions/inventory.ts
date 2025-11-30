"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

interface InventoryCatalogFilters {
  activeOnly?: boolean
  search?: string
}

/**
 * Get inventory catalog with aggregated lot data
 */
export async function getInventoryCatalog(filters: InventoryCatalogFilters = {}) {
  const { activeOnly = true, search = "" } = filters

  const where: any = {}

  // Filter by search term (product name, SKU, or GTIN)
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { sku: { contains: search, mode: "insensitive" } },
      { gtin: { contains: search, mode: "insensitive" } },
    ]
  }

  // Get products with their lots
  const products = await prisma.product.findMany({
    where,
    include: {
      lots: {
        where: activeOnly
          ? {
              status: {
                in: ["RECEIVED", "QC_PENDING", "AVAILABLE"],
              },
            }
          : {},
        select: {
          id: true,
          lot_number: true,
          quantity_received: true,
          quantity_current: true,
          received_date: true,
          expiry_date: true,
          origin_country: true,
          status: true,
        },
        orderBy: {
          received_date: "desc",
        },
      },
    },
    orderBy: {
      name: "asc",
    },
  })

  // Aggregate lot data for each product
  return products.map((product) => {
    const activeLots = product.lots.filter(
      (lot) =>
        lot.status === "RECEIVED" ||
        lot.status === "QC_PENDING" ||
        lot.status === "AVAILABLE"
    )

    const totalOnHand = activeLots.reduce(
      (sum, lot) => sum + lot.quantity_current,
      0
    )

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      variety: product.variety,
      gtin: product.gtin,
      unit_type: product.unit_type,
      standard_case_weight: product.standard_case_weight,
      total_on_hand: totalOnHand,
      active_lot_count: activeLots.length,
      lots: activeLots,
    }
  })
}

/**
 * Get a single product with all its lots
 */
export async function getProductWithLots(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      lots: {
        where: {
          status: {
            in: ["RECEIVED", "QC_PENDING", "AVAILABLE"],
          },
        },
        select: {
          id: true,
          lot_number: true,
          quantity_received: true,
          quantity_current: true,
          received_date: true,
          expiry_date: true,
          origin_country: true,
          status: true,
        },
        orderBy: {
          received_date: "desc",
        },
      },
    },
  })

  if (!product) {
    return null
  }

  const activeLots = product.lots.filter(
    (lot) =>
      lot.status === "RECEIVED" ||
      lot.status === "QC_PENDING" ||
      lot.status === "AVAILABLE"
  )

  const totalOnHand = activeLots.reduce(
    (sum, lot) => sum + lot.quantity_current,
    0
  )

  return {
    id: product.id,
    sku: product.sku,
    name: product.name,
    variety: product.variety,
    gtin: product.gtin,
    unit_type: product.unit_type,
    standard_case_weight: product.standard_case_weight,
    total_on_hand: totalOnHand,
    active_lot_count: activeLots.length,
    lots: activeLots,
  }
}

/**
 * Get lot lifecycle data (non-admin version for inventory users)
 */
export async function getLotLifecycleForUser(lotId: string) {
  const session = await auth()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Get the lot with all related data
  const lot = await prisma.inventoryLot.findUnique({
    where: { id: lotId },
    include: {
      product: true,
      receivingEvent: {
        include: {
          vendor: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  })

  if (!lot) {
    return null
  }

  // Get all audit logs for this lot
  const auditTrail = await prisma.auditLog.findMany({
    where: {
      entity_type: "LOT",
      entity_id: lotId,
    },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  return {
    lot,
    auditTrail,
  }
}
