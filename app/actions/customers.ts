"use server"

import { prisma } from "@/lib/prisma"

/**
 * Get all active customers (for reports and general use)
 */
export async function getActiveCustomers() {
  const customers = await prisma.customer.findMany({
    where: {
      active: true,
    },
    orderBy: {
      name: "asc",
    },
  })

  return customers
}












