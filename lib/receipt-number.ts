import { prisma } from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

/**
 * Get the next sequential receipt number
 * Format: Sequential number starting from 1 (e.g., 1, 2, 3, ...)
 * 
 * This function uses a transaction to ensure atomicity and prevent duplicates
 * 
 * @param tx - Optional Prisma transaction client. If provided, uses that transaction.
 *             If not provided, creates its own transaction.
 */
export async function getNextReceiptNumber(
  tx?: Omit<
    Prisma.TransactionClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >
): Promise<number> {
  // If we're in an existing transaction, use it directly
  // Otherwise, wrap in a new transaction
  if (tx) {
    return await getNextReceiptNumberInTransaction(tx)
  } else {
    return await prisma.$transaction(async (transactionClient) => {
      return await getNextReceiptNumberInTransaction(transactionClient)
    })
  }
}

/**
 * Internal function to get next receipt number within a transaction
 */
async function getNextReceiptNumberInTransaction(
  tx: Omit<
    Prisma.TransactionClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >
): Promise<number> {
  // First, try to insert the setting if it doesn't exist (handles race condition)
  // ON CONFLICT DO NOTHING ensures only one transaction will successfully create it
  await tx.$executeRaw`
    INSERT INTO system_settings (key, value, description, "updatedAt")
    VALUES ('next_receipt_sequence', '1', 'Next sequential number for receipt number generation', NOW())
    ON CONFLICT (key) DO NOTHING
  `

  // Now SELECT FOR UPDATE will always find a row (either existing or just created)
  // This locks the row and prevents concurrent access
  const result = await tx.$queryRaw<Array<{ value: string }>>`
    SELECT value FROM system_settings 
    WHERE key = 'next_receipt_sequence'
    FOR UPDATE
  `

  if (result.length === 0) {
    // This should never happen after the INSERT above, but handle it defensively
    throw new Error("Failed to initialize receipt sequence setting")
  }

  // Get current sequence number
  let currentSequence = parseInt(result[0].value, 10) || 1

  // Double-check against actual max receipt number to handle initialization and edge cases
  const maxReceiptResult = await tx.$queryRaw<Array<{ max_receipt: number | null }>>`
    SELECT MAX(receipt_number) as max_receipt FROM receiving_events
  `

  const maxReceipt = maxReceiptResult[0]?.max_receipt

  if (maxReceipt !== null && maxReceipt !== undefined && currentSequence <= maxReceipt) {
    // Sequence is behind - correct it (handles case where setting was just initialized)
    currentSequence = maxReceipt + 1
  }

  // Update the sequence to next value
  await tx.$executeRaw`
    UPDATE system_settings 
    SET value = ${(currentSequence + 1).toString()}::text,
        "updatedAt" = NOW()
    WHERE key = 'next_receipt_sequence'
  `

  return currentSequence
}

