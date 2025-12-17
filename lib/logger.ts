import { prisma } from "@/lib/prisma"

/**
 * Log an activity to the audit trail
 * 
 * @param userId - The ID of the user performing the action
 * @param action - The action being performed (e.g., "RECEIVE", "EDIT", "DELETE", "PRINT")
 * @param entityType - The type of entity (e.g., "LOT", "RECEIVING_EVENT", "VENDOR", "PRODUCT")
 * @param entityId - The ID of the specific entity
 * @param details - Additional context (old/new values, metadata)
 */
export async function logActivity(
  userId: string,
  action: string,
  entityType: string,
  entityId: string,
  details?: Record<string, any>
) {
  try {
    await prisma.auditLog.create({
      data: {
        user_id: userId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        details: details || undefined,
      },
    })
  } catch (error) {
    // Log errors but don't throw - audit logging should never break the main flow
    console.error("Failed to log activity:", error)
  }
}

/**
 * Common action types for consistency
 */
export const AuditAction = {
  // Receiving
  RECEIVE: "RECEIVE",
  FINALIZE: "FINALIZE",
  
  // CRUD operations
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  
  // Printing
  PRINT_LABEL: "PRINT_LABEL",
  PRINT_RECEIPT: "PRINT_RECEIPT",
  
  // Inventory
  ADJUST_QUANTITY: "ADJUST_QUANTITY",
  ADJUST_QTY: "ADJUST_QTY", // Alias for consistency
  CONVERT_LOT: "CONVERT_LOT", // Inventory conversion/repacking
  
  // Picking
  PICK: "PICK",
  UNPICK: "UNPICK",
  SHIP: "SHIP",
  
  // Order Management
  ALLOCATE: "ALLOCATE",
  
  // Integration/Sync
  SYNC: "SYNC",

  // Bulk Operations
  BULK_IMPORT: "BULK_IMPORT",

  // System Operations
  DATABASE_RESET: "DATABASE_RESET",
  ERROR: "ERROR",
  
  // Access
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
} as const

/**
 * Common entity types
 */
export const EntityType = {
  LOT: "LOT",
  RECEIVING_EVENT: "RECEIVING_EVENT",
  PRODUCT: "PRODUCT",
  VENDOR: "VENDOR",
  CUSTOMER: "CUSTOMER",
  USER: "USER",
  ORDER: "ORDER",
  SYSTEM: "SYSTEM",
} as const


