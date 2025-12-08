"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"
import { UnitType } from "@prisma/client"

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
 * Validation result for a single record
 */
interface ValidationResult {
  row: number // 1-indexed row number for reference
  data: Record<string, any>
  errors: string[]
  isConflict: boolean
  existingId?: string // If conflict, store the existing record ID
}

/**
 * Validation response
 */
export interface ValidateImportDataResult {
  validRecords: Array<{
    row: number
    data: Record<string, any>
  }>
  conflicts: Array<{
    row: number
    data: Record<string, any>
    existingId: string
    existingData: Record<string, any>
  }>
  errors: Array<{
    row: number
    data: Record<string, any>
    errors: string[]
  }>
  summary: {
    total: number
    valid: number
    conflicts: number
    errors: number
  }
}

/**
 * Validate import data before committing
 * 
 * @param type - Type of data to import: "PRODUCT" | "CUSTOMER" | "VENDOR"
 * @param data - Array of JSON objects from the file
 * @returns Validation result with valid records, conflicts, and errors
 */
export async function validateImportData(
  type: "PRODUCT" | "CUSTOMER" | "VENDOR",
  data: Array<Record<string, any>>
): Promise<ValidateImportDataResult> {
  await requireAdminOrManager()

  const validRecords: Array<{ row: number; data: Record<string, any> }> = []
  const conflicts: Array<{
    row: number
    data: Record<string, any>
    existingId: string
    existingData: Record<string, any>
  }> = []
  const errors: Array<{ row: number; data: Record<string, any>; errors: string[] }> = []

  // Process each row
  for (let i = 0; i < data.length; i++) {
    const row = i + 1 // 1-indexed for user reference
    const record = data[i]
    const validationErrors: string[] = []

    // Validate based on type
    if (type === "PRODUCT") {
      // Required fields: name, sku, gtin, default_origin_country
      if (!record.name || typeof record.name !== "string" || record.name.trim() === "") {
        validationErrors.push("Name is required")
      }
      if (!record.sku || typeof record.sku !== "string" || record.sku.trim() === "") {
        validationErrors.push("SKU is required")
      }
      if (!record.gtin || typeof record.gtin !== "string") {
        validationErrors.push("GTIN is required")
      } else {
        // Validate GTIN format (should be 14 digits)
        const gtinDigits = record.gtin.toString().replace(/\D/g, "")
        if (gtinDigits.length !== 14) {
          validationErrors.push("GTIN must be 14 digits")
        }
      }
      if (!record.default_origin_country || typeof record.default_origin_country !== "string" || record.default_origin_country.trim() === "") {
        validationErrors.push("Default origin country is required")
      }

      // Validate unit_type if provided
      if (record.unit_type && !["CASE", "LBS", "EACH"].includes(record.unit_type.toUpperCase())) {
        validationErrors.push("Unit type must be CASE, LBS, or EACH")
      }

      // Validate numeric fields
      if (record.standard_case_weight !== undefined && record.standard_case_weight !== null && record.standard_case_weight !== "") {
        const weight = parseFloat(record.standard_case_weight)
        if (isNaN(weight) || weight <= 0) {
          validationErrors.push("Standard case weight must be a positive number")
        }
      }

      if (record.target_temp_f !== undefined && record.target_temp_f !== null && record.target_temp_f !== "") {
        const temp = parseInt(record.target_temp_f)
        if (isNaN(temp)) {
          validationErrors.push("Target temperature must be a valid integer")
        }
      }

      // If no validation errors, check for duplicates
      if (validationErrors.length === 0) {
        const sku = record.sku.toString().trim()
        const gtin = record.gtin.toString().replace(/\D/g, "").padStart(14, "0")

        // Check for existing SKU or GTIN
        const existing = await prisma.product.findFirst({
          where: {
            OR: [
              { sku: sku },
              { gtin: gtin },
            ],
          },
        })

        if (existing) {
          conflicts.push({
            row,
            data: {
              ...record,
              sku,
              gtin,
              unit_type: record.unit_type?.toUpperCase() || "CASE",
            },
            existingId: existing.id,
            existingData: {
              sku: existing.sku,
              name: existing.name,
              gtin: existing.gtin,
            },
          })
          continue
        }

        // Valid record - normalize data
        validRecords.push({
          row,
          data: {
            sku,
            name: record.name.trim(),
            gtin,
            default_origin_country: record.default_origin_country.trim(),
            unit_type: (record.unit_type?.toUpperCase() || "CASE") as UnitType,
            variety: record.variety?.trim() || null,
            description: record.description?.trim() || null,
            standard_case_weight: record.standard_case_weight
              ? parseFloat(record.standard_case_weight)
              : null,
            target_temp_f: record.target_temp_f ? parseInt(record.target_temp_f) : null,
            image_url: record.image_url?.trim() || null,
          },
        })
      } else {
        errors.push({ row, data: record, errors: validationErrors })
      }
    } else if (type === "CUSTOMER") {
      // Required fields: name, code
      if (!record.name || typeof record.name !== "string" || record.name.trim() === "") {
        validationErrors.push("Name is required")
      }
      if (!record.code || typeof record.code !== "string" || record.code.trim() === "") {
        validationErrors.push("Code is required")
      }

      // Validate email if provided
      if (record.contact_email && typeof record.contact_email === "string" && record.contact_email.trim() !== "") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        if (!emailRegex.test(record.contact_email.trim())) {
          validationErrors.push("Contact email must be a valid email address")
        }
      }

      // If no validation errors, check for duplicates
      if (validationErrors.length === 0) {
        const code = record.code.toString().trim().toUpperCase()

        const existing = await prisma.customer.findUnique({
          where: { code },
        })

        if (existing) {
          conflicts.push({
            row,
            data: {
              ...record,
              code,
              name: record.name.trim(),
            },
            existingId: existing.id,
            existingData: {
              code: existing.code,
              name: existing.name,
            },
          })
          continue
        }

        // Valid record
        validRecords.push({
          row,
          data: {
            name: record.name.trim(),
            code,
            address: record.address?.trim() || null,
            contact_email: record.contact_email?.trim() || null,
            active: record.active !== undefined ? Boolean(record.active) : true,
          },
        })
      } else {
        errors.push({ row, data: record, errors: validationErrors })
      }
    } else if (type === "VENDOR") {
      // Required fields: name, code
      if (!record.name || typeof record.name !== "string" || record.name.trim() === "") {
        validationErrors.push("Name is required")
      }
      if (!record.code || typeof record.code !== "string" || record.code.trim() === "") {
        validationErrors.push("Code is required")
      }

      // If no validation errors, check for duplicates
      if (validationErrors.length === 0) {
        const code = record.code.toString().trim().toUpperCase()

        const existing = await prisma.vendor.findUnique({
          where: { code },
        })

        if (existing) {
          conflicts.push({
            row,
            data: {
              ...record,
              code,
              name: record.name.trim(),
            },
            existingId: existing.id,
            existingData: {
              code: existing.code,
              name: existing.name,
            },
          })
          continue
        }

        // Valid record
        validRecords.push({
          row,
          data: {
            name: record.name.trim(),
            code,
            active: record.active !== undefined ? Boolean(record.active) : true,
          },
        })
      } else {
        errors.push({ row, data: record, errors: validationErrors })
      }
    }
  }

  return {
    validRecords,
    conflicts,
    errors,
    summary: {
      total: data.length,
      valid: validRecords.length,
      conflicts: conflicts.length,
      errors: errors.length,
    },
  }
}

