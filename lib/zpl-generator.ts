import type { LotData } from "@/types/lot"
import { getVoicePickCode, formatDateForVoicePick, formatVoicePick } from "@/lib/voice-pick"
import { format } from "date-fns"

/**
 * Escapes special ZPL characters in field data
 * ZPL special characters: ^, ~, \ need to be escaped
 */
function escapeZPL(text: string): string {
  return text
    .replace(/\\/g, "\\\\")  // Escape backslash first
    .replace(/\^/g, "\\^")    // Escape caret
    .replace(/~/g, "\\~")     // Escape tilde
}

/**
 * Pads GTIN to 14 digits with leading zeros
 */
function padGTIN(gtin: string): string {
  // Remove any non-digit characters
  const digits = gtin.replace(/\D/g, "")
  // Pad to 14 digits
  return digits.padStart(14, "0")
}

/**
 * Format date to YYMMDD for GS1-128 barcode
 */
function formatDateYYMMDD(date: Date): string {
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return `${year}${month}${day}`
}

/**
 * Format date to MM/DD/YYYY for human-readable display
 */
function formatDateMMDDYYYY(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}

/**
 * Format date to MM/DD/YY for compact display on labels
 */
function formatDateMMDDYY(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  const year = date.getFullYear().toString().slice(-2)
  return `${month}/${day}/${year}`
}

/**
 * Add days to a date
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

/**
 * Generates ZPL (Zebra Programming Language) label for produce lots
 * Uses GS1-128 composite barcode format
 * Label size: 4x2 inches (812 dots x 406 dots at 203 DPI)
 * 
 * @param lotData - Inventory lot data
 * @returns ZPL string
 */
export function generateProduceLabel(lotData: LotData): string {
  // Company information (can be moved to env vars)
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Fresh Produce Co."
  const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "123 Farm Road, CA 90210"

  // Extract and prepare data
  const lotNumber = lotData.lot_number
  const productName = lotData.product.name
  const gtin = lotData.product.gtin 
    ? padGTIN(lotData.product.gtin) 
    : "00000000000000" // Default if no GTIN provided
  const receivedDate = new Date(lotData.received_date)
  
  // Calculate expiry date (10 days from received date)
  const expiryDate = addDays(receivedDate, 10)
  const expiryDateDisplay = formatDateMMDDYYYY(expiryDate)
  const expiryDateBarcode = formatDateYYMMDD(expiryDate)

  // Escape text for ZPL
  const safeCompanyName = escapeZPL(companyName)
  const safeCompanyAddress = escapeZPL(companyAddress)
  const safeProductName = escapeZPL(productName)
  const safeLotNumber = escapeZPL(lotNumber)

  // Construct GS1-128 barcode data
  // Format: >;>801{gtin}17{expDate}>610{lotNumber}
  // >;    = Start Code C (high density numbers)
  // >8    = FNC1 (indicates GS1-128)
  // 01    = Application Identifier for GTIN
  // {gtin} = 14-digit GTIN
  // 17    = Application Identifier for Expiry Date
  // {expDate} = YYMMDD format
  // >6    = Switch to Subset B (alphanumeric)
  // 10    = Application Identifier for Lot Number
  // {lotNumber} = Lot number
  const barcodeData = `>;>801${gtin}17${expiryDateBarcode}>610${safeLotNumber}`

  // ZPL Commands
  // ^XA = Start of label
  // ^PW = Print Width (812 dots for 4 inches at 203 DPI)
  // ^LL = Label Length (406 dots for 2 inches at 203 DPI)
  // ^FO = Field Origin (x,y coordinates in dots)
  // ^A0N = Font (0 = default, N = normal orientation)
  // ^BCN = Code 128 barcode (N = normal orientation)
  // ^FD = Field Data
  // ^FS = Field Separator
  // ^XZ = End of label

  const zpl = `^XA
^PW812
^LL406

~TA000
~JSN
^LT0
^MNW
^MTT
^PON
^PMN
^LH0,0
^JMA
^PR4,4
~SD15
^JUS
^LRN
^CI0
^XZ

^XA
^MMT
^PW812
^LL406
^LS0

^FO10,10^A0N,30,30^FD${safeCompanyName}^FS
^FO10,45^A0N,20,20^FD${safeCompanyAddress}^FS

^FO500,10^A0N,25,25^FDEXP: ${expiryDateDisplay}^FS

^FO50,80^A0N,22,22^FD${safeProductName}^FS

^FO150,120^BCN,100,N,N,N^FD${barcodeData}^FS

^FO10,350^A0N,28,28^FDLOT: ${safeLotNumber}^FS
^FO500,350^A0N,22,22^FDGTIN: ${gtin}^FS

^XZ`

  return zpl
}

