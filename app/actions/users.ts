"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Role } from "@prisma/client"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"

/**
 * Check if current user is admin
 */
async function requireAdmin() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "ADMIN" && session.user.role !== "SRJLABS")) {
    throw new Error("Unauthorized: Admin access required")
  }
  return session
}

/**
 * Get all users (Admin only)
 */
export async function getUsers() {
  await requireAdmin()

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      sessions: {
        select: {
          expires: true,
        },
        orderBy: {
          expires: "desc",
        },
        take: 1,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  })

  // Format users with last active date
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    lastActive: user.sessions[0]?.expires || user.updatedAt,
    createdAt: user.createdAt,
  }))
}

/**
 * Create a new user (Admin only)
 */
export async function createUser(data: {
  name: string
  email: string
  password: string
  role: Role
}) {
  await requireAdmin()

  // Validate input
  if (!data.email || !data.password) {
    throw new Error("Email and password are required")
  }

  // Check if user already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  })

  if (existingUser) {
    throw new Error("User with this email already exists")
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(data.password, 10)

  // Create user
  const user = await prisma.user.create({
    data: {
      name: data.name || null,
      email: data.email,
      password: hashedPassword,
      role: data.role,
    },
  })

  revalidatePath("/dashboard/users")
  return { success: true, user }
}

/**
 * Update user role (Admin only)
 */
export async function updateUserRole(userId: string, role: Role) {
  await requireAdmin()

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
  })

  revalidatePath("/dashboard/users")
  return { success: true, user }
}

/**
 * Delete a user (Admin only)
 */
export async function deleteUser(userId: string) {
  await requireAdmin()

  // Prevent deleting yourself
  const session = await auth()
  if (session?.user?.id === userId) {
    throw new Error("Cannot delete your own account")
  }

  await prisma.user.delete({
    where: { id: userId },
  })

  revalidatePath("/dashboard/users")
  return { success: true }
}

