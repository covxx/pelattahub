import type { LotData } from "@/types/lot"

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

^FO150,120^BCN,100,Y,N,N^FD${barcodeData}^FS

^FO10,350^A0N,28,28^FDLOT: ${safeLotNumber}^FS
^FO500,350^A0N,22,22^FDGTIN: ${gtin}^FS

^XZ`

  return zpl
}

/**
 * Generates a GS1-128 label for produce lots
 * This is an alias/wrapper for generateProduceLabel with a more descriptive name
 * Label size: 4x2 inches (812 dots x 406 dots at 203 DPI)
 * 
 * @param lot - Inventory lot data
 * @param product - Product data (must include GTIN)
 * @returns ZPL string
 */
export function generateGS1Label(
  lot: {
    lot_number: string
    received_date: Date | string
  },
  product: {
    name: string
    gtin: string | null
    variety?: string | null
  }
): string {
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Fresh Produce Co."
  const companyAddress = process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "123 Farm Road, CA 90210"

  const lotNumber = lot.lot_number
  const productName = product.name
  const gtin = product.gtin 
    ? padGTIN(product.gtin) 
    : "00000000000000" // Default if no GTIN provided
  const receivedDate = new Date(lot.received_date)

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

  // ZPL Commands for 4x2 label
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

^FO30,40^A0N,30,30^FD${safeCompanyName}^FS
^FO30,75^A0N,20,20^FD${safeCompanyAddress}^FS

^FO400,10^A0N,25,25^FDEXP: ${expiryDateDisplay}^FS

^FO50,110^A0N,22,22^FD${safeProductName}^FS

^BY3,3,100^FT50,200^BCN,,Y,N^FD${barcodeData}^FS

^FO30,350^A0N,28,28^FDLOT: ${safeLotNumber}^FS
^FO500,350^A0N,22,22^FDGTIN: ${gtin}^FS

^XZ`

  return zpl
}
