"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import bcrypt from "bcryptjs"

async function requireAdminOrManager() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
    throw new Error("Admin or Manager access required")
  }
  return session
}

/**
 * Get all users
 */
export async function getAllUsers() {
  await requireAdminOrManager()
  
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { name: "asc" },
  })
  
  return users
}

/**
 * Create a new user
 */
export async function createUser(data: {
  name: string
  email: string
  password: string
  role: "ADMIN" | "RECEIVER" | "PACKER" | "MANAGER"
}) {
  await requireAdminOrManager()

  try {
    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existing) {
      return { success: false, error: "Email already exists" }
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10)

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: hashedPassword,
        role: data.role,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    revalidatePath("/dashboard/admin/users")
    return { success: true, user }
  } catch (error) {
    console.error("Error creating user:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create user",
    }
  }
}

/**
 * Update a user
 */
export async function updateUser(
  id: string,
  data: {
    name?: string
    email?: string
    role?: "ADMIN" | "RECEIVER" | "PACKER" | "MANAGER"
  }
) {
  await requireAdminOrManager()

  try {
    // If email is being updated, check for uniqueness
    if (data.email) {
      const existing = await prisma.user.findUnique({
        where: { email: data.email },
      })

      if (existing && existing.id !== id) {
        return { success: false, error: "Email already exists" }
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.role && { role: data.role }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    revalidatePath("/dashboard/admin/users")
    return { success: true, user }
  } catch (error) {
    console.error("Error updating user:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update user",
    }
  }
}

/**
 * Reset user password
 */
export async function resetUserPassword(id: string, newPassword: string) {
  await requireAdminOrManager()

  try {
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword },
    })

    revalidatePath("/dashboard/admin/users")
    return { success: true }
  } catch (error) {
    console.error("Error resetting password:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to reset password",
    }
  }
}

/**
 * Delete a user
 */
export async function deleteUser(id: string) {
  await requireAdminOrManager()

  try {
    // Prevent deleting yourself
    const session = await auth()
    if (session?.user?.id === id) {
      return {
        success: false,
        error: "Cannot delete your own account",
      }
    }

    await prisma.user.delete({
      where: { id },
    })

    revalidatePath("/dashboard/admin/users")
    return { success: true }
  } catch (error) {
    console.error("Error deleting user:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete user",
    }
  }
}


