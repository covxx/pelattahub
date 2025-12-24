"use server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { Prisma } from "@prisma/client"
import { z } from "zod"

type RecallOrderSummary = {
  orderId: string
  orderNumber: string | null
  poNumber: string | null
  customerName: string
  deliveryDate: string
}

type RecallProductionRun = {
  id: string
  direction: "SOURCE" | "DESTINATION"
  quantityConsumed?: number
  quantityProduced?: number
  createdAt: string
  peerLotNumber?: string
  peerProductName?: string
}

type RecallAuditEntry = {
  id: string
  action: string
  createdAt: string
  summary?: string
  user: {
    name: string | null
    email: string
    role: string
  }
}

export type RecallLotSummary = {
  id: string
  lotNumber: string
  productName: string
  productSku: string
  status: string
  quantityCurrent: number
  quantityReceived: number
  receivedDate: string
  expiryDate: string
  vendorName: string | null
  vendorCode: string | null
  receiptNumber: number | null
  originCountry: string
  orders: Array<
    RecallOrderSummary & {
      quantityPicked: number
      unitType: string
    }
  >
  productionRuns: RecallProductionRun[]
}

export type RecallReportResult =
  | {
      mode: "lot"
      lot: RecallLotSummary
      auditTrail: RecallAuditEntry[]
    }
  | {
      mode: "order"
      order: RecallOrderSummary
      lots: RecallLotSummary[]
      auditTrail: RecallAuditEntry[]
    }

const recallInputSchema = z
  .object({
    lotNumber: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
    orderNumber: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v.length > 0 ? v : undefined)),
  })
  .refine((val) => val.lotNumber || val.orderNumber, {
    message: "Provide either lotNumber or orderNumber",
  })

async function requireAdminOrManager() {
  const session = await auth()
  if (!session?.user) {
    throw new Error("Unauthorized")
  }
  const role = session.user.role as string
  if (!["ADMIN", "MANAGER", "SRJLABS"].includes(role)) {
    throw new Error("Admin or Manager access required")
  }
  return session
}

const lotInclude = {
  product: { select: { name: true, sku: true, unit_type: true } },
  receivingEvent: {
    include: {
      vendor: { select: { name: true, code: true } },
    },
  },
  picks: {
    include: {
      order_item: {
        include: {
          order: {
            include: {
              customer: { select: { name: true } },
            },
          },
        },
      },
      inventory_lot: {
        select: {
          product: { select: { unit_type: true } },
        },
      },
    },
  },
  sourceProductionRuns: {
    include: {
      destinationLot: { include: { product: { select: { name: true } } } },
    },
  },
  destinationProductionRuns: {
    include: {
      sourceLot: { include: { product: { select: { name: true } } } },
    },
  },
} satisfies Prisma.InventoryLotInclude