/**
 * Commit validated import data to database
 * 
 * @param type - Type of data to import: "PRODUCT" | "CUSTOMER" | "VENDOR"
 * @param records - Array of validated records to import
 * @param conflictResolution - Map of conflict row numbers to resolution: "OVERWRITE" | "SKIP"
 * @returns Result with success status and counts
 */
export async function commitImport(
  type: "PRODUCT" | "CUSTOMER" | "VENDOR",
  records: Array<{
    row: number
    data: Record<string, any>
    existingId?: string // If present, this is an update
    conflictResolution?: "OVERWRITE" | "SKIP"
  }>
): Promise<{
  success: boolean
  created: number
  updated: number
  skipped: number
  error?: string
}> {
  const session = await requireAdminOrManager()

  let created = 0
  let updated = 0
  let skipped = 0

  try {
    await prisma.$transaction(async (tx) => {
      for (const record of records) {
        // Skip if conflict resolution is SKIP
        if (record.conflictResolution === "SKIP") {
          skipped++
          continue
        }

        if (type === "PRODUCT") {
          if (record.existingId && record.conflictResolution === "OVERWRITE") {
            // Update existing product
            await tx.product.update({
              where: { id: record.existingId },
              data: record.data as any,
            })
            updated++
          } else {
            // Create new product
            await tx.product.create({
              data: record.data as any,
            })
            created++
          }
        } else if (type === "CUSTOMER") {
          if (record.existingId && record.conflictResolution === "OVERWRITE") {
            // Update existing customer
            await tx.customer.update({
              where: { id: record.existingId },
              data: record.data as any,
            })
            updated++
          } else {
            // Create new customer
            await tx.customer.create({
              data: record.data as any,
            })
            created++
          }
        } else if (type === "VENDOR") {
          if (record.existingId && record.conflictResolution === "OVERWRITE") {
            // Update existing vendor
            await tx.vendor.update({
              where: { id: record.existingId },
              data: record.data as any,
            })
            updated++
          } else {
            // Create new vendor
            await tx.vendor.create({
              data: record.data as any,
            })
            created++
          }
        }
      }
    })

    // Log the bulk import activity
    const totalProcessed = created + updated
    await logActivity(
      session.user.id,
      "BULK_IMPORT",
      type,
      "BATCH",
      {
        type,
        created,
        updated,
        skipped,
        total: totalProcessed,
        summary: `Bulk import: ${created} created, ${updated} updated, ${skipped} skipped`,
      }
    )

    // Revalidate relevant paths
    if (type === "PRODUCT") {
      revalidatePath("/dashboard/admin/products")
      revalidatePath("/dashboard/inventory")
    } else if (type === "CUSTOMER") {
      revalidatePath("/dashboard/admin/customers")
      revalidatePath("/dashboard/orders")
    } else if (type === "VENDOR") {
      revalidatePath("/dashboard/admin/vendors")
      revalidatePath("/dashboard/receiving")
    }

    return {
      success: true,
      created,
      updated,
      skipped,
    }
  } catch (error) {
    console.error("Error committing import:", error)
    return {
      success: false,
      created,
      updated,
      skipped,
      error: error instanceof Error ? error.message : "Failed to commit import",
    }
  }
}

