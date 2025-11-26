/**
 * Type definitions for Inventory Lot data
 */

export interface LotData {
  lot_number: string
  product: {
    name: string
    sku: string
    variety?: string | null
    gtin?: string | null
  }
  quantity_received: number
  quantity_current: number
  received_date: Date | string
  expiry_date: Date | string
  origin_country: string
  grower_id?: string | null
  status: string
}

