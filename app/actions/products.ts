"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"

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
  })

  return products
}

/**
 * Create a new product (Admin only)
 */
export async function createProduct(data: {
  sku: string
  name: string
  gtin: string
  default_origin_country: string
  variety?: string | null
  description?: string | null
  unit_type?: "CASE" | "LBS" | "EACH"
  standard_case_weight?: number | null
  target_temp_f?: number | null
  image_url?: string | null
}) {
  await requireAdmin()

  // Validate input
  if (!data.sku || !data.name) {
    throw new Error("SKU and name are required")
  }

  if (!data.gtin) {
    throw new Error("GTIN is required")
  }

  if (!data.default_origin_country) {
    throw new Error("Default origin country is required")
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
      gtin: data.gtin,
      default_origin_country: data.default_origin_country,
      unit_type: data.unit_type || "CASE",
      standard_case_weight: data.standard_case_weight || null,
      variety: data.variety || null,
      description: data.description || null,
      target_temp_f: data.target_temp_f || null,
      image_url: data.image_url || null,
    },
  })

  // Log product creation
  const session = await auth()
  if (session?.user?.id) {
    await logActivity(
      session.user.id,
      AuditAction.CREATE,
      EntityType.PRODUCT,
      product.id,
      {
        name: product.name,
        sku: product.sku,
        gtin: product.gtin,
        unit_type: product.unit_type,
        summary: `Created product: ${product.name} (${product.sku})`,
      }
    )
  }

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
    gtin?: string
    default_origin_country?: string
    unit_type?: "CASE" | "LBS" | "EACH"
    standard_case_weight?: number | null
    variety?: string | null
    description?: string | null
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

  // Get old product data for audit trail
  const oldProduct = await prisma.product.findUnique({
    where: { id },
  })

  const product = await prisma.product.update({
    where: { id },
    data: {
      ...(data.sku && { sku: data.sku }),
      ...(data.name && { name: data.name }),
      ...(data.gtin && { gtin: data.gtin }),
      ...(data.default_origin_country && { default_origin_country: data.default_origin_country }),
      ...(data.unit_type && { unit_type: data.unit_type }),
      standard_case_weight: data.standard_case_weight !== undefined ? data.standard_case_weight : undefined,
      variety: data.variety !== undefined ? data.variety : undefined,
      description: data.description !== undefined ? data.description : undefined,
      target_temp_f: data.target_temp_f !== undefined ? data.target_temp_f : undefined,
      image_url: data.image_url !== undefined ? data.image_url : undefined,
    },
  })

  // Log the update with changes
  const session = await auth()
  if (session?.user?.id && oldProduct) {
    const changes: Record<string, any> = {}
    if (data.standard_case_weight !== undefined && data.standard_case_weight !== oldProduct.standard_case_weight) {
      changes.standard_case_weight = {
        old: oldProduct.standard_case_weight,
        new: data.standard_case_weight,
      }
    }
    if (data.unit_type && data.unit_type !== oldProduct.unit_type) {
      changes.unit_type = {
        old: oldProduct.unit_type,
        new: data.unit_type,
      }
    }

    await logActivity(
      session.user.id,
      AuditAction.UPDATE,
      EntityType.PRODUCT,
      id,
      {
        name: product.name,
        sku: product.sku,
        changes,
        summary: `Updated product: ${product.name}`,
      }
    )
  }

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

