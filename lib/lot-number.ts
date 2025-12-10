import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

/**
 * Get the next sequential lot number
 * Format: 01 + 6-digit sequence (e.g., 01000001, 01000500)
 * 
 * This function uses a transaction to ensure atomicity and prevent duplicates
 * 
 * @param tx - Optional Prisma transaction client. If provided, uses that transaction.
 *             If not provided, creates its own transaction.
 */
export async function getNextLotNumber(
  tx?: Omit<
    Prisma.TransactionClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >
): Promise<string> {
  // If we're in an existing transaction, use it directly
  // Otherwise, wrap in a new transaction
  if (tx) {
    return await getNextLotNumberInTransaction(tx)
  } else {
    return await prisma.$transaction(async (transactionClient) => {
      return await getNextLotNumberInTransaction(transactionClient)
    })
  }
}

/**
 * Internal function to get next lot number within a transaction
 */
async function getNextLotNumberInTransaction(
  tx: Omit<
    Prisma.TransactionClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >
): Promise<string> {
  // First, try to insert the setting if it doesn't exist (handles race condition)
  // ON CONFLICT DO NOTHING ensures only one transaction will successfully create it
  await tx.$executeRaw`
    INSERT INTO system_settings (key, value, description, "updatedAt")
    VALUES ('next_lot_sequence', '1', 'Next sequential number for lot number generation (8-digit format: 01 + 6 digits)', NOW())
    ON CONFLICT (key) DO NOTHING
  `

  // Now SELECT FOR UPDATE will always find a row (either existing or just created)
  // This locks the row and prevents concurrent access
  const result = await tx.$queryRaw<Array<{ value: string }>>`
    SELECT value FROM system_settings 
    WHERE key = 'next_lot_sequence'
    FOR UPDATE
  `

  if (result.length === 0) {
    // This should never happen after the INSERT above, but handle it defensively
    throw new Error("Failed to initialize lot sequence setting")
  }

  // Get current sequence number
  const currentSequence = parseInt(result[0].value, 10) || 1

  // Update the sequence to next value
  await tx.$executeRaw`
    UPDATE system_settings 
    SET value = ${(currentSequence + 1).toString()}::text,
        "updatedAt" = NOW()
    WHERE key = 'next_lot_sequence'
  `

  // Generate lot number: "01" + 6-digit sequence
  const lotNumber = "01" + currentSequence.toString().padStart(6, "0")

  return lotNumber
}

