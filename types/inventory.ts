import { LotStatus } from "@prisma/client"

export interface InventoryLot {
  id: string
  lot_number: string
  product_id: string
  product: {
    id: string
    sku: string
    name: string
    variety: string | null
    gtin: string | null
    unit_type?: string
    standard_case_weight?: number | null
  }
  quantity_received: number
  quantity_current: number
  received_date: Date | string
  expiry_date: Date | string
  origin_country: string
  grower_id: string | null
  status: LotStatus
  createdAt: Date | string
  updatedAt: Date | string
}

