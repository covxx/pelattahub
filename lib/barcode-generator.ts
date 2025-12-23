/**
 * Barcode Generator Utility
 * 
 * Generates barcodes as data URLs for use in React-PDF
 * Uses jsbarcode for client-side generation
 */

/**
 * Generate barcode as data URL (PNG)
 * This function must be called in the browser (client-side)
 * 
 * @param data - Barcode data string
 * @param format - Barcode format (default: 'CODE128')
 * @returns Data URL string (e.g., "data:image/png;base64,...")
 */
/**
 * Generate barcode as data URL (synchronous version for React-PDF)
 * This function must be called in the browser (client-side)
 * 
 * @param data - Barcode data string
 * @param format - Barcode format (default: 'CODE128')
 * @returns Data URL string (e.g., "data:image/png;base64,...") or empty string if failed
 */
export function generateBarcodeDataUrl(
  data: string,
  format: 'CODE128' | 'EAN13' | 'GS1_128' = 'CODE128'
): string {
  if (typeof window === 'undefined') {
    // Server-side: return empty string (barcode will be generated client-side)
    return ''
  }

  try {
    // Use require for synchronous access (jsbarcode is already installed)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const JsBarcode = require('jsbarcode')
    const canvas = document.createElement('canvas')
    
    JsBarcode(canvas, data, {
      format,
      width: 2,
      height: 60,
      displayValue: false,
      margin: 0,
      background: '#ffffff',
      lineColor: '#000000',
    })
    
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Failed to generate barcode:', error)
    return ''
  }
}

/**
 * Pad GTIN to 14 digits with leading zeros
 */
export function padGTIN(gtin: string): string {
  const digits = gtin.replace(/\D/g, '')
  return digits.padStart(14, '0')
}

/**
 * Format GS1-128 barcode data
 * Format: (01){gtin}(10){lotNumber}
 * 
 * @param gtin - 14-digit GTIN
 * @param lotNumber - Lot number
 * @returns Formatted barcode string
 */
export function formatGS1Barcode(gtin: string, lotNumber: string): string {
  const paddedGTIN = padGTIN(gtin)
  return `(01)${paddedGTIN}(10)${lotNumber}`
}
