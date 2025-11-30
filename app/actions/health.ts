"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { unstable_noStore as noStore } from "next/cache"

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

export interface SystemHealth {
  status: "OPERATIONAL" | "DEGRADED"
  database: {
    latency: number // milliseconds
    connected: boolean
  }
  memory: {
    rss: number // Resident Set Size in bytes
    heapTotal: number
    heapUsed: number
  }
  uptime: number // seconds
  errorRate: {
    count: number
    last24h: boolean
  }
  rowCounts: {
    users: number
    products: number
    activeLots: number
    pendingReceives: number
  }
  recentLogs: Array<{
    id: string
    action: string
    entity_type: string
    createdAt: Date
    user: {
      name: string | null
    }
  }>
}

/**
 * Get comprehensive system health metrics
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  await requireAdmin()
  
  // Prevent caching - health data must be real-time
  noStore()

  const startTime = Date.now()

  try {
    // Database latency check
    const dbStartTime = Date.now()
    await prisma.$queryRaw`SELECT 1`
    const dbLatency = Date.now() - dbStartTime
    const dbConnected = true

    // Determine overall status based on DB latency
    const status: "OPERATIONAL" | "DEGRADED" = dbLatency < 200 ? "OPERATIONAL" : "DEGRADED"

    // Memory usage
    const memoryUsage = process.memoryUsage()

    // Uptime
    const uptime = process.uptime()

    // Error rate (last 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const errorCount = await prisma.auditLog.count({
      where: {
        action: {
          contains: "ERROR",
          mode: "insensitive",
        },
        createdAt: {
          gte: twentyFourHoursAgo,
        },
      },
    })

    // Row counts
    const [usersCount, productsCount, activeLotsCount, pendingReceivesCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.product.count(),
        prisma.inventoryLot.count({
          where: {
            status: {
              in: ["RECEIVED", "QC_PENDING", "AVAILABLE"],
            },
          },
        }),
        prisma.receivingEvent.count({
          where: {
            status: "OPEN",
          },
        }),
      ])

    // Recent system logs (last 10)
    const recentLogs = await prisma.auditLog.findMany({
      take: 10,
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
          },
        },
      },
    })

    return {
      status,
      database: {
        latency: dbLatency,
        connected: dbConnected,
      },
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
      },
      uptime,
      errorRate: {
        count: errorCount,
        last24h: true,
      },
      rowCounts: {
        users: usersCount,
        products: productsCount,
        activeLots: activeLotsCount,
        pendingReceives: pendingReceivesCount,
      },
      recentLogs: recentLogs.map((log) => ({
        id: log.id,
        action: log.action,
        entity_type: log.entity_type,
        createdAt: log.createdAt,
        user: {
          name: log.user.name,
        },
      })),
    }
  } catch (error) {
    // If database check fails, system is degraded
    const dbLatency = Date.now() - startTime

    return {
      status: "DEGRADED",
      database: {
        latency: dbLatency,
        connected: false,
      },
      memory: {
        rss: process.memoryUsage().rss,
        heapTotal: process.memoryUsage().heapTotal,
        heapUsed: process.memoryUsage().heapUsed,
      },
      uptime: process.uptime(),
      errorRate: {
        count: 0,
        last24h: true,
      },
      rowCounts: {
        users: 0,
        products: 0,
        activeLots: 0,
        pendingReceives: 0,
      },
      recentLogs: [],
    }
  }
}

/**
 * Purge Next.js cache
 */
export async function purgeCache() {
  await requireAdmin()
  
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
  await requireAdmin()
  
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

