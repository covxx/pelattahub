import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  console.log("🔍 Authentication Diagnostic Script")
  console.log("===================================\n")

  const email = "admin@freshproduce.com"
  const testPassword = "admin123"

  try {
    // Search for user
    console.log(`📧 Searching for user: ${email}`)
    const user = await prisma.user.findUnique({
      where: { email },
    })

    // Check 1: Existence
    if (!user) {
      console.log("❌ User NOT found in database.")
      console.log("\n💡 Tip: Check if the user exists with a different email.")
      console.log("   Common emails: admin@example.com, admin@freshproduce.com")
      return
    }

    // Check 2: Data Integrity
    console.log("✅ User found!")
    console.log(`   User ID: ${user.id}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Name: ${user.name || "N/A"}`)
    console.log(`   Email Verified: ${user.emailVerified ? "Yes" : "No"}`)
    
    if (user.password) {
      const hashPreview = user.password.substring(0, 10) + "..."
      console.log(`   Password Hash (first 10 chars): ${hashPreview}`)
      console.log(`   Password Hash Length: ${user.password.length}`)
    } else {
      console.log("   ⚠️  Password: NULL (User has no password set)")
    }

    // Check 3: Password Validation
    console.log("\n🔐 Testing password validation...")
    if (!user.password) {
      console.log("❌ Cannot validate password: User has no password hash")
      return
    }

    try {
      const isPasswordValid = await bcrypt.compare(testPassword, user.password)
      
      if (isPasswordValid) {
        console.log(`✅ Password match: TRUE (password "${testPassword}" is valid)`)
      } else {
        console.log(`❌ Password match: FALSE (password "${testPassword}" does not match)`)
        console.log("\n💡 Tip: The password might be different. Check the seed file or database.")
      }
    } catch (error) {
      console.log("❌ Error during password comparison:", error)
    }

    // Additional checks
    console.log("\n📋 Additional User Data:")
    console.log(`   Created At: ${user.createdAt}`)
    console.log(`   Updated At: ${user.updatedAt}`)
    console.log(`   Has Accounts: ${(await prisma.account.count({ where: { userId: user.id } })) > 0}`)
    console.log(`   Has Sessions: ${(await prisma.session.count({ where: { userId: user.id } })) > 0}`)

  } catch (error) {
    console.error("❌ Error during diagnostic:", error)
    if (error instanceof Error) {
      console.error("   Message:", error.message)
      console.error("   Stack:", error.stack)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch((error) => {
    console.error("Fatal error:", error)
    process.exit(1)
  })

