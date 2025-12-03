"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { unstable_noStore as noStore } from "next/cache"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"
import { OrderStatus, LotStatus } from "@prisma/client"

/**
 * Get order with items and available inventory lots for picking
 * For each item, fetches available lots with remaining quantity calculated
 * (excluding picks from active orders)
 */
export async function getOrderForPicking(orderId: string) {
  noStore() // Ensure fresh data for picking operations

  const session = await auth()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Only ADMIN and PACKER can pick orders
  if (session.user.role !== "ADMIN" && session.user.role !== "PACKER") {
    throw new Error("Insufficient permissions")
  }

  try {
    // Fetch the order with items
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit_type: true,
              },
            },
            allocations: {
              include: {
                inventory_lot: {
                  select: {
                    id: true,
                    lot_number: true,
                    expiry_date: true,
                    quantity_current: true,
                    status: true,
                  },
                },
              },
            },
            picks: {
              select: {
                id: true,
                inventory_lot_id: true,
                quantity_picked: true,
                picked_at: true,
                inventory_lot: {
                  select: {
                    lot_number: true,
                  },
                },
                picked_by_user: {
                  select: {
                    id: true,
                    name: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    })

    if (!order) {
      throw new Error("Order not found")
    }

    // Check if order is in a pickable state
    if (
      order.status !== OrderStatus.CONFIRMED &&
      order.status !== OrderStatus.PICKING &&
      order.status !== OrderStatus.PARTIAL_PICK
    ) {
      throw new Error(
        `Order is in ${order.status} status. Only CONFIRMED, PICKING, or PARTIAL_PICK orders can be picked.`
      )
    }

    // For each item, fetch available inventory lots and calculate remaining quantity
    const itemsWithAvailableLots = await Promise.all(
      order.items.map(async (item) => {
        // Get all available lots for this product
        const availableLots = await prisma.inventoryLot.findMany({
          where: {
            product_id: item.product_id,
            status: LotStatus.AVAILABLE,
            quantity_current: {
              gt: 0, // Only lots with available quantity
            },
          },
          orderBy: {
            expiry_date: "asc", // Oldest first (FIFO)
          },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                sku: true,
                unit_type: true,
              },
            },
          },
        })

        // Calculate remaining quantity for each lot
        // remaining_qty = quantity_current - sum of picks from active orders (not SHIPPED)
        const lotsWithRemainingQty = await Promise.all(
          availableLots.map(async (lot) => {
            // Get all picks for this lot from orders that are not SHIPPED
            const activePicks = await prisma.orderPick.findMany({
              where: {
                inventory_lot_id: lot.id,
                order_item: {
                  order: {
                    status: {
                      not: OrderStatus.SHIPPED,
                    },
                  },
                },
              },
              select: {
                quantity_picked: true,
              },
            })

            // Calculate total picked quantity from active orders
            const totalPicked = activePicks.reduce(
              (sum, pick) => sum + pick.quantity_picked,
              0
            )

            // Calculate remaining quantity
            const remaining_qty = Math.max(0, lot.quantity_current - totalPicked)

            return {
              ...lot,
              remaining_qty,
              total_picked: totalPicked,
            }
          })
        )

        // Filter out lots with zero remaining quantity
        const lotsWithQty = lotsWithRemainingQty.filter(
          (lot) => lot.remaining_qty > 0
        )

        // Calculate how much has been picked for this item
        const totalPickedForItem = item.picks.reduce(
          (sum, pick) => sum + pick.quantity_picked,
          0
        )
        const remainingToPick = item.quantity_ordered - totalPickedForItem

        return {
          ...item,
          availableLots: lotsWithQty,
          totalPicked: totalPickedForItem,
          remainingToPick,
        }
      })
    )

    return {
      ...order,
      items: itemsWithAvailableLots,
    }
  } catch (error) {
    console.error("Error getting order for picking:", error)
    throw error
  }
}

/**
 * Submit a pick for an order item
 * Creates OrderPick record, decrements inventory, and updates order status if complete
 */
