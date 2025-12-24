"use server"

import { prisma } from "@/lib/prisma"
import { requireAdminOrManager } from "@/lib/auth-helpers"

/**
 * Get admin dashboard statistics
 */
export async function getAdminStats() {
  await requireAdminOrManager()

  const [productCount, vendorCount, userCount, customerCount] = await Promise.all([
    prisma.product.count(),
    prisma.vendor.count({ where: { active: true } }),
    prisma.user.count(),
    prisma.customer.count({ where: { active: true } }),
  ])

  return {
    productCount,
    vendorCount,
    userCount,
    customerCount,
  }
}

