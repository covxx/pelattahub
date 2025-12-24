"use server"

import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { requireAdminOrManager } from "@/lib/auth-helpers"

/**
 * Get all vendors
 */
export async function getAllVendors() {
  await requireAdminOrManager()
  
  const vendors = await prisma.vendor.findMany({
    orderBy: { name: "asc" },
  })
  
  return vendors
}

/**
 * Create a new vendor
 */
export async function createVendor(data: {
  name: string
  code: string
  active?: boolean
}) {
  await requireAdminOrManager()

  try {
    // Check if code already exists
    const existing = await prisma.vendor.findUnique({
      where: { code: data.code },
    })

    if (existing) {
      return { success: false, error: "Vendor code already exists" }
    }

    const vendor = await prisma.vendor.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        active: data.active ?? true,
      },
    })

    revalidatePath("/dashboard/admin/vendors")
    return { success: true, vendor }
  } catch (error) {
    console.error("Error creating vendor:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create vendor",
    }
  }
}

/**
 * Update a vendor
 */
export async function updateVendor(
  id: string,
  data: {
    name?: string
    code?: string
    active?: boolean
  }
) {
  await requireAdminOrManager()

  try {
    // If code is being updated, check for uniqueness
    if (data.code) {
      const existing = await prisma.vendor.findUnique({
        where: { code: data.code },
      })

      if (existing && existing.id !== id) {
        return { success: false, error: "Vendor code already exists" }
      }
    }

    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.active !== undefined && { active: data.active }),
      },
    })

    revalidatePath("/dashboard/admin/vendors")
    return { success: true, vendor }
  } catch (error) {
    console.error("Error updating vendor:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update vendor",
    }
  }
}

/**
 * Delete a vendor
 */
export async function deleteVendor(id: string) {
  await requireAdminOrManager()

  try {
    // Check if vendor has receiving events
    const eventsCount = await prisma.receivingEvent.count({
      where: { vendor_id: id },
    })

    if (eventsCount > 0) {
      return {
        success: false,
        error: "Cannot delete vendor with history. Deactivate instead.",
      }
    }

    await prisma.vendor.delete({
      where: { id },
    })

    revalidatePath("/dashboard/admin/vendors")
    return { success: true }
  } catch (error) {
    console.error("Error deleting vendor:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete vendor",
    }
  }
}


