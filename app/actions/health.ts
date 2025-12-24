"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity } from "@/lib/logger"
import { revalidatePath } from "next/cache"
import { unstable_noStore as noStore } from "next/cache"

async function requireAdminOrManager() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER" && session.user.role !== "SRJLABS") {
    throw new Error("Admin or Manager access required")
  }
  return session
}

export interface SystemHealth {
  status: "OK" | "DEGRADED"
  latency: number // milliseconds
  memoryMB: number // Resident Set Size in MB
  uptime: string // Formatted as "HH:MM"
  errorCount: number
  pendingReceives: number
  recentLogs: Array<{
    id: string
    action: string
    entity_type: string
    createdAt: Date
    user: {
      name: string | null
      email: string
    }
  }>
}

/**
 * Format seconds to HH:MM string
 */
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

/**
 * Get system health metrics
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  await requireAdminOrManager()
  
  // Prevent caching - health data must be real-time
  noStore()

  // Capture start time before database check so we can calculate latency even on failure
  const start = performance.now()

  try {
    // Database latency check
    await prisma.$queryRaw`SELECT 1`
    const end = performance.now()
    const latency = end - start

    // Memory usage (RSS in MB)
    const memoryUsage = process.memoryUsage()
    const memoryMB = Math.round(memoryUsage.rss / (1024 * 1024))

    // Uptime formatted as HH:MM
    const uptimeSeconds = process.uptime()
    const uptime = formatUptime(uptimeSeconds)

    // Error count (today - from start of day)
    // Query for entries where action contains "ERROR" OR details contains "failure"
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    
    // Use raw SQL to search JSON field for "failure" text
    // For JSONB fields, cast to text and search (handle NULL with COALESCE)
    const errorCountResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint as count
      FROM audit_logs
      WHERE "createdAt" >= ${todayStart}
        AND (
          LOWER(action) LIKE '%error%'
          OR LOWER(COALESCE(details::text, '')) LIKE '%failure%'
        )
    `
    const errorCount = Number(errorCountResult[0]?.count || 0)

    // Pending jobs: Count ReceivingEvents where status is 'OPEN'
    const pendingReceives = await prisma.receivingEvent.count({
      where: {
        status: "OPEN",
      },
    })

    // Recent system logs (last 5)
    const recentLogs = await prisma.auditLog.findMany({
      take: 5,
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        action: true,
        entity_type: true,
        createdAt: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    })

    // Determine status: DEGRADED if latency > 500ms or errors > 0
    const status: "OK" | "DEGRADED" = latency > 500 || errorCount > 0 ? "DEGRADED" : "OK"

    return {
      status,
      latency: Math.round(latency * 100) / 100, // Round to 2 decimal places
      memoryMB,
      uptime,
      errorCount,
      pendingReceives,
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entity_type: log.entity_type,
        createdAt: log.createdAt,
        user: {
          name: log.user.name,
          email: log.user.email,
        },
      })),
    }
  } catch (error) {
    // If database check fails, calculate latency from start time to failure
    const end = performance.now()
    const latency = end - start

    const memoryUsage = process.memoryUsage()
    const memoryMB = Math.round(memoryUsage.rss / (1024 * 1024))
    const uptime = formatUptime(process.uptime())

    return {
      status: "DEGRADED",
      latency: Math.round(latency * 100) / 100, // Round to 2 decimal places (same as success path)
      memoryMB,
      uptime,
      errorCount: 0,
      pendingReceives: 0,
      recentLogs: [],
    }
  }
}

/**
 * Purge Next.js cache
 */
export async function purgeCache() {
  await requireAdminOrManager()
  
  try {
    revalidatePath("/", "layout")
    return { success: true, message: "Cache purged successfully" }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to purge cache",
    }
  }
}

/**
 * Force disconnect Prisma Client
 * Use with caution - this will close all database connections
 */
export async function disconnectPrisma() {
  await requireAdminOrManager()
  
  try {
    await prisma.$disconnect()
    return { success: true, message: "Prisma disconnected successfully" }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to disconnect Prisma",
    }
  }
}

/**
 * Run garbage collection (mostly placebo, but logs maintenance activity)
 */
export async function runGarbageCollection() {
  const session = await requireAdminOrManager()
  
  try {
    // Log the maintenance activity
    await logActivity(
      session.user.id,
      "MAINTENANCE",
      "SYSTEM",
      "GC",
      {
        summary: "Garbage collection maintenance ran",
        timestamp: new Date().toISOString(),
      }
    )
    
    // Force garbage collection if available (Node.js doesn't expose this directly)
    if (global.gc) {
      global.gc()
    }
    
    revalidatePath("/dashboard/admin/health")
    return { success: true, message: "Garbage collection completed" }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to run garbage collection",
    }
  }
}


