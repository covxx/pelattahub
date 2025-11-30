"use server"

import { prisma } from "@/lib/prisma"

/**
 * Get all active vendors
 */
export async function getActiveVendors() {
  const vendors = await prisma.vendor.findMany({
    where: {
      active: true,
    },
    orderBy: {
      name: "asc",
    },
  })

  return vendors
}

/**
 * Get all vendors (including inactive)
 */
export async function getAllVendors() {
  const vendors = await prisma.vendor.findMany({
    orderBy: {
      name: "asc",
    },
  })

  return vendors
}

/**
 * Get vendor by ID
 */
export async function getVendorById(id: string) {
  const vendor = await prisma.vendor.findUnique({
    where: { id },
  })

  return vendor
}

