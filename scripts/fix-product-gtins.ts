import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * Generate a unique 14-digit GTIN using GS1 prefix and product identifier
 * Format: {gs1Prefix}{productIdHash}{checkDigit}
 * 
 * @param gs1Prefix - 6-digit GS1 company prefix (default: 000000)
 * @param productId - Product ID to generate unique GTIN from
 * @param index - Optional index for additional uniqueness
 * @returns 14-digit GTIN string
 */
function generateGTIN(gs1Prefix: string, productId: string, index: number = 0): string {
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
  
  // Combine: GS1 prefix (6) + ID hash (6) + index (2) = 14 digits (without check digit)
  const base = `${gs1Prefix}${idHashStr}${indexStr}`
  
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
function isValidGTIN(gtin: string | null | undefined): boolean {
  if (!gtin) return false
  const digits = gtin.replace(/\D/g, "")
  return digits.length === 14 && /^\d{14}$/.test(digits)
}

/**
 * Fix GTIN issues for all products in the database
 */
async function main() {
  const dryRun = process.argv.includes("--dry-run") || process.argv.includes("-d")
  
  if (dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n")
  }
  
  console.log("🔍 Checking for GTIN issues...\n")

  try {
    // Get GS1 prefix from system settings (default to 000000)
    const gs1Setting = await prisma.systemSetting.findUnique({
      where: { key: "gs1_prefix" },
    })
    const gs1Prefix = gs1Setting?.value || "000000"
    
    // Ensure GS1 prefix is 6 digits
    const paddedPrefix = gs1Prefix.padStart(6, "0").slice(0, 6)
    
    console.log(`📋 Using GS1 prefix: ${paddedPrefix}\n`)

    // Get all products
    const allProducts = await prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        name: true,
        gtin: true,
      },
      orderBy: {
        createdAt: "asc",
      },
    })

    console.log(`📦 Found ${allProducts.length} products to check\n`)

    // Find products with invalid GTINs
    const invalidProducts = allProducts.filter(
      (p) => !isValidGTIN(p.gtin)
    )

    // Find duplicate GTINs
    const gtinMap = new Map<string, string[]>()
    allProducts.forEach((p) => {
      if (isValidGTIN(p.gtin)) {
        const gtin = p.gtin!.replace(/\D/g, "").padStart(14, "0")
        if (!gtinMap.has(gtin)) {
          gtinMap.set(gtin, [])
        }
        gtinMap.get(gtin)!.push(p.id)
      }
    })

    const duplicateGTINs = Array.from(gtinMap.entries()).filter(
      ([_, ids]) => ids.length > 1
    )

    console.log(`❌ Products with invalid GTINs: ${invalidProducts.length}`)
    console.log(`⚠️  Duplicate GTIN groups: ${duplicateGTINs.length}\n`)

    if (invalidProducts.length === 0 && duplicateGTINs.length === 0) {
      console.log("✅ All products have valid, unique GTINs!")
      return
    }

    if (dryRun) {
      console.log("\n📋 DRY RUN - Would fix the following products:\n")
    }

    // Track what we're fixing
    const productsToFix: Array<{
      id: string
      sku: string
      name: string
      oldGtin: string | null
      newGtin: string
      reason: string
    }> = []

    // Fix invalid GTINs
    for (const product of invalidProducts) {
      let newGtin = generateGTIN(paddedPrefix, product.id, 0)
      
      // Ensure uniqueness (check if already exists)
      let attempts = 0
      while (true) {
        const exists = await prisma.product.findUnique({
          where: { gtin: newGtin },
        })
        
        if (!exists || exists.id === product.id) {
          break
        }
        
        attempts++
        newGtin = generateGTIN(paddedPrefix, product.id, attempts)
        
        if (attempts > 100) {
          // Fallback: use timestamp-based GTIN
          const timestamp = Date.now().toString().slice(-6)
          newGtin = generateGTIN(paddedPrefix, product.id + timestamp, 0)
          break
        }
      }

      productsToFix.push({
        id: product.id,
        sku: product.sku,
        name: product.name,
        oldGtin: product.gtin,
        newGtin,
        reason: "Invalid GTIN",
      })
    }

    // Fix duplicate GTINs (keep first one, regenerate others)
    for (const [gtin, productIds] of duplicateGTINs) {
      // Keep the first product's GTIN, regenerate for the rest
      const keepId = productIds[0]
      const fixIds = productIds.slice(1)

      for (let i = 0; i < fixIds.length; i++) {
        const productId = fixIds[i]
        const product = allProducts.find((p) => p.id === productId)
        
        if (!product) continue

        let newGtin = generateGTIN(paddedPrefix, product.id, i + 1)
        
        // Ensure uniqueness
        let attempts = 0
        while (true) {
          const exists = await prisma.product.findUnique({
            where: { gtin: newGtin },
          })
          
          if (!exists || exists.id === productId) {
            break
          }
          
          attempts++
          newGtin = generateGTIN(paddedPrefix, product.id, attempts + i + 1)
          
          if (attempts > 100) {
            const timestamp = Date.now().toString().slice(-6)
            newGtin = generateGTIN(paddedPrefix, product.id + timestamp, 0)
            break
          }
        }

        productsToFix.push({
          id: product.id,
          sku: product.sku,
          name: product.name,
          oldGtin: product.gtin,
          newGtin,
          reason: `Duplicate GTIN (${gtin})`,
        })
      }
    }

    if (productsToFix.length === 0) {
      console.log("✅ No products need fixing!")
      return
    }

    if (dryRun) {
      // Just show what would be fixed
      for (const fix of productsToFix) {
        console.log(`📝 Would fix: ${fix.sku} (${fix.name})`)
        console.log(`   Old GTIN: ${fix.oldGtin || "NULL"}`)
        console.log(`   New GTIN: ${fix.newGtin}`)
        console.log(`   Reason: ${fix.reason}\n`)
      }
      console.log(`\n✅ DRY RUN complete. Run without --dry-run to apply changes.`)
      return
    }

    console.log(`\n🔧 Fixing ${productsToFix.length} products...\n`)

    // Update products in batches
    let fixed = 0
    for (const fix of productsToFix) {
      try {
        await prisma.product.update({
          where: { id: fix.id },
          data: { gtin: fix.newGtin },
        })
        
        console.log(`✅ Fixed: ${fix.sku} (${fix.name})`)
        console.log(`   Old GTIN: ${fix.oldGtin || "NULL"}`)
        console.log(`   New GTIN: ${fix.newGtin}`)
        console.log(`   Reason: ${fix.reason}\n`)
        
        fixed++
      } catch (error) {
        console.error(`❌ Failed to fix ${fix.sku}:`, error)
      }
    }

    console.log(`\n✅ Successfully fixed ${fixed} of ${productsToFix.length} products!`)

    // Verify all products now have valid GTINs
    const verifyProducts = await prisma.product.findMany({
      select: { id: true, gtin: true },
    })

    const stillInvalid = verifyProducts.filter((p) => !isValidGTIN(p.gtin))
    const verifyGtinMap = new Map<string, string[]>()
    verifyProducts.forEach((p) => {
      if (isValidGTIN(p.gtin)) {
        const gtin = p.gtin!.replace(/\D/g, "").padStart(14, "0")
        if (!verifyGtinMap.has(gtin)) {
          verifyGtinMap.set(gtin, [])
        }
        verifyGtinMap.get(gtin)!.push(p.id)
      }
    })

    const stillDuplicates = Array.from(verifyGtinMap.entries()).filter(
      ([_, ids]) => ids.length > 1
    )

    if (stillInvalid.length > 0 || stillDuplicates.length > 0) {
      console.log(`\n⚠️  Warning: Some issues remain:`)
      console.log(`   Invalid GTINs: ${stillInvalid.length}`)
      console.log(`   Duplicate GTINs: ${stillDuplicates.length}`)
    } else {
      console.log(`\n✅ Verification passed: All products have valid, unique GTINs!`)
    }
  } catch (error) {
    console.error("❌ Error fixing GTINs:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

