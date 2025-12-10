import { PrismaClient } from '@prisma/client'

/**
 * Prisma Client Singleton Pattern
 * 
 * Critical for Next.js serverless/edge functions:
 * - Prevents connection pool exhaustion in production
 * - Reuses the same PrismaClient instance across requests
 * - In development, stores instance in globalThis to prevent hot-reload issues
 * - In production, creates a single instance per serverless function
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

// Store in globalThis to prevent multiple instances during hot-reload in development
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
