"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

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
 * Get all customers
 */
export async function getAllCustomers() {
  await requireAdmin()
  
  const customers = await prisma.customer.findMany({
    orderBy: { name: "asc" },
  })
  
  return customers
}

/**
 * Create a new customer
 */
export async function createCustomer(data: {
  name: string
  code: string
  address?: string
  contact_email?: string
  active?: boolean
}) {
  await requireAdmin()

  try {
    // Check if code already exists
    const existing = await prisma.customer.findUnique({
      where: { code: data.code },
    })

    if (existing) {
      return { success: false, error: "Customer code already exists" }
    }

    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        code: data.code.toUpperCase(),
        address: data.address || null,
        contact_email: data.contact_email || null,
        active: data.active ?? true,
      },
    })

    revalidatePath("/dashboard/admin/customers")
    return { success: true, customer }
  } catch (error) {
    console.error("Error creating customer:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create customer",
    }
  }
}

/**
 * Update a customer
 */
export async function updateCustomer(
  id: string,
  data: {
    name?: string
    code?: string
    address?: string | null
    contact_email?: string | null
    active?: boolean
  }
) {
  await requireAdmin()

  try {
    // If code is being updated, check for uniqueness
    if (data.code) {
      const existing = await prisma.customer.findUnique({
        where: { code: data.code },
      })

      if (existing && existing.id !== id) {
        return { success: false, error: "Customer code already exists" }
      }
    }

    const customer = await prisma.customer.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.code && { code: data.code.toUpperCase() }),
        ...(data.address !== undefined && { address: data.address }),
        ...(data.contact_email !== undefined && { contact_email: data.contact_email }),
        ...(data.active !== undefined && { active: data.active }),
      },
    })

    revalidatePath("/dashboard/admin/customers")
    return { success: true, customer }
  } catch (error) {
    console.error("Error updating customer:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update customer",
    }
  }
}

/**
 * Delete a customer
 */
export async function deleteCustomer(id: string) {
  await requireAdmin()

  try {
    await prisma.customer.delete({
      where: { id },
    })

    revalidatePath("/dashboard/admin/customers")
    return { success: true }
  } catch (error) {
    console.error("Error deleting customer:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete customer",
    }
  }
}


