export interface Product {
  id: string
  sku: string
  name: string
  variety: string | null
  description: string | null
  gtin: string | null
  target_temp_f: number | null
  image_url: string | null
  createdAt: Date | string
  updatedAt: Date | string
  _count?: {
    lots: number
  }
}

