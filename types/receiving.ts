export interface Vendor {
  id: string
  name: string
  code: string
  active: boolean
  createdAt: Date | string
  updatedAt: Date | string
}

export type ReceivingStatus = "OPEN" | "FINALIZED"

export interface ReceivingEvent {
  id: string
  vendor_id: string
  received_date: Date | string
  status: ReceivingStatus
  finalized_at?: Date | string | null
  notes?: string | null
  created_by: string
  createdAt: Date | string
  updatedAt: Date | string
  vendor?: Vendor
  user?: {
    name?: string | null
    email?: string | null
  }
  lots?: any[]
}

export interface ReceivingEventWithDetails extends ReceivingEvent {
  vendor: Vendor
  user: {
    name: string | null
    email: string | null
  }
  lots: Array<{
    id: string
    lot_number: string
    original_quantity: number
    quantity_current: number
    product: {
      id: string
      sku: string
      name: string
      variety: string | null
      unit_type: string
      gtin: string
    }
  }>
}

