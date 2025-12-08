"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"
import { revalidatePath } from "next/cache"
import { LotStatus, UnitType } from "@prisma/client"
import { getNextLotNumber } from "@/lib/lot-number"

interface ConvertInventoryInput {
  sourceLotId: string
  outputProductId: string
  quantityConsumed: number
  quantityProduced: number
  unitType: "CASE" | "LBS"
  notes?: string
}

interface SourceLotInput {
  sourceLotId: string
  quantityConsumed: number
}

interface BatchConvertInventoryInput {
  sourceLots: SourceLotInput[]
  outputProductId: string
  quantityProduced: number
  unitType: "CASE" | "LBS"
  notes?: string
}

/**
 * Convert inventory from one lot to another (repacking/conversion)
 * 
 * This function:
 * - Validates source lot has sufficient quantity
 * - Decrements source lot quantity
 * - Creates a new destination lot with parent relationship
 * - Records the production run
 * - Logs audit trail
 */
export async function convertInventory(input: ConvertInventoryInput) {
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: "Unauthorized - Please log in",
    }
  }

  // Allow ADMIN, RECEIVER, PACKER, and MANAGER roles to convert inventory
  const allowedRoles = ["ADMIN", "RECEIVER", "PACKER", "MANAGER"]
  if (!allowedRoles.includes(session.user.role)) {
    return {
      success: false,
      error: "Insufficient permissions to convert inventory",
    }
  }

  const { sourceLotId, outputProductId, quantityConsumed, quantityProduced, unitType, notes } = input

  // Validate inputs
  if (quantityConsumed <= 0) {
    return {
      success: false,
      error: "Quantity consumed must be greater than zero",
    }
  }

  if (quantityProduced <= 0) {
    return {
      success: false,
      error: "Quantity produced must be greater than zero",
    }
  }

  if (!["CASE", "LBS"].includes(unitType)) {
    return {
      success: false,
      error: "Unit type must be CASE or LBS",
    }
  }

  try {
    // Use transaction to ensure all-or-nothing behavior
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch source lot with related data
      const sourceLot = await tx.inventoryLot.findUnique({
        where: { id: sourceLotId },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              unit_type: true,
            },
          },
          receivingEvent: {
            include: {
              vendor: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      })

      if (!sourceLot) {
        throw new Error("Source lot not found")
      }

      // 2. Validate source lot has sufficient quantity
      // Round quantityConsumed for comparison since quantity_current is Int
      const quantityConsumedRounded = Math.round(quantityConsumed)
      if (sourceLot.quantity_current < quantityConsumedRounded) {
        throw new Error(
          `Insufficient quantity in source lot. Available: ${sourceLot.quantity_current}, Required: ${quantityConsumedRounded}`
        )
      }

      // 3. Fetch output product
      const outputProduct = await tx.product.findUnique({
        where: { id: outputProductId },
        select: {
          id: true,
          sku: true,
          name: true,
          gtin: true,
          default_origin_country: true,
          unit_type: true,
        },
      })

      if (!outputProduct) {
        throw new Error("Output product not found")
      }

      if (!outputProduct.gtin) {
        throw new Error(`Output product ${outputProduct.name} is missing GTIN`)
      }

      // 4. Decrement source lot quantity
      // Use rounded value since quantity_current is Int
      const newSourceQuantity = sourceLot.quantity_current - quantityConsumedRounded
      const sourceStatus = newSourceQuantity === 0 ? LotStatus.DEPLETED : sourceLot.status

      const updatedSourceLot = await tx.inventoryLot.update({
        where: { id: sourceLotId },
        data: {
          quantity_current: newSourceQuantity,
          status: sourceStatus,
        },
      })

      // 5. Generate sequential lot number for destination lot
      // Format: 01 + 6-digit sequence (e.g., 01000001)
      const lotNumber = await getNextLotNumber(tx)

      // 6. Inherit expiry date from source lot (safest approach)
      const expiryDate = sourceLot.expiry_date
      const today = new Date()

      // 7. Create destination lot
      // Round quantityProduced for storage since quantity fields are Int
      const quantityProducedRounded = Math.round(quantityProduced)
      const destinationLot = await tx.inventoryLot.create({
        data: {
          lot_number: lotNumber,
          product_id: outputProduct.id,
          parent_lot_id: sourceLotId,
          original_quantity: quantityProducedRounded,
          quantity_received: quantityProducedRounded,
          quantity_current: quantityProducedRounded,
          received_date: today,
          expiry_date: expiryDate,
          origin_country: sourceLot.origin_country, // Inherit from source
          grower_id: sourceLot.grower_id, // Inherit from source
          status: LotStatus.RECEIVED,
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              gtin: true,
              variety: true,
              unit_type: true,
              standard_case_weight: true,
            },
          },
          parentLot: {
            select: {
              id: true,
              lot_number: true,
              product: {
                select: {
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      })

      // 8. Create production run record
      await tx.productionRun.create({
        data: {
          user_id: session.user.id,
          source_lot_id: sourceLotId,
          destination_lot_id: destinationLot.id,
          quantity_consumed: quantityConsumed,
          quantity_produced: quantityProduced,
          notes: notes || null,
        },
      })

      return {
        sourceLot: updatedSourceLot,
        destinationLot,
      }
    })

    // 9. Log audit activity
    await logActivity(
      session.user.id,
      AuditAction.CONVERT_LOT,
      EntityType.LOT,
      result.destinationLot.id,
      {
        source_lot_id: sourceLotId,
        source_lot_number: result.destinationLot.parentLot?.lot_number,
        source_product: result.destinationLot.parentLot?.product?.name,
        destination_lot_id: result.destinationLot.id,
        destination_lot_number: result.destinationLot.lot_number,
        destination_product: result.destinationLot.product.name,
        quantity_consumed: quantityConsumed,
        quantity_produced: quantityProduced,
        unit_type: unitType,
        notes: notes || null,
        summary: `Converted ${quantityConsumed} ${unitType} from Lot ${result.destinationLot.parentLot?.lot_number} to ${quantityProduced} ${unitType} in Lot ${result.destinationLot.lot_number}`,
      }
    )

    // Revalidate relevant paths
    revalidatePath("/dashboard/inventory")
    revalidatePath("/dashboard/production")

    return {
      success: true,
      data: {
        lot: result.destinationLot,
      },
    }
  } catch (error) {
    console.error("Error converting inventory:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to convert inventory",
    }
  }
}

