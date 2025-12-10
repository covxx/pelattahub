const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcryptjs")

const prisma = new PrismaClient()

async function main() {
  console.log("Seeding database...")

  // Create admin user
  const email = "admin@example.com"
  const password = "admin123"
  const hashedPassword = await bcrypt.hash(password, 10)

  // Delete existing admin user if exists
  await prisma.user.deleteMany({
    where: { email },
  })

  // Create admin user
  const adminUser = await prisma.user.create({
    data: {
      email,
      name: "Admin User",
      password: hashedPassword,
      role: "ADMIN",
    },
  })

  console.log("✅ Admin user created:")
  console.log(`   Email: ${adminUser.email}`)
  console.log(`   Password: admin123`)
  console.log(`   Role: ${adminUser.role}`)

  console.log("\nDatabase seeding completed!")
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

