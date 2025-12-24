/**
 * Centralized Authentication and Authorization Helpers
 * 
 * These functions provide consistent role checking across the application
 * and handle TypeScript type issues with role comparisons.
 */

import { auth } from "@/lib/auth"

type Role = "ADMIN" | "MANAGER" | "SRJLABS" | "RECEIVER" | "PACKER"

/**
 * Get the current session and user
 */
export async function getSession() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  return session
}

/**
 * Check if user has ADMIN or SRJLABS role
 */
export async function requireAdmin() {
  const session = await getSession()
  const role = session.user.role as string
  if (!["ADMIN", "SRJLABS"].includes(role)) {
    throw new Error("Admin access required")
  }
  return session
}

/**
 * Check if user has ADMIN, MANAGER, or SRJLABS role
 */
export async function requireAdminOrManager() {
  const session = await getSession()
  const role = session.user.role as string
  if (!["ADMIN", "MANAGER", "SRJLABS"].includes(role)) {
    throw new Error("Admin or Manager access required")
  }
  return session
}

/**
 * Check if user has SRJLABS role (super admin)
 */
export async function requireSrjLabs() {
  const session = await getSession()
  const role = session.user.role as string
  if (!["SRJLABS"].includes(role)) {
    throw new Error("SRJLABS access required")
  }
  return session
}

/**
 * Check if user has any of the specified roles
 */
export async function requireAnyRole(...allowedRoles: Role[]) {
  const session = await getSession()
  const role = session.user.role as string
  if (!allowedRoles.includes(role as Role)) {
    throw new Error(`Access denied. Required roles: ${allowedRoles.join(", ")}`)
  }
  return session
}

/**
 * Check if user has a specific role (for conditional logic)
 */
export function hasRole(userRole: string | undefined, ...allowedRoles: Role[]): boolean {
  if (!userRole) return false
  return allowedRoles.includes(userRole as Role)
}

/**
 * Check if user is admin (ADMIN or SRJLABS)
 */
export function isAdmin(userRole: string | undefined): boolean {
  return hasRole(userRole, "ADMIN", "SRJLABS")
}

/**
 * Check if user is admin or manager
 */
export function isAdminOrManager(userRole: string | undefined): boolean {
  return hasRole(userRole, "ADMIN", "MANAGER", "SRJLABS")
}

/**
 * Check if user is SRJLABS
 */
export function isSrjLabs(userRole: string | undefined): boolean {
  return hasRole(userRole, "SRJLABS")
}

