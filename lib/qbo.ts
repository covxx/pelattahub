/**
 * QuickBooks Online Integration Module
 * 
 * Provides functions to interact with QuickBooks Online API.
 * Uses the authenticated OAuth client from qbo-auth.ts
 */

import { getQboClient, getQboConnectionStatus as getQboConnectionStatusFromAuth, QboOAuthClient } from "@/lib/qbo-auth"

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
  PurchaseCost?: number
}

export interface QboVendor {
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

export interface QboInvoice {
  Id: string
  SyncToken: string
  DocNumber?: string
  TxnDate: string
  DueDate?: string
  CustomerRef: {
    value: string
    name: string
  }
  Line: Array<{
    Id?: string
    Amount: number
    DetailType: string
    SalesItemLineDetail?: {
      ItemRef: {
        value: string
        name: string
      }
      Qty: number
      UnitPrice: number
    }
  }>
  TotalAmt: number
  Balance: number
  TxnStatus?: string
}

/**
 * Make API request to QBO
 */
async function makeQboRequest(
  oauthClient: QboOAuthClient,
  endpoint: string,
  method: "GET" | "POST" = "GET",
  body?: any
): Promise<any> {
  const realmId = oauthClient.getRealmId()
  if (!realmId) {
    throw new Error("Realm ID not found. Please reconnect to QuickBooks.")
  }

  // Use the environment-specific base URL
  const environment = process.env.QBO_ENVIRONMENT || "sandbox"
  const baseUrl = environment === "production"
    ? "https://quickbooks.api.intuit.com"
    : "https://sandbox-quickbooks.api.intuit.com"
  
  const url = `${baseUrl}/v3/company/${realmId}/${endpoint}`
  
  const response = await oauthClient.makeApiCall({ url, method, body })
  
  if (response.statusCode !== 200) {
    throw new Error(`QBO API error: ${response.statusCode} - ${response.text}`)
  }

  return response.json()
}

/**
 * Query QBO using QueryService
 */
async function queryQbo(
  oauthClient: QboOAuthClient,
  query: string
): Promise<any[]> {
  const result = await makeQboRequest(oauthClient, `query?query=${encodeURIComponent(query)}`)
  
  // Check for QueryResponse and maxResults property existence (not truthiness)
  // maxResults can be 0 for valid responses with zero results, which is falsy but valid
  if (result.QueryResponse && 'maxResults' in result.QueryResponse) {
    // Handle pagination if needed
    const items = result.QueryResponse[Object.keys(result.QueryResponse).find(k => k !== "maxResults" && k !== "startPosition")!] || []
    return Array.isArray(items) ? items : [items]
  }
  
  return []
}

/**
 * Run an arbitrary QBO query (shared helper)
 */
export async function fetchQboByQuery(query: string): Promise<any[]> {
  const oauthClient = await getQboClient()
  return await queryQbo(oauthClient, query)
}

/**
 * Check if QBO is connected
 * Returns connection status and token expiration info
 */
export async function getQboConnectionStatus(): Promise<{
  connected: boolean
  realmId?: string
  expiresAt?: Date
  companyName?: string
}> {
  return await getQboConnectionStatusFromAuth()
}

/**
 * Fetch all customers from QuickBooks Online
 * 
 * @returns Array of QBO Customer objects
 */
export async function fetchQboCustomers(): Promise<QboCustomer[]> {
  const oauthClient = await getQboClient()
  
  // Query all active customers
  const query = "SELECT * FROM Customer WHERE Active = true MAXRESULTS 1000"
  const customers = await queryQbo(oauthClient, query)
  
  return customers as QboCustomer[]
}

/**
 * Fetch all items/products from QuickBooks Online
 * 
 * @returns Array of QBO Item objects
 */
export async function fetchQboItems(): Promise<QboItem[]> {
  const oauthClient = await getQboClient()
  
  // Query all active items (Inventory, Service, and NonInventory)
  const query = "SELECT * FROM Item WHERE Active = true MAXRESULTS 1000"
  const items = await queryQbo(oauthClient, query)
  
  return items as QboItem[]
}

/**
 * Fetch all vendors from QuickBooks Online
 * 
 * @returns Array of QBO Vendor objects
 */
export async function fetchQboVendors(): Promise<QboVendor[]> {
  const oauthClient = await getQboClient()
  
  // Query all active vendors
  const query = "SELECT * FROM Vendor WHERE Active = true MAXRESULTS 1000"
  const vendors = await queryQbo(oauthClient, query)
  
  return vendors as QboVendor[]
}

/**
 * Fetch open invoices from QuickBooks Online
 * 
 * @returns Array of QBO Invoice objects
 */
export async function fetchQboInvoices(): Promise<QboInvoice[]> {
  const oauthClient = await getQboClient()
  
  // Query open invoices (not fully paid) - avoid '>' parser issues by using inequality
  const query = "SELECT * FROM Invoice WHERE Balance != '0'"
  const invoices = await queryQbo(oauthClient, query)
  
  return invoices as QboInvoice[]
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

  // Generate code from DisplayName (first 3 letters + last 4 of ID)
  const codePrefix = qboCustomer.DisplayName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "A")
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
  const sku = qboItem.Sku || qboItem.Name.replace(/\s+/g, "-").toUpperCase().substring(0, 50)

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
 * Map QBO Vendor to WMS Vendor format
 */
export function mapQboVendorToWms(qboVendor: QboVendor): {
  name: string
  code: string
  qbo_id: string
  qbo_sync_token: string
  active: boolean
} {
  // Generate code from DisplayName (first 3 letters + last 4 of ID)
  const codePrefix = qboVendor.DisplayName.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "V")
  const code = `${codePrefix}${qboVendor.Id.slice(-4)}`

  return {
    name: qboVendor.DisplayName,
    code,
    qbo_id: qboVendor.Id,
    qbo_sync_token: qboVendor.SyncToken,
    active: qboVendor.Active,
  }
}

// Re-export getQboAuthUrl from qbo-auth for convenience
export { getQboAuthUrl } from "@/lib/qbo-auth"
