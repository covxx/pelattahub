"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { logActivity, AuditAction, EntityType } from "@/lib/logger"
import { OrderStatus, LotStatus } from "@prisma/client"

interface CreateOrderInput {
  customerId: string
  poNumber?: string
  deliveryDate: Date
  items: Array<{
    productId: string
    quantity: number
  }>
}

/**
 * NOTE: generateOrderNumber() function removed - using UUID instead
 * Order identification now uses order.id (UUID) instead of order_number
 */

/**
 * Create a new order in DRAFT status
 */
export async function createOrder(input: CreateOrderInput) {
  const session = await auth()

  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  // Only ADMIN can create orders
  if (session.user.role !== "ADMIN") {
    return { success: false, error: "Admin access required" }
  }

  try {
    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
    })

    if (!customer) {
      return { success: false, error: "Customer not found" }
    }

    // Verify all products exist
    const productIds = input.items.map((item) => item.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    })

    if (products.length !== productIds.length) {
      return { success: false, error: "One or more products not found" }
    }

    // Create order with items (using UUID for now)
    const order = await prisma.order.create({
      data: {
        // order_number: temporarily disabled, using UUID id instead
        customer_id: input.customerId,
        po_number: input.poNumber || null,
        delivery_date: input.deliveryDate,
        status: OrderStatus.DRAFT,
        created_by: session.user.id,
        items: {
          create: input.items.map((item) => ({
            product_id: item.productId,
            quantity_ordered: item.quantity,
          })),
        },
      },
      include: {
        customer: true,
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
          },
        },
      },
    })

    // Log activity
    await logActivity(
      session.user.id,
      AuditAction.CREATE,
      EntityType.ORDER,
      order.id,
      {
        summary: `Created order ${order.id} for ${customer.name}`,
        customer_name: customer.name,
        item_count: input.items.length,
      }
    )

    revalidatePath("/dashboard/orders")
    return { success: true, order }
  } catch (error) {
    console.error("Error creating order:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create order",
    }
  }
}

/**
 * Allocate order using FIFO algorithm
 * Finds available lots sorted by expiry date (oldest first)
 * Creates OrderAllocation records and updates order status to CONFIRMED
 */
export async function allocateOrder(orderId: string) {
  const session = await auth()

  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  // Only ADMIN can allocate orders
  if (session.user.role !== "ADMIN") {
    return { success: false, error: "Admin access required" }
  }

  try {
    // Get the order with items
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
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
            allocations: true,
          },
        },
        customer: true,
      },
    })

    if (!order) {
      return { success: false, error: "Order not found" }
    }

    if (order.status !== OrderStatus.DRAFT) {
      return {
        success: false,
        error: `Order is already ${order.status}. Only DRAFT orders can be allocated.`,
      }
    }

    // Check if already allocated
    const hasAllocations = order.items.some(
      (item) => item.allocations.length > 0
    )
    if (hasAllocations) {
      return {
        success: false,
        error: "Order already has allocations. Please clear allocations first.",
      }
    }

    // Use transaction to ensure all-or-nothing allocation
    const result = await prisma.$transaction(async (tx) => {
      const allocationResults = []

      // Loop through each order item
      for (const item of order.items) {
        let remainingQuantity = item.quantity_ordered

        // Find available lots for this product, sorted by expiry date (FIFO)
        const availableLots = await tx.inventoryLot.findMany({
          where: {
            product_id: item.product_id,
            status: {
              in: [LotStatus.AVAILABLE, LotStatus.RECEIVED, LotStatus.QC_PENDING],
            },
            quantity_current: {
              gt: 0, // Only lots with available quantity
            },
          },
          orderBy: {
            expiry_date: "asc", // FIFO: oldest expiry first
          },
        })

        if (availableLots.length === 0) {
          throw new Error(
            `No available inventory for product ${item.product.name} (${item.product.sku})`
          )
        }

        // Allocate from lots using FIFO
        for (const lot of availableLots) {
          if (remainingQuantity <= 0) break

          // Calculate how much to allocate from this lot
          const availableInLot = lot.quantity_current
          const quantityToAllocate = Math.min(remainingQuantity, availableInLot)

          // Create allocation record
          await tx.orderAllocation.create({
            data: {
              order_item_id: item.id,
              inventory_lot_id: lot.id,
              quantity_allocated: quantityToAllocate,
            },
          })

          allocationResults.push({
            lot_number: lot.lot_number,
            quantity: quantityToAllocate,
            product: item.product.name,
          })

          remainingQuantity -= quantityToAllocate
        }

        // Check if we couldn't fulfill the full quantity
        if (remainingQuantity > 0) {
          throw new Error(
            `Insufficient inventory for ${item.product.name} (${item.product.sku}). ` +
              `Requested: ${item.quantity_ordered}, Available: ${item.quantity_ordered - remainingQuantity}`
          )
        }
      }

      // Update order status to CONFIRMED
      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.CONFIRMED,
        },
        include: {
          customer: true,
          items: {
            include: {
              product: true,
              allocations: {
                include: {
                  inventory_lot: {
                    select: {
                      lot_number: true,
                      expiry_date: true,
                    },
                  },
                },
              },
            },
          },
        },
      })

      return { order: updatedOrder, allocations: allocationResults }
    })

    // Log activity
    await logActivity(
      session.user.id,
      AuditAction.ALLOCATE,
      EntityType.ORDER,
      orderId,
      {
        summary: `Allocated order ${order.id} using FIFO`,
        customer_name: order.customer.name,
        allocation_count: result.allocations.length,
      }
    )

    revalidatePath("/dashboard/orders")
    return { success: true, ...result }
  } catch (error) {
    console.error("Error allocating order:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to allocate order",
    }
  }
}

