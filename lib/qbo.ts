/**
 * QuickBooks Online Integration Module
 * 
 * This module provides functions to interact with QuickBooks Online API.
 * Currently contains placeholder/stub functions for the sync structure.
 */

// QBO API Types
export interface QboCustomer {
  Id: string
  SyncToken: string
  DisplayName: string
  CompanyName?: string
  PrimaryEmailAddr?: {
    Address: string
  }
  BillAddr?: {
    Line1?: string
    City?: string
    State?: string
    PostalCode?: string
    Country?: string
  }
  Active: boolean
}

export interface QboItem {
  Id: string
  SyncToken: string
  Name: string
  Sku?: string
  Description?: string
  Type: "Inventory" | "Service" | "NonInventory"
  Active: boolean
  UnitPrice?: number
  QtyOnHand?: number
  TrackQtyOnHand?: boolean
}

export interface QboConnectionStatus {
  connected: boolean
  realmId?: string
  expiresAt?: Date
}

/**
 * Check if QBO is connected
 * Returns connection status and token expiration info
 */
export async function getQboConnectionStatus(): Promise<QboConnectionStatus> {
  // TODO: Implement - Check IntegrationSettings for "quickbooks_online"
  // Return connection status based on token presence and expiration
  return {
    connected: false,
  }
}

/**
 * Fetch customers from QuickBooks Online
 * 
 * @returns Array of QBO Customer objects
 */
export async function fetchQboCustomers(): Promise<QboCustomer[]> {
  // TODO: Implement OAuth flow and API call
  // 1. Get access token from IntegrationSettings
  // 2. Refresh token if expired
  // 3. Make GET request to QBO API: /v3/company/{realmId}/query?query=SELECT * FROM Customer
  // 4. Parse and return Customer array
  
  // Placeholder return
  return []
}

/**
 * Fetch items/products from QuickBooks Online
 * 
 * @returns Array of QBO Item objects
 */
export async function fetchQboItems(): Promise<QboItem[]> {
  // TODO: Implement OAuth flow and API call
  // 1. Get access token from IntegrationSettings
  // 2. Refresh token if expired
  // 3. Make GET request to QBO API: /v3/company/{realmId}/query?query=SELECT * FROM Item
  // 4. Parse and return Item array
  
  // Placeholder return
  return []
}

/**
 * Map QBO Customer to WMS Customer format
 */
export function mapQboCustomerToWms(qboCustomer: QboCustomer): {
  name: string
  code: string
  address?: string
  contact_email?: string
  qbo_id: string
  qbo_sync_token: string
  active: boolean
} {
  // Build address string from BillAddr
  let address: string | undefined
  if (qboCustomer.BillAddr) {
    const addr = qboCustomer.BillAddr
    const parts = [
      addr.Line1,
      addr.City,
      addr.State,
      addr.PostalCode,
      addr.Country,
    ].filter(Boolean)
    address = parts.length > 0 ? parts.join(", ") : undefined
  }

  // Generate code from DisplayName (first 3 letters + number)
  const codePrefix = qboCustomer.DisplayName.substring(0, 3).toUpperCase()
  const code = `${codePrefix}${qboCustomer.Id.slice(-4)}`

  return {
    name: qboCustomer.DisplayName,
    code,
    address,
    contact_email: qboCustomer.PrimaryEmailAddr?.Address,
    qbo_id: qboCustomer.Id,
    qbo_sync_token: qboCustomer.SyncToken,
    active: qboCustomer.Active,
  }
}

/**
 * Map QBO Item to WMS Product format
 */
export function mapQboItemToWms(qboItem: QboItem): {
  name: string
  sku: string
  gtin: string
  description?: string
  qbo_id: string
  qbo_sync_token: string
} {
  // Use SKU from QBO, or generate from Name if missing
  const sku = qboItem.Sku || qboItem.Name.replace(/\s+/g, "-").toUpperCase()

  // Generate GTIN from SKU (placeholder - in production, this should come from QBO or be mapped)
  // For now, pad SKU to 14 digits for GTIN format
  const gtin = sku.padEnd(14, "0").substring(0, 14)

  return {
    name: qboItem.Name,
    sku,
    gtin,
    description: qboItem.Description,
    qbo_id: qboItem.Id,
    qbo_sync_token: qboItem.SyncToken,
  }
}

/**
 * Get OAuth authorization URL for QuickBooks Online
 * This is a placeholder - full OAuth implementation will be added later
 */
export function getQboAuthUrl(): string {
  // TODO: Implement OAuth 2.0 authorization URL generation
  // This will redirect to Intuit's OAuth consent page
  return "#"
}