export async function submitPick(
  orderItemId: string,
  lotId: string,
  quantity: number
) {
  const session = await auth()

  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  // Only ADMIN and PACKER can pick orders
  if (session.user.role !== "ADMIN" && session.user.role !== "PACKER") {
    return { success: false, error: "Insufficient permissions" }
  }

  if (quantity <= 0) {
    return { success: false, error: "Quantity must be greater than 0" }
  }

  try {
    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // Get the order item with order and product info
      const orderItem = await tx.orderItem.findUnique({
        where: { id: orderItemId },
        include: {
          order: {
            select: {
              id: true,
              status: true,
              po_number: true,
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              unit_type: true,
            },
          },
          picks: {
            select: {
              quantity_picked: true,
            },
          },
        },
      })

      if (!orderItem) {
        throw new Error("Order item not found")
      }

      // Check if order is in a pickable state
      if (
        orderItem.order.status !== OrderStatus.CONFIRMED &&
        orderItem.order.status !== OrderStatus.PICKING &&
        orderItem.order.status !== OrderStatus.PARTIAL_PICK
      ) {
        throw new Error(
          `Order is in ${orderItem.order.status} status. Cannot pick from this order.`
        )
      }

      // Get the lot
      const lot = await tx.inventoryLot.findUnique({
        where: { id: lotId },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
            },
          },
        },
      })

      if (!lot) {
        throw new Error("Lot not found")
      }

      // Verify lot belongs to the same product as the order item
      if (lot.product_id !== orderItem.product_id) {
        throw new Error("Lot does not match order item product")
      }

      // Verify lot is available
      if (lot.status !== LotStatus.AVAILABLE) {
        throw new Error(`Lot ${lot.lot_number} is not available for picking`)
      }

      // Calculate how much has already been picked for this item
      const totalPickedForItem = orderItem.picks.reduce(
        (sum, pick) => sum + pick.quantity_picked,
        0
      )
      const remainingToPick = orderItem.quantity_ordered - totalPickedForItem

      if (quantity > remainingToPick) {
        throw new Error(
          `Cannot pick ${quantity}. Only ${remainingToPick} remaining for this item.`
        )
      }

      // Get all picks for this lot from active orders (not SHIPPED)
      const activePicks = await tx.orderPick.findMany({
        where: {
          inventory_lot_id: lotId,
          order_item: {
            order: {
              status: {
                not: OrderStatus.SHIPPED,
              },
            },
          },
        },
        select: {
          quantity_picked: true,
        },
      })

      // Calculate total picked from this lot
      const totalPickedFromLot = activePicks.reduce(
        (sum, pick) => sum + pick.quantity_picked,
        0
      )

      // Calculate available quantity (excluding this pick we're about to create)
      const availableQty = lot.quantity_current - totalPickedFromLot

      if (quantity > availableQty) {
        throw new Error(
          `Insufficient quantity in lot ${lot.lot_number}. Available: ${availableQty}, Requested: ${quantity}`
        )
      }

      // Create the pick record
      const pick = await tx.orderPick.create({
        data: {
          order_item_id: orderItemId,
          inventory_lot_id: lotId,
          quantity_picked: quantity,
          picked_by_user_id: session.user.id,
        },
        include: {
          order_item: {
            include: {
              order: {
                select: {
                  id: true,
                  po_number: true,
                },
              },
            },
          },
          inventory_lot: {
            select: {
              lot_number: true,
            },
          },
        },
      })

      // Decrement the lot's current quantity
      const updatedLot = await tx.inventoryLot.update({
        where: { id: lotId },
        data: {
          quantity_current: {
            decrement: quantity,
          },
        },
      })

      // Update lot status if depleted
      if (updatedLot.quantity_current <= 0) {
        await tx.inventoryLot.update({
          where: { id: lotId },
          data: {
            status: LotStatus.DEPLETED,
          },
        })
      }

      // Check if all items in the order are fully picked
      const allOrderItems = await tx.orderItem.findMany({
        where: { order_id: orderItem.order.id },
        include: {
          picks: {
            select: {
              quantity_picked: true,
            },
          },
        },
      })

      const allItemsFullyPicked = allOrderItems.every((item) => {
        const totalPicked = item.picks.reduce(
          (sum, pick) => sum + pick.quantity_picked,
          0
        )
        return totalPicked >= item.quantity_ordered
      })

      // Update order status if all items are fully picked
      let orderStatus: OrderStatus = orderItem.order.status
      if (allItemsFullyPicked) {
        orderStatus = OrderStatus.READY_TO_SHIP
        await tx.order.update({
          where: { id: orderItem.order.id },
          data: {
            status: OrderStatus.READY_TO_SHIP,
          },
        })
      } else {
        // If not fully picked, set to PARTIAL_PICK or PICKING
        const hasAnyPicks = allOrderItems.some(
          (item) => item.picks.length > 0
        )
        if (hasAnyPicks && orderItem.order.status === OrderStatus.CONFIRMED) {
          orderStatus = OrderStatus.PARTIAL_PICK
          await tx.order.update({
            where: { id: orderItem.order.id },
            data: {
              status: OrderStatus.PARTIAL_PICK,
            },
          })
        } else if (orderItem.order.status === OrderStatus.CONFIRMED) {
          orderStatus = OrderStatus.PICKING
          await tx.order.update({
            where: { id: orderItem.order.id },
            data: {
              status: OrderStatus.PICKING,
            },
          })
        }
      }

      return {
        pick,
        lot: updatedLot,
        orderStatus,
        allItemsFullyPicked,
      }
    })

    // Log the pick activity
    const orderItem = await prisma.orderItem.findUnique({
      where: { id: orderItemId },
      include: {
        order: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        product: {
          select: {
            name: true,
            sku: true,
            unit_type: true,
          },
        },
      },
    })

    const lot = await prisma.inventoryLot.findUnique({
      where: { id: lotId },
      select: {
        lot_number: true,
      },
    })

    if (orderItem && lot) {
      // Ensure customer name is fetched correctly
      const customerName = orderItem.order.customer?.name || "Unknown"
      const poNumber = orderItem.order.po_number || null

      await logActivity(
        session.user.id,
        AuditAction.PICK,
        EntityType.ORDER,
        orderItem.order.id,
        {
          summary: `Picked ${quantity} ${orderItem.product.unit_type.toLowerCase()} of ${orderItem.product.name} from Lot ${lot.lot_number} for Order #${poNumber || orderItem.order.id.slice(0, 8).toUpperCase()}`,
          // Required fields for Lot History UI
          customer_name: customerName,
          po_number: poNumber,
          quantity: quantity,
          // Additional fields for context
          order_item_id: orderItemId,
          order_id: orderItem.order.id,
          order_po_number: poNumber, // Keep for backward compatibility
          lot_id: lotId,
          lot_number: lot.lot_number,
          product_name: orderItem.product.name,
          product_sku: orderItem.product.sku,
          quantity_picked: quantity, // Keep for backward compatibility
          unit_type: orderItem.product.unit_type,
          order_status: result.orderStatus,
        }
      )
    }

    revalidatePath("/dashboard/orders")
    revalidatePath(`/dashboard/orders/${orderItem?.order.id}`)

    return {
      success: true,
      pick: result.pick,
      orderStatus: result.orderStatus,
      allItemsFullyPicked: result.allItemsFullyPicked,
    }
  } catch (error) {
    console.error("Error submitting pick:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to submit pick",
    }
  }
}

