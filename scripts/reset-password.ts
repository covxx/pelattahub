import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2] || "admin@example.com"
  const newPassword = process.argv[3] || "admin123"

  console.log("🔐 Resetting password for user...")
  console.log(`   Email: ${email}`)
  console.log(`   New Password: ${newPassword}\n`)

  try {
    // Find user
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      console.error(`❌ User not found: ${email}`)
      console.log("\n💡 Available users:")
      const allUsers = await prisma.user.findMany({
        select: { email: true, name: true, role: true },
      })
      allUsers.forEach((u) => {
        console.log(`   - ${u.email} (${u.name}, ${u.role})`)
      })
      process.exit(1)
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update user
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
      },
    })

    console.log("✅ Password reset successfully!")
    console.log(`\n📋 Login Credentials:`)
    console.log(`   Email: ${email}`)
    console.log(`   Password: ${newPassword}`)
    console.log(`   Role: ${user.role}`)
  } catch (error) {
    console.error("❌ Error resetting password:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()