/**
 * Generates a PTI-Compliant Case Label with Voice Pick Check Digits
 * Label size: 4x2 inches (812 dots x 406 dots at 203 DPI)
 * 
 * Layout (PTI Standard):
 * - Zone A: Company name (top header, centered)
 * - Zone B: Product description (large, bold, centered)
 * - Zone C: Left data (GTIN, LOT, PACK date)
 * - Zone D: Right Voice Pick box (split 2+2 digits, inverted)
 * - Zone E: Bottom GS1-128 barcode (full width)
 * 
 * @param lot - Inventory lot data
 * @param product - Product data (must include GTIN)
 * @returns ZPL string
 */
export function generateCaseLabel(
  lot: {
    lot_number: string
    received_date: Date | string
    expiry_date?: Date | string
  },
  product: {
    name: string
    gtin: string
    variety?: string | null
  }
): string {
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Fresh Produce Co."
  
  const lotNumber = lot.lot_number
  const productName = product.name
  const gtin = padGTIN(product.gtin)
  const receivedDate = new Date(lot.received_date)
  const packDateDisplay = formatDateMMDDYY(receivedDate) // MM/DD/YY format
  const packDateBarcode = formatDateYYMMDD(receivedDate) // YYMMDD for barcode

  // Calculate Voice Pick check digit
  const voicePickDateStr = formatDateForVoicePick(receivedDate)
  const voicePickCode = getVoicePickCode(gtin, lotNumber, voicePickDateStr)
  const voicePickTop = voicePickCode.slice(0, 2) // First 2 digits (small)
  const voicePickBottom = voicePickCode.slice(2, 4) // Last 2 digits (HUGE)

  // Escape text for ZPL
  const safeCompanyName = escapeZPL(companyName)
  const safeProductName = escapeZPL(productName)
  const safeLotNumber = escapeZPL(lotNumber)

  // Auto-scale product name if too long
  // Base font: ^A0N,60,60 (height, width)
  // If name > 20 chars, reduce width proportionally
  const productNameLength = productName.length
  let productFontHeight = 60
  let productFontWidth = 60
  
  if (productNameLength > 20) {
    // Scale width down to fit (rough calculation)
    productFontWidth = Math.max(30, Math.floor((60 * 20) / productNameLength))
  }

  // Construct GS1-128 barcode data
  // Format: (01){gtin}(13){packDate}(10){lotNumber}
  // AI 13 = Pack Date (YYMMDD)
  // AI 10 = Lot Number
  const barcodeData = `>;>801${gtin}13${packDateBarcode}>610${safeLotNumber}`

  // ZPL Commands for PTI-Compliant 4x2 Label
  const zpl = `^XA
^PW812
^LL406

~TA000
~JSN
^LT0
^MNW
^MTT
^PON
^PMN
^LH0,0
^JMA
^PR4,4
~SD15
^JUS
^LRN
^CI0
^XZ

^XA
^MMT
^PW812
^LL406
^LS0

^CF0,25
^FO0,5^FB812,1,0,C,0^FD${safeCompanyName}\\&^FS

^CF0,${productFontHeight},${productFontWidth}
^FO0,35^FB812,1,0,C,0^FD${safeProductName}\\&^FS

^CF0,28
^FO20,120^FDGTIN: ${gtin}^FS
^FO20,155^FDLOT: ${safeLotNumber}^FS
^FO20,190^FDPACK: ${packDateDisplay}^FS

^FO550,110^GB230,120,3^FS
^CF0,30
^FO620,120^FR^FD${voicePickTop}^FS
^CF0,70
^FO590,150^FR^FD${voicePickBottom}^FS

^BY2,3,80^FT50,320^BCN,,N,N^FD${barcodeData}^FS

^XZ`

  return zpl
}

/**
 * Generates a Master Pallet Label - Generic "License Plate"
 * Label size: 4x6 inches (812 dots x 1218 dots at 203 DPI)
 * Purpose: Generic pallet identifier - no quantity
 * 
 * @param lot - Inventory lot data
 * @param product - Product data
 * @returns ZPL string
 */
export function generateMasterLabel(
  lot: {
    lot_number: string
    received_date: Date | string
  },
  product: {
    name: string
  }
): string {
  const lotNumber = lot.lot_number
  const productName = product.name
  const receivedDate = new Date(lot.received_date)
  const receivedDateDisplay = formatDateMMDDYYYY(receivedDate)

  // Escape text for ZPL
  const safeProductName = escapeZPL(productName)
  const safeLotNumber = escapeZPL(lotNumber)

  // ZPL Commands for 4x6 label (Master Pallet Tag - Generic)
  const zpl = `^XA
^PW812
^LL1218

~TA000
~JSN
^LT0
^MNW
^MTT
^PON
^PMN
^LH0,0
^JMA
^PR4,4
~SD15
^JUS
^LRN
^CI0
^XZ

^XA
^MMT
^PW812
^LL1218
^LS0

^FO0,30^GB812,80,80^FS
^FO30,50^A0N,50,50^FR^FDMASTER PALLET TAG^FS

^FO50,200^A0N,60,60^FD${safeProductName}^FS

^BY4,3,200^FT50,600^BCN,,N,N^FD${safeLotNumber}^FS

^FO50,950^A0N,45,45^FDLot: ${safeLotNumber}^FS
^FO50,1020^A0N,35,35^FDReceived: ${receivedDateDisplay}^FS

^XZ`

  return zpl
}

