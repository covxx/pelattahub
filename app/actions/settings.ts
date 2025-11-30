"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"

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
 * Get a single system setting by key
 */
export async function getSetting(key: string): Promise<string | null> {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
  })
  return setting?.value || null
}

/**
 * Get all system settings as a key-value object
 */
export async function getAllSettings(): Promise<Record<string, string>> {
  const settings = await prisma.systemSetting.findMany()
  
  const result: Record<string, string> = {}
  settings.forEach((setting) => {
    result[setting.key] = setting.value
  })
  
  return result
}

/**
 * Get company-specific settings for labels and receipts
 */
export async function getCompanySettings() {
  const settings = await prisma.systemSetting.findMany({
    where: {
      key: {
        in: ["company_name", "company_address", "gs1_prefix"],
      },
    },
  })

  const result = {
    name: "",
    address: "",
    gs1_prefix: "000000",
  }

  settings.forEach((setting) => {
    if (setting.key === "company_name") result.name = setting.value
    if (setting.key === "company_address") result.address = setting.value
    if (setting.key === "gs1_prefix") result.gs1_prefix = setting.value
  })

  return result
}

/**
 * Update company settings
 * Only ADMIN can update settings
 */
export async function updateCompanySettings(data: {
  company_name?: string
  company_address?: string
  gs1_prefix?: string
}) {
  const session = await requireAdmin()

  try {
    const updates = []

    // Prepare updates for each provided field
    if (data.company_name !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: "company_name" },
          create: {
            key: "company_name",
            value: data.company_name,
            description: "Company name displayed on labels and receipts",
            updatedAt: new Date(),
          },
          update: {
            value: data.company_name,
            updatedAt: new Date(),
          },
        })
      )
    }

    if (data.company_address !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: "company_address" },
          create: {
            key: "company_address",
            value: data.company_address,
            description: "Company address for receipts",
            updatedAt: new Date(),
          },
          update: {
            value: data.company_address,
            updatedAt: new Date(),
          },
        })
      )
    }

    if (data.gs1_prefix !== undefined) {
      updates.push(
        prisma.systemSetting.upsert({
          where: { key: "gs1_prefix" },
          create: {
            key: "gs1_prefix",
            value: data.gs1_prefix,
            description: "GS1 Company Prefix for GTIN validation",
            updatedAt: new Date(),
          },
          update: {
            value: data.gs1_prefix,
            updatedAt: new Date(),
          },
        })
      )
    }

    // Execute all updates
    await prisma.$transaction(updates)

    // Log the settings update
    await logActivity(
      session.user.id,
      AuditAction.UPDATE,
      EntityType.PRODUCT, // Using PRODUCT as proxy for SETTINGS
      "SYSTEM_SETTINGS",
      {
        changes: data,
        summary: "Updated company settings",
      }
    )

    revalidatePath("/dashboard/admin/settings")
    revalidatePath("/dashboard/receiving")

    return { success: true }
  } catch (error) {
    console.error("Error updating settings:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update settings",
    }
  }
}

/**
 * Update a single setting (generic)
 */
export async function updateSetting(
  key: string,
  value: string,
  description?: string
) {
  await requireAdmin()

  const setting = await prisma.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value,
      description,
      updatedAt: new Date(),
    },
    update: {
      value,
      updatedAt: new Date(),
    },
  })

  revalidatePath("/dashboard/admin/settings")
  return setting
}


