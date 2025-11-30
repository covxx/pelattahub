export type UnitType = "CASE" | "LBS" | "EACH"

export interface Product {
  id: string
  sku: string
  name: string
  gtin: string
  default_origin_country: string
  unit_type: UnitType
  standard_case_weight: number | null
  variety: string | null
  description: string | null
  target_temp_f: number | null
  image_url: string | null
  createdAt: Date | string
  updatedAt: Date | string
  _count?: {
    lots: number
  }
}

