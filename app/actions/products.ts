"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

/**
 * Check if current user is admin
 */
async function requireAdmin() {
  const session = await auth()
  if (!session?.user || session.user.role !== "ADMIN") {
    throw new Error("Unauthorized: Admin access required")
  }
  return session
}

/**
 * Get all products
 */
export async function getProducts(search?: string) {
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { sku: { contains: search, mode: "insensitive" as const } },
          { variety: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : undefined

  const products = await prisma.product.findMany({
    where,
    include: {
      _count: {
        select: { lots: true },
      },
    },
    orderBy: {
      name: "asc",
    },
  })

  return products
}

/**
 * Get a single product by ID
 */
export async function getProductById(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      lots: {
        where: {
          status: {
            in: ["RECEIVED", "QC_PENDING", "AVAILABLE"],
          },
        },
      },
    },
  })

  return product
}

/**
 * Get all active products (for dropdowns/selects)
 */
export async function getActiveProducts() {
  const products = await prisma.product.findMany({
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      sku: true,
      name: true,
      variety: true,
      gtin: true,
    },
  })

  return products
}

/**
 * Create a new product (Admin only)
 */
export async function createProduct(data: {
  sku: string
  name: string
  variety?: string | null
  description?: string | null
  gtin?: string | null
  target_temp_f?: number | null
  image_url?: string | null
}) {
  await requireAdmin()

  // Validate input
  if (!data.sku || !data.name) {
    throw new Error("SKU and name are required")
  }

  // Check if SKU already exists
  const existingProduct = await prisma.product.findUnique({
    where: { sku: data.sku },
  })

  if (existingProduct) {
    throw new Error("Product with this SKU already exists")
  }

  // Create product
  const product = await prisma.product.create({
    data: {
      sku: data.sku,
      name: data.name,
      variety: data.variety || null,
      description: data.description || null,
      gtin: data.gtin || null,
      target_temp_f: data.target_temp_f || null,
      image_url: data.image_url || null,
    },
  })

  revalidatePath("/dashboard/products")
  return { success: true, product }
}

/**
 * Update a product (Admin only)
 */
export async function updateProduct(
  id: string,
  data: {
    sku?: string
    name?: string
    variety?: string | null
    description?: string | null
    gtin?: string | null
    target_temp_f?: number | null
    image_url?: string | null
  }
) {
  await requireAdmin()

  // If SKU is being updated, check for uniqueness
  if (data.sku) {
    const existingProduct = await prisma.product.findUnique({
      where: { sku: data.sku },
    })

    if (existingProduct && existingProduct.id !== id) {
      throw new Error("Product with this SKU already exists")
    }
  }

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(data.sku && { sku: data.sku }),
      ...(data.name && { name: data.name }),
      variety: data.variety !== undefined ? data.variety : undefined,
      description: data.description !== undefined ? data.description : undefined,
      gtin: data.gtin !== undefined ? data.gtin : undefined,
      target_temp_f: data.target_temp_f !== undefined ? data.target_temp_f : undefined,
      image_url: data.image_url !== undefined ? data.image_url : undefined,
    },
  })

  revalidatePath("/dashboard/products")
  return { success: true, product }
}

/**
 * Delete a product (Admin only)
 */
export async function deleteProduct(id: string) {
  await requireAdmin()

  // Check if product has associated lots
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      _count: {
        select: { lots: true },
      },
    },
  })

  if (!product) {
    throw new Error("Product not found")
  }

  if (product._count.lots > 0) {
    throw new Error(
      "Cannot delete product with associated inventory lots. Please remove all lots first."
    )
  }

  await prisma.product.delete({
    where: { id },
  })

  revalidatePath("/dashboard/products")
  return { success: true }
}

