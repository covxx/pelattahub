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
  // Get or create the next_lot_sequence setting
  let setting = await tx.systemSetting.findUnique({
    where: { key: "next_lot_sequence" },
  })

  if (!setting) {
    // Initialize the sequence to 1 if it doesn't exist
    setting = await tx.systemSetting.create({
      data: {
        key: "next_lot_sequence",
        value: "1",
        description: "Next sequential number for lot number generation (8-digit format: 01 + 6 digits)",
      },
    })
  }

  // Get current sequence number
  const currentSequence = parseInt(setting.value, 10) || 1

  // Generate lot number: "01" + 6-digit sequence
  const lotNumber = "01" + currentSequence.toString().padStart(6, "0")

  // Increment and update the sequence
  const nextSequence = currentSequence + 1
  await tx.systemSetting.update({
    where: { key: "next_lot_sequence" },
    data: {
      value: nextSequence.toString(),
    },
  })

  return lotNumber
}

