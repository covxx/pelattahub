"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

/**
 * Get all inventory lots grouped by product
 */
export async function getInventoryLots() {
  const lots = await prisma.inventoryLot.findMany({
    where: {
      status: {
        in: ["RECEIVED", "QC_PENDING", "AVAILABLE"],
      },
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
    orderBy: [
      { product: { name: "asc" } },
      { expiry_date: "asc" }, // FIFO: oldest first
    ],
  })

  return lots
}

/**
 * Adjust quantity for a lot
 */
export async function adjustLotQuantity(
  lotId: string,
  newQuantity: number,
  reason?: string
) {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  if (newQuantity < 0) {
    throw new Error("Quantity cannot be negative")
  }

  const lot = await prisma.inventoryLot.update({
    where: { id: lotId },
    data: {
      quantity_current: newQuantity,
      status: newQuantity === 0 ? "EXPIRED" : undefined,
    },
  })

  // TODO: Create audit log entry
  // await createAuditLog({
  //   lotId,
  //   userId: session.user.id,
  //   action: "ADJUST_QUANTITY",
  //   oldValue: lot.quantity_current,
  //   newValue: newQuantity,
  //   reason,
  // })

  revalidatePath("/dashboard/inventory")
  return { success: true, lot }
}

/**
 * Get lot history/audit log (placeholder for future implementation)
 */
export async function getLotHistory(lotId: string) {
  // TODO: Implement audit log system
  return []
}

/**
 * Create a new inventory lot
 */
export async function createLot(data: {
  productId: string
  quantityReceived: number
  receivedDate: Date
  originCountry: string
  growerId?: string
}) {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Check if user has RECEIVER or ADMIN role
  if (session.user.role !== "RECEIVER" && session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Only RECEIVER or ADMIN can create lots")
  }

  // Get product to verify it exists and has GTIN
  const product = await prisma.product.findUnique({
    where: { id: data.productId },
    select: {
      id: true,
      sku: true,
      name: true,
      variety: true,
      gtin: true,
    },
  })

  if (!product) {
    throw new Error("Product not found")
  }

  if (!product.gtin) {
    throw new Error("Cannot receive this product: Missing GTIN in Master Data")
  }

  // Generate lot number: SKU-YYYYMMDD-HHMMSS
  const now = new Date()
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "")
  const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, "")
  const lotNumber = `${product.sku}-${dateStr}-${timeStr}`
    .replace(/[^A-Za-z0-9-]/g, "") // Remove special characters that break ZPL
    .toUpperCase()

  // Calculate expiry date (10 days from received date)
  const expiryDate = new Date(data.receivedDate)
  expiryDate.setDate(expiryDate.getDate() + 10)

  // Create the lot
  const lot = await prisma.inventoryLot.create({
    data: {
      lot_number: lotNumber,
      product_id: data.productId,
      quantity_received: data.quantityReceived,
      quantity_current: data.quantityReceived,
      received_date: data.receivedDate,
      expiry_date: expiryDate,
      origin_country: data.originCountry,
      grower_id: data.growerId,
      status: "RECEIVED",
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
  revalidatePath("/dashboard/receiving")

  return { success: true, lot }
}

/**
 * Get a single lot by ID with product details
 */
export async function getLotById(lotId: string) {
  const lot = await prisma.inventoryLot.findUnique({
    where: { id: lotId },
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

  return lot
}