const orderInclude = {
  customer: true,
  items: {
    include: {
      product: true,
      picks: {
        include: {
          order_item: {
            include: {
              order: {
                include: {
                  customer: { select: { name: true } },
                },
              },
            },
          },
          inventory_lot: {
            include: {
              product: { select: { name: true, sku: true, unit_type: true } },
              receivingEvent: {
                include: { vendor: { select: { name: true, code: true } } },
              },
              sourceProductionRuns: {
                include: {
                  destinationLot: { include: { product: { select: { name: true } } } },
                },
              },
              destinationProductionRuns: {
                include: {
                  sourceLot: { include: { product: { select: { name: true } } } },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.OrderInclude

type AuditLogWithUser = Prisma.AuditLogGetPayload<{
  include: { user: { select: { name: true; email: true; role: true } } }
}>

type LotWithRelations = Prisma.InventoryLotGetPayload<{
  include: typeof lotInclude
}>

type OrderWithPicks = Prisma.OrderGetPayload<{
  include: typeof orderInclude
}>

function mapAuditLogs(logs: AuditLogWithUser[]): RecallAuditEntry[] {
  const extractSummary = (details: Prisma.JsonValue | null | undefined): string | undefined => {
    if (!details || typeof details !== "object" || Array.isArray(details)) return undefined
    const maybeSummary = (details as Record<string, unknown>).summary
    return typeof maybeSummary === "string" ? maybeSummary : undefined
  }

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    createdAt: log.createdAt.toISOString(),
    summary: extractSummary(log.details),
    user: {
      name: log.user?.name ?? null,
      email: log.user?.email ?? "unknown",
      role: log.user?.role ?? "UNKNOWN",
    },
  }))
}

function mapLot(lot: LotWithRelations): RecallLotSummary {
  const picks = Array.isArray(lot.picks) ? lot.picks : []

  const orders = picks.map((pick) => {
    const order = pick.order_item?.order
    return {
      orderId: order?.id ?? "unknown",
      orderNumber: order?.order_number ?? null,
      poNumber: order?.po_number ?? null,
      customerName: order?.customer?.name ?? "Unknown Customer",
      deliveryDate: order?.delivery_date ? new Date(order.delivery_date).toISOString() : "",
      quantityPicked: Number(pick.quantity_picked ?? 0),
      unitType: pick.inventory_lot?.product?.unit_type ?? "units",
    }
  })

  const productionRuns: RecallProductionRun[] = []

  const sourceRuns = Array.isArray(lot.sourceProductionRuns) ? lot.sourceProductionRuns : []
  for (const run of sourceRuns) {
    productionRuns.push({
      id: run.id,
      direction: "SOURCE",
      quantityConsumed: Number(run.quantity_consumed ?? 0),
      createdAt: run.created_at.toISOString(),
      peerLotNumber: run.destinationLot?.lot_number,
      peerProductName: run.destinationLot?.product?.name,
    })
  }

  const destRuns = Array.isArray(lot.destinationProductionRuns) ? lot.destinationProductionRuns : []
  for (const run of destRuns) {
    productionRuns.push({
      id: run.id,
      direction: "DESTINATION",
      quantityProduced: Number(run.quantity_produced ?? 0),
      createdAt: run.created_at.toISOString(),
      peerLotNumber: run.sourceLot?.lot_number,
      peerProductName: run.sourceLot?.product?.name,
    })
  }

  return {
    id: lot.id,
    lotNumber: lot.lot_number,
    productName: lot.product?.name ?? "Unknown product",
    productSku: lot.product?.sku ?? "",
    status: lot.status,
    quantityCurrent: lot.quantity_current,
    quantityReceived: lot.quantity_received,
    receivedDate: lot.received_date?.toISOString?.() ?? new Date(lot.received_date).toISOString(),
    expiryDate: lot.expiry_date?.toISOString?.() ?? new Date(lot.expiry_date).toISOString(),
    vendorName: lot.receivingEvent?.vendor?.name ?? null,
    vendorCode: lot.receivingEvent?.vendor?.code ?? null,
    receiptNumber: lot.receivingEvent?.receipt_number ?? null,
    originCountry: lot.origin_country,
    orders,
    productionRuns,
  }
}

export async function generateRecallReport(input: {
  lotNumber?: string
  orderNumber?: string
}): Promise<RecallReportResult | null> {
  await requireAdminOrManager()
  const parsed = recallInputSchema.parse(input)

  if (parsed.lotNumber) {
    const lot = await prisma.inventoryLot.findFirst({
      where: {
        OR: [
          { lot_number: parsed.lotNumber },
          { lot_number: { equals: parsed.lotNumber, mode: "insensitive" } },
          { lot_number: { contains: parsed.lotNumber, mode: "insensitive" } },
          { lot_number: { startsWith: parsed.lotNumber, mode: "insensitive" } },
          { id: parsed.lotNumber },
        ],
      },
      include: lotInclude,
      orderBy: { createdAt: "desc" },
    })

    if (!lot) {
      return null
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: { entity_type: "LOT", entity_id: lot.id },
      include: {
        user: { select: { name: true, email: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    })

    return {
      mode: "lot",
      lot: mapLot(lot),
      auditTrail: mapAuditLogs(auditLogs),
    }
  }

  // Order-driven recall
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { order_number: parsed.orderNumber },
        { po_number: parsed.orderNumber },
        { order_number: { contains: parsed.orderNumber, mode: "insensitive" } },
        { po_number: { contains: parsed.orderNumber, mode: "insensitive" } },
      ],
    },
    include: orderInclude,
  })

  if (!order) {
    return null
  }

  // Flatten lots referenced by picks
  const lots: RecallLotSummary[] = []
  const seenLotIds = new Set<string>()
  for (const item of order.items) {
    for (const pick of item.picks) {
      if (pick.inventory_lot && !seenLotIds.has(pick.inventory_lot.id)) {
        seenLotIds.add(pick.inventory_lot.id)
        lots.push(
          mapLot({
            ...pick.inventory_lot,
            picks: [pick],
          })
        )
      }
    }
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: { entity_type: "ORDER", entity_id: order.id },
    include: { user: { select: { name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  })

  const orderSummary: RecallOrderSummary = {
    orderId: order.id,
    orderNumber: order.order_number,
    poNumber: order.po_number,
    customerName: order.customer?.name ?? "Unknown Customer",
    deliveryDate: order.delivery_date.toISOString(),
  }

  return {
    mode: "order",
    order: orderSummary,
    lots,
    auditTrail: mapAuditLogs(auditLogs),
  }
}


