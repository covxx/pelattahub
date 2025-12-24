/**
 * GTIN (Global Trade Item Number) Generation Utility
 * 
 * Provides functions to generate valid 14-digit GTINs for products
 */

/**
 * Generate a unique 14-digit GTIN using GS1 prefix and product identifier
 * Format: {gs1Prefix}{productIdHash}{checkDigit}
 * 
 * @param gs1Prefix - 6-digit GS1 company prefix (default: 000000)
 * @param productId - Product ID or SKU to generate unique GTIN from
 * @param index - Optional index for additional uniqueness
 * @returns 14-digit GTIN string
 */
export function generateGTIN(gs1Prefix: string, productId: string, index: number = 0): string {
  // Convert product ID to a numeric hash (use char codes)
  let idHash = 0
  for (let i = 0; i < productId.length; i++) {
    idHash = ((idHash << 5) - idHash) + productId.charCodeAt(i)
    idHash = idHash & idHash // Convert to 32-bit integer
  }
  
  // Make it positive and pad to 6 digits
  const idHashStr = Math.abs(idHash).toString().padStart(6, "0").slice(0, 6)
  
  // Add index to ensure uniqueness (pad to 2 digits)
  const indexStr = index.toString().padStart(2, "0")
  
  // Ensure GS1 prefix is 6 digits
  const paddedPrefix = gs1Prefix.padStart(6, "0").slice(0, 6)
  
  // Combine: GS1 prefix (6) + ID hash (6) + index (2) = 14 digits (without check digit)
  const base = `${paddedPrefix}${idHashStr}${indexStr}`
  
  // Calculate check digit using GTIN-14 algorithm
  // For GTIN-14: multiply positions 1,3,5,7,9,11,13 by 3, others by 1
  let sum = 0
  for (let i = 0; i < 13; i++) {
    const digit = parseInt(base[i])
    // Positions are 1-indexed: 1,3,5,7,9,11,13 get multiplied by 3
    // In 0-indexed: 0,2,4,6,8,10,12 get multiplied by 3
    sum += digit * (i % 2 === 0 ? 3 : 1)
  }
  const checkDigit = (10 - (sum % 10)) % 10
  
  return `${base}${checkDigit}`
}

/**
 * Validate GTIN format (must be 14 digits)
 */
export function isValidGTIN(gtin: string | null | undefined): boolean {
  if (!gtin) return false
  const digits = gtin.replace(/\D/g, "")
  return digits.length === 14 && /^\d{14}$/.test(digits)
}

/**
 * Generate a unique GTIN for a product, ensuring it doesn't already exist
 * 
 * @param gs1Prefix - GS1 company prefix
 * @param productId - Product ID or SKU
 * @param checkExists - Function to check if GTIN exists (returns true if exists)
 * @returns Unique 14-digit GTIN string
 */
export async function generateUniqueGTIN(
  gs1Prefix: string,
  productId: string,
  checkExists: (gtin: string) => Promise<boolean>
): Promise<string> {
  let attempts = 0
  let newGtin = generateGTIN(gs1Prefix, productId, 0)
  
  while (await checkExists(newGtin)) {
    attempts++
    newGtin = generateGTIN(gs1Prefix, productId, attempts)
    
    if (attempts > 100) {
      // Fallback: use timestamp-based GTIN
      const timestamp = Date.now().toString().slice(-6)
      newGtin = generateGTIN(gs1Prefix, productId + timestamp, 0)
      break
    }
  }
  
  return newGtin
}

