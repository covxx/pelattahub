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

    // Create order with items
    const order = await prisma.order.create({
      data: {
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
        summary: `Created order ${order.po_number || order.id.slice(0, 8)} for ${customer.name}`,
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
      "ALLOCATE",
      "ORDER",
      orderId,
      {
        summary: `Allocated order ${order.po_number || order.id.slice(0, 8)} using FIFO`,
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