/**
 * Get all orders with filters
 */
export async function getOrders(filters?: {
  status?: OrderStatus
  customerId?: string
  startDate?: Date
  endDate?: Date
}) {
  const session = await auth()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  const where: any = {}

  if (filters?.status) {
    where.status = filters.status
  }

  if (filters?.customerId) {
    where.customer_id = filters.customerId
  }

  if (filters?.startDate || filters?.endDate) {
    where.delivery_date = {}
    if (filters.startDate) where.delivery_date.gte = filters.startDate
    if (filters.endDate) where.delivery_date.lte = filters.endDate
  }

  const orders = await prisma.order.findMany({
    where,
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
            include: {
              inventory_lot: {
                select: {
                  lot_number: true,
                },
              },
              picked_by_user: {
                select: {
                  name: true,
                  email: true,
                },
              },
            },
          },
          allocations: {
            include: {
              inventory_lot: {
                select: {
                  lot_number: true,
                  expiry_date: true,
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
    orderBy: {
      createdAt: "desc",
    },
  })

  return orders
}

/**
 * Update an existing order
 * Only allows editing DRAFT orders
 */
export async function updateOrder(
  orderId: string,
  data: {
    customerId?: string
    poNumber?: string
    deliveryDate?: Date
    items?: Array<{
      productId: string
      quantity: number
    }>
  }
) {
  const session = await auth()

  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  // Only ADMIN can update orders
  if (session.user.role !== "ADMIN") {
    return { success: false, error: "Admin access required" }
  }

  try {
    // Get existing order
    const existingOrder = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: true,
      },
    })

    if (!existingOrder) {
      return { success: false, error: "Order not found" }
    }

    // Only allow editing DRAFT orders
    if (existingOrder.status !== OrderStatus.DRAFT) {
      return {
        success: false,
        error: `Cannot edit order in ${existingOrder.status} status. Only DRAFT orders can be edited.`,
      }
    }

    // Verify customer if being updated
    if (data.customerId) {
      const customer = await prisma.customer.findUnique({
        where: { id: data.customerId },
      })
      if (!customer) {
        return { success: false, error: "Customer not found" }
      }
    }

    // Verify products if items are being updated
    if (data.items) {
      const productIds = data.items.map((item) => item.productId)
      const products = await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true },
      })
      if (products.length !== productIds.length) {
        return { success: false, error: "One or more products not found" }
      }
    }

    // Update order and items in a transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order fields
      const order = await tx.order.update({
        where: { id: orderId },
        data: {
          ...(data.customerId && { customer_id: data.customerId }),
          ...(data.poNumber !== undefined && { po_number: data.poNumber || null }),
          ...(data.deliveryDate && { delivery_date: data.deliveryDate }),
        },
        include: {
          customer: true,
          items: true,
        },
      })

      // Update items if provided
      if (data.items) {
        // Delete existing items
        await tx.orderItem.deleteMany({
          where: { order_id: orderId },
        })

        // Create new items
        await tx.orderItem.createMany({
          data: data.items.map((item) => ({
            order_id: orderId,
            product_id: item.productId,
            quantity_ordered: item.quantity,
          })),
        })
      }

      // Fetch updated order with items
      return await tx.order.findUnique({
        where: { id: orderId },
        include: {
          customer: true,
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
            },
          },
        },
      })
    })

    if (!updatedOrder) {
      return { success: false, error: "Failed to update order" }
    }

    // Log activity
    await logActivity(
      session.user.id,
      AuditAction.UPDATE,
      EntityType.ORDER,
      orderId,
      {
        summary: `Updated order ${updatedOrder.id}`,
        customer_name: updatedOrder.customer.name,
        changes: {
          customer: data.customerId ? "updated" : undefined,
          po_number: data.poNumber !== undefined ? "updated" : undefined,
          delivery_date: data.deliveryDate ? "updated" : undefined,
          items: data.items ? "updated" : undefined,
        },
      }
    )

    revalidatePath("/dashboard/orders")
    revalidatePath(`/dashboard/orders/${orderId}/edit`)
    return { success: true, order: updatedOrder }
  } catch (error) {
    console.error("Error updating order:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update order",
    }
  }
}

