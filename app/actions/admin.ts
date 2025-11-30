"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  if (session.user.role !== "ADMIN") {
    throw new Error("Admin access required")
  }
  return session
}

/**
 * Get admin dashboard statistics
 */
export async function getAdminStats() {
  await requireAdmin()

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