/**
 * Generates a PTI-Compliant Voice Pick Label with all required zones
 * Label size: 4x2 inches (812 dots x 406 dots at 203 DPI)
 * 
 * Layout (PTI Standard):
 * - Zone 1: Top GS1-128 barcode with HRI
 * - Zone 2: Product name "billboard" (large, centered, all caps)
 * - Zone 3: Pack date box (middle right)
 * - Zone 4: Footer left (origin, company info, case weight)
 * - Zone 5: Voice Pick code box (bottom right, split digits)
 * 
 * @param lot - Inventory lot data
 * @param product - Product data (must include GTIN)
 * @param companySettings - Company information
 * @param caseWeight - Optional case weight with unit (e.g., "40 LBS")
 * @param origin - Optional origin country
 * @returns ZPL string
 */
export function generatePTILabel(
  lot: {
    lot_number: string
    received_date: Date | string
  },
  product: {
    name: string
    gtin: string
    unit_type?: string
  },
  companySettings: {
    name: string
    address: string
  },
  options?: {
    caseWeight?: number
    unitType?: string
    origin?: string
  }
): string {
  const lotNumber = lot.lot_number
  const productName = product.name.toUpperCase() // PTI standard: all caps
  const gtin = padGTIN(product.gtin)
  const receivedDate = new Date(lot.received_date)
  const packDateBarcode = formatDateYYMMDD(receivedDate) // YYMMDD for barcode
  
  // Format pack date for display (e.g., "Nov 27")
  const packDateDisplay = format(receivedDate, "MMM dd")
  
  // Calculate Voice Pick check digit
  const voicePickDateStr = formatDateForVoicePick(receivedDate)
  const voicePickCode = getVoicePickCode(gtin, lotNumber, voicePickDateStr)
  const { small, large } = formatVoicePick(voicePickCode)

  // Escape text for ZPL
  const safeProductName = escapeZPL(productName)
  const safeLotNumber = escapeZPL(lotNumber)
  const safeCompanyName = escapeZPL(companySettings.name)
  const safeCompanyAddress = escapeZPL(companySettings.address)
  const safeOrigin = escapeZPL(options?.origin || "USA")

  // Auto-scale product name if too long
  let productFontHeight = 55
  let productFontWidth = 55
  
  if (productName.length > 20) {
    productFontHeight = 45
    productFontWidth = 45
  }

  // Construct GS1-128 barcode data with HRI
  // Format: (01){gtin}(10){lot}
  const barcodeData = `>;>801${gtin}>610${safeLotNumber}`
  
  // Human Readable Interpretation for barcode
  const barcodeHRI = `(01) ${gtin} (10) ${safeLotNumber}`

  // Case weight display
  const caseWeightDisplay = options?.caseWeight
    ? `${options.caseWeight} ${options.unitType || "LBS"}`
    : ""

  // ZPL Commands for PTI-Compliant 4x2 Label
  const zpl = `^XA
^PW812
^LL406

~TA000
~JSN
^LT0
^MNW
^MTT
^PON
^PMN
^LH0,0
^JMA
^PR4,4
~SD15
^JUS
^LRN
^CI0
^XZ

^XA
^MMT
^PW812
^LL406
^LS0

^BY2,3,80^FT30,100^BCN,,N,N^FD${barcodeData}^FS
^CF0,16
^FO30,105^FD${barcodeHRI}^FS

^CF0,${productFontHeight},${productFontWidth}
^FO0,140^FB812,1,0,C,0^FD${safeProductName}\\&^FS

^FO600,140^GB180,70,3^FS
^CF0,14
^FO610,145^FDPACK DATE^FS
^CF0,28
^FO620,165^FD${packDateDisplay}^FS

^CF0,20
^FO20,240^FDPack/Weight: ${caseWeightDisplay}^FS
^FO20,265^FDProduct of ${safeOrigin}^FS
^CF0,18
^FO20,295^FD${safeCompanyName}^FS
^CF0,14
^FO20,315^FD${safeCompanyAddress}^FS

^FO600,250^GB180,140,4^FS
^CF0,32
^FO640,260^FR^FD${small}^FS
^CF0,90
^FO615,300^FR^FD${large}^FS

^XZ`

  return zpl
}

/**
 * Legacy function - Alias for generateCaseLabel
 * @deprecated Use generateCaseLabel instead
 */
export function generateGS1Label(
  lot: {
    lot_number: string
    received_date: Date | string
    expiry_date?: Date | string
  },
  product: {
    name: string
    gtin: string | null
    variety?: string | null
  }
): string {
  if (!product.gtin) {
    throw new Error("Product GTIN is required for label generation")
  }
  return generateCaseLabel(lot, { ...product, gtin: product.gtin })
}
