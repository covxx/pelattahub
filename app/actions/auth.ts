"use server"

import { prisma } from "@/lib/prisma"
import { sendEmail } from "@/lib/email"
import bcrypt from "bcryptjs"
import crypto from "crypto"
import { z } from "zod"

const appBaseUrl = process.env.APP_BASE_URL || process.env.NEXTAUTH_URL

const requestSchema = z.object({
  email: z.string().email(),
})

const resetSchema = z.object({
  token: z.string().min(10),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
})

const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex")

export async function requestPasswordReset(input: { email: string }) {
  const { email } = requestSchema.parse(input)
  const normalizedEmail = email.toLowerCase().trim()

  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true, email: true },
  })

  // Always return generic success to avoid user enumeration
  if (!user) {
    return { success: true }
  }

  // Basic rate limit: max 5 requests per hour per user
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
  const recentRequests = await prisma.passwordResetToken.count({
    where: {
      userId: user.id,
      createdAt: { gte: oneHourAgo },
    },
  })

  if (recentRequests >= 5) {
    return { success: true }
  }

  const rawToken = crypto.randomBytes(48).toString("hex")
  const tokenHash = hashToken(rawToken)
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  })

  if (!appBaseUrl) {
    throw new Error("APP_BASE_URL or NEXTAUTH_URL must be configured for password reset emails.")
  }

  const resetUrl = `${appBaseUrl}/login/reset?token=${rawToken}`

  await sendEmail({
    to: user.email,
    subject: "Reset your PalettaHub password",
    text: [
      "You requested a password reset.",
      `Reset link: ${resetUrl}`,
      "This link expires in 1 hour. If you did not request this, you can ignore this email.",
    ].join("\n"),
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Reset your password</a> (expires in 1 hour)</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  })

  return { success: true }
}

export async function resetPassword(input: { token: string; newPassword: string }) {
  const { token, newPassword } = resetSchema.parse(input)
  const tokenHash = hashToken(token)

  const record = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  })

  if (!record) {
    return { success: false, error: "Invalid or expired token" }
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { password: hashedPassword },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Clean up other outstanding tokens for this user
    prisma.passwordResetToken.deleteMany({
      where: {
        userId: record.userId,
        id: { not: record.id },
      },
    }),
    prisma.auditLog.create({
      data: {
        user_id: record.userId,
        action: "PASSWORD_RESET",
        entity_type: "User",
        entity_id: record.userId,
        details: { message: "Password reset via email link" },
      },
    }),
  ])

  return { success: true }
}


