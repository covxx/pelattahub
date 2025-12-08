import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

async function main() {
  const email = process.argv[2] || "admin@example.com"
  const password = process.argv[3] || "admin123"
  const name = process.argv[4] || "Admin User"

  console.log("Creating admin account...")
  console.log(`   Email: ${email}`)
  console.log(`   Name: ${name}`)
  console.log(`   Password: ${password}\n`)

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10)

    // Delete existing user if exists
    await prisma.user.deleteMany({
      where: { email },
    })

    // Create admin user
    const adminUser = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: "ADMIN",
      },
    })

    console.log("✅ Admin user created successfully!")
    console.log(`\n📋 Login Credentials:`)
    console.log(`   Email: ${adminUser.email}`)
    console.log(`   Password: ${password}`)
    console.log(`   Role: ${adminUser.role}`)
  } catch (error) {
    console.error("❌ Error creating admin user:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()

