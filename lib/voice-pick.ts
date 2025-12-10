/**
 * Voice Pick Code Generator
 * 
 * Generates a 4-digit check code used for voice-directed picking verification.
 * Workers verbally confirm they picked the correct item by reading the code.
 * 
 * Based on PTI (Produce Traceability Initiative) standard using CRC16-CCITT.
 */

/**
 * Calculate CRC16-CCITT checksum
 * Polynomial: 0x1021 (standard for PTI)
 * Initial value: 0xFFFF
 * 
 * @param data - String to calculate checksum for
 * @returns CRC16 checksum as integer
 */
function crc16ccitt(data: string): number {
  let crc = 0xFFFF // Initial value
  const polynomial = 0x1021

  for (let i = 0; i < data.length; i++) {
    const byte = data.charCodeAt(i)
    crc ^= (byte << 8)

    for (let bit = 0; bit < 8; bit++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ polynomial) & 0xFFFF
      } else {
        crc = (crc << 1) & 0xFFFF
      }
    }
  }

  return crc & 0xFFFF
}

/**
 * Generate a 4-digit Voice Pick check code
 * 
 * This code is used in voice-directed picking systems to verify the worker
 * is picking from the correct location/lot.
 * 
 * @param gtin - Global Trade Item Number (product barcode)
 * @param lotNumber - Lot number or serial number
 * @param date - Date in YYMMDD format (e.g., "251127" for Nov 27, 2025)
 * @returns 4-digit check code as string (e.g., "1234")
 * 
 * @example
 * ```typescript
 * const code = getVoicePickCode("00012345678905", "LOT-123", "251127")
 * // Returns something like "4782"
 * ```
 */
export function getVoicePickCode(
  gtin: string,
  lotNumber: string,
  date: string
): string {
  // Concatenate all inputs
  const combined = gtin + lotNumber + date

  // Calculate CRC16
  const crc = crc16ccitt(combined)

  // Take modulo 10000 to get 4-digit number
  const fourDigit = crc % 10000

  // Pad with leading zeros to ensure 4 digits
  return fourDigit.toString().padStart(4, "0")
}

/**
 * Format a Date object to YYMMDD string
 * Helper function for date formatting
 * 
 * @param date - Date object
 * @returns YYMMDD string (e.g., "251127")
 */
export function formatDateForVoicePick(date: Date): string {
  const year = date.getFullYear().toString().slice(-2)
  const month = (date.getMonth() + 1).toString().padStart(2, "0")
  const day = date.getDate().toString().padStart(2, "0")
  return year + month + day
}

/**
 * Generate Voice Pick code from lot data
 * Convenience function that extracts necessary fields from lot object
 * 
 * @param lot - Lot object with product GTIN, lot_number, and received_date
 * @returns 4-digit check code
 */
export function getVoicePickCodeFromLot(lot: {
  product: { gtin: string }
  lot_number: string
  received_date: Date | string
}): string {
  const gtin = lot.product.gtin
  const lotNumber = lot.lot_number
  const date = new Date(lot.received_date)
  const dateStr = formatDateForVoicePick(date)

  return getVoicePickCode(gtin, lotNumber, dateStr)
}

/**
 * Validate a Voice Pick code against expected values
 * Used to verify worker input matches the expected check digit
 * 
 * @param inputCode - Code entered/spoken by worker
 * @param expectedCode - Expected code from getVoicePickCode
 * @returns true if codes match
 */
export function validateVoicePickCode(
  inputCode: string,
  expectedCode: string
): boolean {
  // Normalize both codes (remove spaces, ensure 4 digits)
  const normalizedInput = inputCode.replace(/\s/g, "").padStart(4, "0")
  const normalizedExpected = expectedCode.padStart(4, "0")

  return normalizedInput === normalizedExpected
}

/**
 * Format Voice Pick code for display/ZPL
 * Splits the 4-digit code into small (first 2) and large (last 2) digits
 * 
 * @param code - 4-digit Voice Pick code
 * @returns Object with small and large digit strings
 * 
 * @example
 * ```typescript
 * formatVoicePick("1234")
 * // Returns { small: "12", large: "34" }
 * ```
 */
export function formatVoicePick(code: string): {
  small: string
  large: string
} {
  // Ensure 4 digits
  const normalized = code.padStart(4, "0")
  
  return {
    small: normalized.slice(0, 2), // First 2 digits
    large: normalized.slice(2, 4), // Last 2 digits
  }
}

