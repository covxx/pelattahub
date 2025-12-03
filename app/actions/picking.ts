"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { unstable_noStore as noStore } from "next/cache"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"
import { OrderStatus, LotStatus } from "@prisma/client"

/**
 * Get orders ready for picking (CONFIRMED, PICKING, PARTIAL_PICK, READY_TO_SHIP)
 */
export async function getOrdersForPicking() {
  noStore() // Ensure fresh data

  const session = await auth()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  // Only ADMIN and PACKER can view picking queue
  if (session.user.role !== "ADMIN" && session.user.role !== "PACKER") {
    throw new Error("Insufficient permissions")
  }

  const orders = await prisma.order.findMany({
    where: {
      status: {
        in: [
          OrderStatus.CONFIRMED,
          OrderStatus.PICKING,
          OrderStatus.PARTIAL_PICK,
          OrderStatus.READY_TO_SHIP,
        ],
      },
    },
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
          picks: {
            select: {
              quantity_picked: true,
            },
          },
        },
      },
    },
    orderBy: {
      delivery_date: "asc", // Oldest delivery date first
    },
  })

  // Calculate picking progress for each order
  const ordersWithProgress = orders.map((order) => {
    const totalOrdered = order.items.reduce(
      (sum, item) => sum + item.quantity_ordered,
      0
    )
    const totalPicked = order.items.reduce((sum, item) => {
      const itemPicked = item.picks.reduce(
        (pickSum, pick) => pickSum + pick.quantity_picked,
        0
      )
      return sum + itemPicked
    }, 0)
    const progressPercentage =
      totalOrdered > 0 ? (totalPicked / totalOrdered) * 100 : 0

    return {
      ...order,
      totalOrdered,
      totalPicked,
      progressPercentage,
    }
  })

  return ordersWithProgress
}

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
      order.status !== OrderStatus.PARTIAL_PICK &&
      order.status !== OrderStatus.READY_TO_SHIP
    ) {
      throw new Error(
        `Order is in ${order.status} status. Only CONFIRMED, PICKING, PARTIAL_PICK, or READY_TO_SHIP orders can be picked.`
      )
    }

    // For each item, fetch available inventory lots and calculate remaining quantity
    const itemsWithAvailableLots = await Promise.all(
      order.items.map(async (item) => {
        // Get allocations for this order item to find which lots are already allocated
        const allocations = await prisma.orderAllocation.findMany({
          where: {
            order_item_id: item.id,
          },
          select: {
            inventory_lot_id: true,
          },
        })
        const allocatedLotIds = allocations.map((a) => a.inventory_lot_id)

        // Get lots that are either:
        // 1. Available/Received/QC_Pending (matching allocation logic), OR
        // 2. Already allocated to this order item (regardless of status)
        const availableLots = await prisma.inventoryLot.findMany({
          where: {
            product_id: item.product_id,
            OR: [
              {
                status: {
                  in: [LotStatus.AVAILABLE, LotStatus.RECEIVED, LotStatus.QC_PENDING],
                },
              },
              {
                id: {
                  in: allocatedLotIds,
                },
              },
            ],
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
            const totalPickedFromLot = activePicks.reduce(
              (sum, pick) => sum + pick.quantity_picked,
              0
            )

            // Calculate remaining quantity
            const remainingQty = lot.quantity_current - totalPickedFromLot

            return {
              ...lot,
              remaining_qty: Math.max(0, remainingQty), // Ensure non-negative
            }
          })
        )

        // Calculate how much has already been picked for this item
        const totalPickedForItem = item.picks.reduce(
          (sum, pick) => sum + pick.quantity_picked,
          0
        )
        const remainingToPick = item.quantity_ordered - totalPickedForItem

        return {
          ...item,
          availableLots: lotsWithRemainingQty,
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
    console.error("Error fetching order for picking:", error)
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
              customer: {
                select: {
                  name: true,
                },
              },
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
        orderItem.order.status !== OrderStatus.PARTIAL_PICK &&
        orderItem.order.status !== OrderStatus.READY_TO_SHIP
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

      // Check if this lot is allocated to this order item
      const isAllocated = await tx.orderAllocation.findUnique({
        where: {
          order_item_id_inventory_lot_id: {
            order_item_id: orderItemId,
            inventory_lot_id: lotId,
          },
        },
      })

      // Verify lot is available for picking:
      // - Must be AVAILABLE, RECEIVED, or QC_PENDING (matching allocation logic), OR
      // - Must be already allocated to this order item (regardless of status)
      const allowedStatuses: LotStatus[] = [
        LotStatus.AVAILABLE,
        LotStatus.RECEIVED,
        LotStatus.QC_PENDING,
      ]
      if (!isAllocated && !allowedStatuses.includes(lot.status as LotStatus)) {
        throw new Error(
          `Lot ${lot.lot_number} is not available for picking. Status: ${lot.status}`
        )
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

      // Get all active picks for this lot (from non-shipped orders)
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
      })

      // Decrement lot quantity
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

      // Update order status based on picking progress
      let orderStatus: OrderStatus = orderItem.order.status
      
      if (allItemsFullyPicked) {
        // All items fully picked → READY_TO_SHIP
        orderStatus = OrderStatus.READY_TO_SHIP
        await tx.order.update({
          where: { id: orderItem.order.id },
          data: {
            status: OrderStatus.READY_TO_SHIP,
          },
        })
      } else {
        // Not all items fully picked - determine appropriate status
        const hasAnyPicks = allOrderItems.some(
          (item) => item.picks.length > 0
        )
        
        // Check if any items are partially picked (some picked but not fully)
        const hasPartiallyPickedItems = allOrderItems.some((item) => {
          const totalPicked = item.picks.reduce(
            (sum, pick) => sum + pick.quantity_picked,
            0
          )
          return totalPicked > 0 && totalPicked < item.quantity_ordered
        })
        
        if (orderItem.order.status === OrderStatus.CONFIRMED) {
          // First pick on a CONFIRMED order → PICKING
          orderStatus = OrderStatus.PICKING
          await tx.order.update({
            where: { id: orderItem.order.id },
            data: {
              status: OrderStatus.PICKING,
            },
          })
        } else if (
          orderItem.order.status === OrderStatus.PICKING &&
          hasPartiallyPickedItems
        ) {
          // Order is PICKING and has partially picked items → PARTIAL_PICK
          orderStatus = OrderStatus.PARTIAL_PICK
          await tx.order.update({
            where: { id: orderItem.order.id },
            data: {
              status: OrderStatus.PARTIAL_PICK,
            },
          })
        }
        // If already PARTIAL_PICK, keep it as PARTIAL_PICK (no change needed)
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
                name: true,
              },
            },
          },
        },
        product: {
          select: {
            name: true,
            unit_type: true,
          },
        },
      },
    })

    if (orderItem) {
      const customerName = orderItem.order.customer.name || "Unknown"
      const poNumber = orderItem.order.po_number || null

      await logActivity(
        session.user.id,
        AuditAction.PICK,
        EntityType.LOT,
        result.lot.id,
        {
          summary: `Picked ${quantity} ${orderItem.product.unit_type?.toLowerCase() || "units"} of ${orderItem.product.name} from lot ${result.lot.lot_number} for order ${orderItem.order.po_number || orderItem.order.id.slice(0, 8)}`,
          product_name: orderItem.product.name,
          lot_number: result.lot.lot_number,
          quantity: quantity,
          unit_type: orderItem.product.unit_type,
          customer_name: customerName,
          po_number: poNumber,
          order_id: orderItem.order.id,
        }
      )
    }

    revalidatePath(`/dashboard/orders/${orderItem?.order.id}/pick`)
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/picking")

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
 * Revert a pick (unpick)
 * Restores inventory and removes the pick record
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
    const result = await prisma.$transaction(async (tx) => {
      // Get the pick with related data
      const pick = await tx.orderPick.findUnique({
        where: { id: pickId },
        include: {
          order_item: {
            include: {
              order: {
                select: {
                  id: true,
                  status: true,
                  po_number: true,
                  customer: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
              product: {
                select: {
                  name: true,
                  unit_type: true,
                },
              },
            },
          },
          inventory_lot: {
            select: {
              id: true,
              lot_number: true,
              quantity_current: true,
              status: true,
            },
          },
        },
      })

      if (!pick) {
        throw new Error("Pick not found")
      }

      // Check if order is still pickable (not shipped)
      if (pick.order_item.order.status === OrderStatus.SHIPPED) {
        throw new Error("Cannot revert pick from a shipped order")
      }

      // Restore inventory
      const updatedLot = await tx.inventoryLot.update({
        where: { id: pick.inventory_lot_id },
        data: {
          quantity_current: {
            increment: pick.quantity_picked,
          },
        },
      })

      // If lot was DEPLETED, change status back to AVAILABLE
      if (pick.inventory_lot.status === LotStatus.DEPLETED) {
        await tx.inventoryLot.update({
          where: { id: pick.inventory_lot_id },
          data: {
            status: LotStatus.AVAILABLE,
          },
        })
      }

      // Delete the pick record
      await tx.orderPick.delete({
        where: { id: pickId },
      })

      // Check if order needs status update
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
          (sum, pick) => sum + pick.quantity_picked,
          0
        )
        return totalPicked >= item.quantity_ordered
      })

      const hasAnyPicks = allOrderItems.some((item) => item.picks.length > 0)

      // Update order status if needed
      let orderStatus = pick.order_item.order.status
      if (!allItemsFullyPicked && pick.order_item.order.status === OrderStatus.READY_TO_SHIP) {
        // If order was READY_TO_SHIP but no longer fully picked, revert to PARTIAL_PICK or PICKING
        if (hasAnyPicks) {
          orderStatus = OrderStatus.PARTIAL_PICK
        } else {
          orderStatus = OrderStatus.PICKING
        }
        await tx.order.update({
          where: { id: pick.order_item.order.id },
          data: {
            status: orderStatus,
          },
        })
      } else if (!hasAnyPicks && pick.order_item.order.status !== OrderStatus.CONFIRMED) {
        // If no picks remain, revert to CONFIRMED
        orderStatus = OrderStatus.CONFIRMED
        await tx.order.update({
          where: { id: pick.order_item.order.id },
          data: {
            status: OrderStatus.CONFIRMED,
          },
        })
      }

      return {
        lot: updatedLot,
        orderStatus,
      }
    })

    // Log the unpick activity
    const pick = await prisma.orderPick.findUnique({
      where: { id: pickId },
      include: {
        order_item: {
          include: {
            order: {
              include: {
                customer: {
                  select: {
                    name: true,
                  },
                },
              },
            },
            product: {
              select: {
                name: true,
                unit_type: true,
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

    if (pick) {
      const customerName = pick.order_item.order.customer.name || "Unknown"
      const poNumber = pick.order_item.order.po_number || null

      await logActivity(
        session.user.id,
        AuditAction.UNPICK,
        EntityType.LOT,
        pick.inventory_lot_id,
        {
          summary: `Reverted pick of ${pick.quantity_picked} ${pick.order_item.product.unit_type?.toLowerCase() || "units"} of ${pick.order_item.product.name} from lot ${pick.inventory_lot.lot_number} for order ${pick.order_item.order.po_number || pick.order_item.order.id.slice(0, 8)}`,
          product_name: pick.order_item.product.name,
          lot_number: pick.inventory_lot.lot_number,
          quantity: pick.quantity_picked,
          unit_type: pick.order_item.product.unit_type,
          customer_name: customerName,
          po_number: poNumber,
          order_id: pick.order_item.order.id,
        }
      )
    }

    revalidatePath(`/dashboard/orders/${pick?.order_item.order.id}/pick`)
    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/picking")

    return {
      success: true,
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

/**
 * Finalize order (mark as shipped)
 * Only works for orders in READY_TO_SHIP status
 */
export async function finalizeOrder(orderId: string) {
  const session = await auth()

  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  // Only ADMIN and PACKER can finalize orders
  if (session.user.role !== "ADMIN" && session.user.role !== "PACKER") {
    return { success: false, error: "Insufficient permissions" }
  }

  try {
    // Get the order with items and picks
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
              },
            },
            picks: {
              select: {
                quantity_picked: true,
              },
            },
          },
        },
      },
    })

    if (!order) {
      return { success: false, error: "Order not found" }
    }

    // Verify order is in READY_TO_SHIP status
    if (order.status !== OrderStatus.READY_TO_SHIP) {
      return {
        success: false,
        error: `Order must be READY_TO_SHIP to finalize. Current status: ${order.status}`,
      }
    }

    // Verify all items are fully picked
    const allItemsFullyPicked = order.items.every((item) => {
      const totalPicked = item.picks.reduce(
        (sum, pick) => sum + pick.quantity_picked,
        0
      )
      return totalPicked >= item.quantity_ordered
    })

    if (!allItemsFullyPicked) {
      return {
        success: false,
        error: "Not all items are fully picked. Cannot finalize order.",
      }
    }

    // Update order status to SHIPPED
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: OrderStatus.SHIPPED,
      },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
      },
    })

    // Log the finalization
    await logActivity(
      session.user.id,
      AuditAction.SHIP,
      EntityType.ORDER,
      orderId,
      {
        summary: `Finalized and shipped order ${order.po_number || order.id.slice(0, 8)} for ${updatedOrder.customer.name}`,
        customer_name: updatedOrder.customer.name,
        po_number: order.po_number,
        order_id: orderId,
      }
    )

    revalidatePath("/dashboard/orders")
    revalidatePath("/dashboard/picking")
    revalidatePath(`/dashboard/orders/${orderId}/pick`)

    return {
      success: true,
      order: updatedOrder,
    }
  } catch (error) {
    console.error("Error finalizing order:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to finalize order",
    }
  }
}