/**
 * Convert inventory from multiple source lots to one destination lot (batch conversion)
 */
export async function batchConvertInventory(input: BatchConvertInventoryInput) {
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: "Unauthorized - Please log in",
    }
  }

  // Allow ADMIN, RECEIVER, PACKER, and MANAGER roles to convert inventory
  const allowedRoles = ["ADMIN", "RECEIVER", "PACKER", "MANAGER"]
  if (!allowedRoles.includes(session.user.role)) {
    return {
      success: false,
      error: "Insufficient permissions to convert inventory",
    }
  }

  const { sourceLots, outputProductId, quantityProduced, unitType, notes } = input

  // Validate inputs
  if (sourceLots.length === 0) {
    return {
      success: false,
      error: "At least one source lot is required",
    }
  }

  if (quantityProduced <= 0) {
    return {
      success: false,
      error: "Quantity produced must be greater than zero",
    }
  }

  if (!["CASE", "LBS"].includes(unitType)) {
    return {
      success: false,
      error: "Unit type must be CASE or LBS",
    }
  }

  try {
    // Use transaction to ensure all-or-nothing behavior
    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch all source lots and validate
      const sourceLotData = []
      for (const sourceInput of sourceLots) {
        const sourceLot = await tx.inventoryLot.findUnique({
          where: { id: sourceInput.sourceLotId },
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                unit_type: true,
              },
            },
            receivingEvent: {
              include: {
                vendor: {
                  select: {
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
        })

        if (!sourceLot) {
          throw new Error(`Source lot not found: ${sourceInput.sourceLotId}`)
        }

        const quantityConsumedRounded = Math.round(sourceInput.quantityConsumed)
        if (sourceLot.quantity_current < quantityConsumedRounded) {
          throw new Error(
            `Insufficient quantity in source lot ${sourceLot.lot_number}. Available: ${sourceLot.quantity_current}, Required: ${quantityConsumedRounded}`
          )
        }

        sourceLotData.push({ lot: sourceLot, quantityConsumed: quantityConsumedRounded })
      }

      // 2. Fetch output product
      const outputProduct = await tx.product.findUnique({
        where: { id: outputProductId },
        select: {
          id: true,
          sku: true,
          name: true,
          gtin: true,
          default_origin_country: true,
          unit_type: true,
        },
      })

      if (!outputProduct) {
        throw new Error("Output product not found")
      }

      if (!outputProduct.gtin) {
        throw new Error(`Output product ${outputProduct.name} is missing GTIN`)
      }

      // 3. Decrement all source lots
      const updatedSourceLots = []
      for (const { lot, quantityConsumed } of sourceLotData) {
        const newSourceQuantity = lot.quantity_current - quantityConsumed
        const sourceStatus = newSourceQuantity === 0 ? LotStatus.DEPLETED : lot.status

        const updatedSourceLot = await tx.inventoryLot.update({
          where: { id: lot.id },
          data: {
            quantity_current: newSourceQuantity,
            status: sourceStatus,
          },
        })

        updatedSourceLots.push({ lot: updatedSourceLot, quantityConsumed })
      }

      // 4. Generate sequential lot number for destination lot
      // Format: 01 + 6-digit sequence (e.g., 01000001)
      const lotNumber = await getNextLotNumber(tx)

      // 5. Use earliest expiry date from source lots
      const expiryDate = sourceLotData.reduce((earliest, { lot }) => {
        const lotExpiry = new Date(lot.expiry_date)
        return lotExpiry < earliest ? lotExpiry : earliest
      }, new Date(sourceLotData[0].lot.expiry_date))

      // 6. Create destination lot (use first source lot as parent)
      const today = new Date()
      const quantityProducedRounded = Math.round(quantityProduced)
      const primarySource = sourceLotData[0].lot
      const destinationLot = await tx.inventoryLot.create({
        data: {
          lot_number: lotNumber,
          product_id: outputProduct.id,
          parent_lot_id: primarySource.id, // Use first source lot as parent
          original_quantity: quantityProducedRounded,
          quantity_received: quantityProducedRounded,
          quantity_current: quantityProducedRounded,
          received_date: today,
          expiry_date: expiryDate,
          origin_country: primarySource.origin_country,
          grower_id: primarySource.grower_id,
          status: LotStatus.RECEIVED,
        },
        include: {
          product: {
            select: {
              id: true,
              sku: true,
              name: true,
              gtin: true,
              variety: true,
              unit_type: true,
              standard_case_weight: true,
            },
          },
          parentLot: {
            select: {
              id: true,
              lot_number: true,
              product: {
                select: {
                  name: true,
                  sku: true,
                },
              },
            },
          },
        },
      })

      // 7. Calculate total quantity consumed for proportional allocation
      const totalQuantityConsumed = sourceLotData.reduce(
        (sum, { quantityConsumed }) => sum + quantityConsumed,
        0
      )

      // 8. Create production run records for each source lot
      // Allocate quantity_produced proportionally based on quantity_consumed
      for (const { lot, quantityConsumed } of sourceLotData) {
        // Calculate proportional contribution: (quantityConsumed / totalQuantityConsumed) * quantityProduced
        const proportionalProduced = (quantityConsumed / totalQuantityConsumed) * quantityProduced
        
        await tx.productionRun.create({
          data: {
            user_id: session.user.id,
            source_lot_id: lot.id,
            destination_lot_id: destinationLot.id,
            quantity_consumed: quantityConsumed,
            quantity_produced: proportionalProduced, // Proportional share of total produced
            notes: notes || null,
          },
        })
      }

      return {
        sourceLots: updatedSourceLots,
        destinationLot,
        totalQuantityConsumed: totalQuantityConsumed, // Return the rounded total from transaction
      }
    })

    // 9. Log audit activity
    // Use the rounded total from the transaction to match ProductionRun records
    const totalQuantityConsumed = result.totalQuantityConsumed
    await logActivity(
      session.user.id,
      AuditAction.CONVERT_LOT,
      EntityType.LOT,
      result.destinationLot.id,
      {
        source_lots: sourceLots.map((s) => s.sourceLotId),
        source_lot_count: sourceLots.length,
        destination_lot_id: result.destinationLot.id,
        destination_lot_number: result.destinationLot.lot_number,
        destination_product: result.destinationLot.product.name,
        total_quantity_consumed: totalQuantityConsumed,
        quantity_produced: quantityProduced,
        unit_type: unitType,
        notes: notes || null,
        summary: `Converted ${sourceLots.length} source lot(s) (${totalQuantityConsumed} total) to ${quantityProduced} ${unitType} in Lot ${result.destinationLot.lot_number}`,
      }
    )

    // Revalidate relevant paths
    revalidatePath("/dashboard/inventory")
    revalidatePath("/dashboard/production")

    return {
      success: true,
      data: {
        lot: result.destinationLot,
      },
    }
  } catch (error) {
    console.error("Error batch converting inventory:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to convert inventory",
    }
  }
}

/**
 * Get a lot by lot number (for scanning/selection)
 */
export async function getLotByLotNumber(lotNumber: string) {
  const session = await auth()

  if (!session?.user) {
    return {
      success: false,
      error: "Unauthorized - Please log in",
    }
  }

  try {
    const lot = await prisma.inventoryLot.findUnique({
      where: { lot_number: lotNumber },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            gtin: true,
            unit_type: true,
            variety: true,
          },
        },
        receivingEvent: {
          include: {
            vendor: {
              select: {
                code: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!lot) {
      return {
        success: false,
        error: "Lot not found",
      }
    }

    // Check if lot has available quantity
    if (lot.quantity_current <= 0) {
      return {
        success: false,
        error: "Lot has no available quantity",
      }
    }

    // Check if lot is in a usable status
    if (!["RECEIVED", "QC_PENDING", "AVAILABLE"].includes(lot.status)) {
      return {
        success: false,
        error: `Lot is ${lot.status} and cannot be used for conversion`,
      }
    }

    return {
      success: true,
      data: lot,
    }
  } catch (error) {
    console.error("Error fetching lot:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch lot",
    }
  }
}