/**
 * Get a single order by ID
 */
export async function getOrderById(orderId: string) {
  const session = await auth()

  if (!session?.user) {
    throw new Error("Unauthorized")
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
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
            include: {
              inventory_lot: {
                select: {
                  lot_number: true,
                },
              },
              picked_by_user: {
                select: {
                  name: true,
                  email: true,
                },
              },
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

  return order
}

/**
 * Unship an order - revert from SHIPPED back to READY_TO_SHIP
 * Restores inventory quantities and deletes pick records
 */
export async function unshipOrder(orderId: string) {
  const session = await auth()

  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  // Only ADMIN can unship orders
  if (session.user.role !== "ADMIN") {
    return { success: false, error: "Admin access required" }
  }

  try {
    // Get the order with items and picks
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: {
          select: {
            name: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                name: true,
                sku: true,
                unit_type: true,
              },
            },
            picks: {
              include: {
                inventory_lot: {
                  select: {
                    id: true,
                    lot_number: true,
                    quantity_current: true,
                  },
                },
              },
            },
          },
        },
      },
    })

    if (!order) {
      return { success: false, error: "Order not found" }
    }

    if (order.status !== OrderStatus.SHIPPED) {
      return {
        success: false,
        error: `Order must be SHIPPED to unship. Current status: ${order.status}`,
      }
    }

    // Use transaction to ensure all-or-nothing
    await prisma.$transaction(async (tx) => {
      // Restore inventory quantities for all picked lots
      for (const item of order.items) {
        for (const pick of item.picks) {
          // Increment the lot's current quantity
          await tx.inventoryLot.update({
            where: { id: pick.inventory_lot_id },
            data: {
              quantity_current: {
                increment: pick.quantity_picked,
              },
            },
          })

          // Log the inventory restoration
          await logActivity(
            session.user.id,
            AuditAction.UPDATE,
            EntityType.LOT,
            pick.inventory_lot_id,
            {
              summary: `Restored ${pick.quantity_picked} ${item.product.unit_type.toLowerCase()} to Lot ${pick.inventory_lot.lot_number} from unshipped order`,
              lot_number: pick.inventory_lot.lot_number,
              product_name: item.product.name,
              product_sku: item.product.sku,
              quantity_restored: pick.quantity_picked,
              order_id: orderId,
              order_po_number: order.po_number,
            }
          )
        }
      }

      // Delete all pick records
      await tx.orderPick.deleteMany({
        where: {
          order_item: {
            order_id: orderId,
          },
        },
      })

      // Update order status back to READY_TO_SHIP
      await tx.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.READY_TO_SHIP,
        },
      })
    })

    // Log the unship activity
    await logActivity(
      session.user.id,
      AuditAction.UPDATE,
      EntityType.ORDER,
      orderId,
      {
        summary: `Unshipped order ${order.id} - restored inventory and reverted to READY_TO_SHIP`,
        customer_name: order.customer.name,
        po_number: order.po_number,
        item_count: order.items.length,
        picks_restored: order.items.reduce(
          (sum, item) => sum + item.picks.length,
          0
        ),
      }
    )

    revalidatePath("/dashboard/orders")
    revalidatePath(`/dashboard/orders/${orderId}/pick`)
    return { success: true }
  } catch (error) {
    console.error("Error unshipping order:", error)
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to unship order",
    }
  }
}

/**
 * Finalize and ship an order
 * NOTE: This function has been moved to app/actions/picking.ts to avoid naming conflicts.
 * Use finalizeOrder from picking.ts instead.
 * 
 * @deprecated Use finalizeOrder from @/app/actions/picking instead
 */