/**
 * Revert a pick - restore inventory and delete the pick record
 * Used to undo a pick that was made in error
 */
export async function revertPick(pickId: string) {
  const session = await auth()

  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  // Only ADMIN and PACKER can revert picks
  if (session.user.role !== "ADMIN" && session.user.role !== "PACKER") {
    return { success: false, error: "Insufficient permissions" }
  }

  try {
    // Use transaction to ensure all-or-nothing behavior
    const result = await prisma.$transaction(async (tx) => {
      // Fetch the OrderPick record with relations
      const pick = await tx.orderPick.findUnique({
        where: { id: pickId },
        include: {
          inventory_lot: {
            include: {
              product: {
                select: {
                  id: true,
                  name: true,
                  sku: true,
                  unit_type: true,
                },
              },
            },
          },
          order_item: {
            include: {
              order: {
                select: {
                  id: true,
                  po_number: true,
                  status: true,
                },
              },
              product: {
                select: {
                  name: true,
                  sku: true,
                },
              },
            },
          },
          picked_by_user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      })

      if (!pick) {
        throw new Error("Pick not found")
      }

      // Check if order is already shipped - cannot revert picks from shipped orders
      if (pick.order_item.order.status === OrderStatus.SHIPPED) {
        throw new Error("Cannot revert picks from shipped orders")
      }

      // Restore inventory: increment quantity_current
      const updatedLot = await tx.inventoryLot.update({
        where: { id: pick.inventory_lot_id },
        data: {
          quantity_current: {
            increment: pick.quantity_picked,
          },
          // If lot was DEPLETED, change status back to AVAILABLE
          status:
            pick.inventory_lot.status === LotStatus.DEPLETED
              ? LotStatus.AVAILABLE
              : pick.inventory_lot.status,
        },
      })

      // Create audit log entry
      await logActivity(
        session.user.id,
        AuditAction.UNPICK,
        EntityType.LOT,
        pick.inventory_lot_id,
        {
          order_id: pick.order_item.order.id,
          order_po_number: pick.order_item.order.po_number,
          quantity_restored: pick.quantity_picked,
          lot_number: pick.inventory_lot.lot_number,
          product_name: pick.inventory_lot.product.name,
          product_sku: pick.inventory_lot.product.sku,
          unit_type: pick.inventory_lot.product.unit_type,
          reason: "User Reverted Pick",
          original_picked_by: pick.picked_by_user.name || pick.picked_by_user.email,
          summary: `Reverted pick of ${pick.quantity_picked} ${pick.inventory_lot.product.unit_type.toLowerCase()} from Lot ${pick.inventory_lot.lot_number} for Order #${pick.order_item.order.po_number || pick.order_item.order.id.slice(0, 8).toUpperCase()}`,
        }
      )

      // Delete the OrderPick record
      await tx.orderPick.delete({
        where: { id: pickId },
      })

      // Check if order status needs to be updated
      // If order was READY_TO_SHIP and we revert a pick, it should go back to PARTIAL_PICK or PICKING
      let orderStatus = pick.order_item.order.status
      if (pick.order_item.order.status === OrderStatus.READY_TO_SHIP) {
        // Get all items for this order to check if still fully picked
        const allOrderItems = await tx.orderItem.findMany({
          where: { order_id: pick.order_item.order.id },
          include: {
            picks: {
              select: {
                quantity_picked: true,
              },
            },
          },
        })

        const allItemsFullyPicked = allOrderItems.every((item) => {
          const totalPicked = item.picks.reduce(
            (sum, p) => sum + p.quantity_picked,
            0
          )
          return totalPicked >= item.quantity_ordered
        })

        if (!allItemsFullyPicked) {
          // Check if any picks exist
          const hasAnyPicks = allOrderItems.some((item) => item.picks.length > 0)
          orderStatus = hasAnyPicks
            ? OrderStatus.PARTIAL_PICK
            : OrderStatus.PICKING

          await tx.order.update({
            where: { id: pick.order_item.order.id },
            data: {
              status: orderStatus,
            },
          })
        }
      }

      return {
        pick,
        lot: updatedLot,
        orderStatus,
      }
    })

    // Revalidate relevant paths
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/inventory")
    if (result.pick.order_item.order.id) {
      revalidatePath(`/dashboard/orders/${result.pick.order_item.order.id}/pick`)
    }

    return {
      success: true,
      lot: result.lot,
      orderStatus: result.orderStatus,
    }
  } catch (error) {
    console.error("Error reverting pick:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to revert pick",
    }
  }
}

