"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { LotStatus } from "@prisma/client"
import { revalidatePath } from "next/cache"

/**
 * Check if current user is receiver or admin
 */
async function requireReceiverOrAdmin() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "RECEIVER" && session.user.role !== "ADMIN")) {
    throw new Error("Unauthorized: Receiver or Admin access required")
  }
  return session
}

/**
 * Create a new inventory lot
 */
export async function createInventoryLot(data: {
  productId: string
  lotNumber: string
  quantityReceived: number
  expiryDate: Date
  originCountry: string
  growerId?: string | null
}) {
  const session = await requireReceiverOrAdmin()

  // Validate lot number format (alphanumeric + hyphens only)
  const lotNumberRegex = /^[a-zA-Z0-9-]+$/
  if (!lotNumberRegex.test(data.lotNumber)) {
    throw new Error("Lot number can only contain letters, numbers, and hyphens")
  }

  // Check if lot number already exists
  const existingLot = await prisma.inventoryLot.findUnique({
    where: { lot_number: data.lotNumber },
  })

  if (existingLot) {
    throw new Error("Lot number already exists. Please use a unique lot number.")
  }

  // Get product to ensure it has a GTIN
  const product = await prisma.product.findUnique({
    where: { id: data.productId },
  })

  if (!product) {
    throw new Error("Product not found")
  }

  if (!product.gtin) {
    throw new Error("Cannot receive this product: Missing GTIN in Master Data.")
  }

  // Create the inventory lot
  const lot = await prisma.inventoryLot.create({
    data: {
      lot_number: data.lotNumber,
      product_id: data.productId,
      quantity_received: data.quantityReceived,
      quantity_current: data.quantityReceived,
      received_date: new Date(),
      expiry_date: data.expiryDate,
      origin_country: data.originCountry,
      grower_id: data.growerId || null,
      status: LotStatus.RECEIVED,
    },
    include: {
      product: {
        select: {
          id: true,
          sku: true,
          name: true,
          variety: true,
          gtin: true,
        },
      },
    },
  })

  revalidatePath("/dashboard/inventory")
  revalidatePath("/dashboard/inbound")
  return { success: true, lot }
}

