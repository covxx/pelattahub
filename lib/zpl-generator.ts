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

^FO550,110^GB230,120,120^FS
^CF0,30
^FO620,120^FR^FD${voicePickTop}^FS
^CF0,70
^FO590,150^FR^FD${voicePickBottom}^FS

^BY2,3,80^FT50,320^BCN,,N,N^FD${barcodeData}^FS

^XZ`

  return zpl
}

/**
 * Generates a Master Pallet Label - 4x6 inches
 * Label size: 4x6 inches (812 dots x 1218 dots at 203 DPI)
 * Shows: Vendor, Total Amount, Received Date, Product, Lot Number
 * Includes scannable barcode for warehouse operations
 * 
 * @param lot - Inventory lot data (must include receivingEvent with vendor)
 * @param product - Product data (should include GTIN for GS1-128 barcode)
 * @returns ZPL string
 */
export function generateMasterLabel(
  lot: {
    lot_number: string
    received_date: Date | string
    original_quantity?: number
    quantity_current?: number
    receivingEvent?: {
      vendor?: {
        name: string
        code?: string
      }
    }
  },
  product: {
    name: string
    unit_type?: string
    gtin?: string
  }
): string {
  const lotNumber = lot.lot_number
  const productName = product.name
  const receivedDate = new Date(lot.received_date)
  const receivedDateDisplay = formatDateMMDDYYYY(receivedDate)
  
  // Get quantity (prefer original_quantity, fallback to quantity_current)
  const totalQuantity = lot.original_quantity ?? lot.quantity_current ?? 0
  const unitType = product.unit_type || "CASE"
  const quantityDisplay = `${totalQuantity} ${unitType}`
  
  // Get vendor name
  const vendorName = lot.receivingEvent?.vendor?.name || "Unknown Vendor"
  const vendorCode = lot.receivingEvent?.vendor?.code || ""

  // Escape text for ZPL
  const safeProductName = escapeZPL(productName)
  const safeLotNumber = escapeZPL(lotNumber)
  const safeVendorName = escapeZPL(vendorName)
  const safeVendorCode = escapeZPL(vendorCode)
  const safeQuantityDisplay = escapeZPL(quantityDisplay)

  // Generate barcode data
  // If GTIN is available, use GS1-128 format (preferred for warehouse operations)
  // Otherwise, use simple Code 128 with lot number
  let barcodeData: string
  let barcodeHRI: string
  
  if (product.gtin) {
    const gtin = padGTIN(product.gtin)
    // GS1-128 format: (01){gtin}(10){lotNumber}
    barcodeData = `>;>801${gtin}>610${safeLotNumber}`
    barcodeHRI = `(01) ${gtin} (10) ${safeLotNumber}`
  } else {
    // Fallback: Simple Code 128 with lot number only
    barcodeData = safeLotNumber
    barcodeHRI = safeLotNumber
  }

  // ZPL Commands for 4x6 label (Master Pallet Label)
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

^FO0,30^GB812,100,100^FS
^FO30,60^A0N,60,60^FR^FDPALLET LABEL^FS

^CF0,50
^FO50,180^FD${safeProductName}^FS

^CF0,35
^FO50,280^FDVendor: ${safeVendorName}^FS

^CF0,40
^FO50,420^FDTotal: ${safeQuantityDisplay}^FS

^CF0,35
^FO50,500^FDReceived: ${receivedDateDisplay}^FS

^CF0,30
^FO50,600^FDLot Number: ${safeLotNumber}^FS

^BY3,3,100^FO50,700^BCN,120,N,N^FD${barcodeData}^FS
^CF0,20
^FO50,830^FB712,1,0,C,0^FD${barcodeHRI}^FS

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
  // Handle multi-line addresses (split on \n or actual newlines)
  const addressLines = companySettings.address.split(/\n|\\n/).filter(line => line.trim())
  const safeAddressLines = addressLines.map(line => escapeZPL(line.trim()))
  const safeOrigin = escapeZPL(options?.origin || "USA")

  // Auto-scale product name if too long
  let productFontHeight = 38
  let productFontWidth = 38
  
  if (productName.length > 18) {
    productFontHeight = 32
    productFontWidth = 32
  }
  if (productName.length > 25) {
    productFontHeight = 28
    productFontWidth = 28
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

^BY2,3,70^FO50,30^BCN,100,N,N^FD${barcodeData}^FS
^CF0,14
^FO0,140^FB812,1,0,C,0^FD${barcodeHRI}^FS

^CF0,${productFontHeight},${productFontWidth}
^FO0,165^FB812,1,0,C,0^FD${safeProductName}\\&^FS

^CF0,18
^FO20,220^FDProduct of ${safeOrigin}^FS
^FO20,245^FDPack/Weight: ${caseWeightDisplay}^FS
^FO20,270^FD${safeCompanyName}^FS
${safeAddressLines.map((line, index) => `^FO20,${295 + (index * 20)}^FD${line}^FS`).join('\n')}

^FO600,230^GB180,130,130^FS
^CF0,28
^FO640,240^FR^FD${small}^FS
^CF0,80
^FO615,275^FR^FD${large}^FS

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
