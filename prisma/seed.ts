import { PrismaClient } from "@prisma/client"
import bcrypt from "bcryptjs"

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

  // Create vendors
  console.log("\n🏢 Creating vendors...")
  
  const vendors = [
    { name: "Sysco Corporation", code: "SYSCO" },
    { name: "Local Farms Co-op", code: "LOCAL" },
    { name: "Global Produce Inc", code: "GLOBAL" },
  ]

  for (const vendorData of vendors) {
    const vendor = await prisma.vendor.upsert({
      where: { code: vendorData.code },
      update: {},
      create: vendorData,
    })
    console.log(`   ✅ ${vendor.name} (${vendor.code})`)
  }

  // Initialize lot number sequence if it doesn't exist
  console.log("\n🔢 Initializing lot number sequence...")
  const lotSequenceSetting = await prisma.systemSetting.upsert({
    where: { key: "next_lot_sequence" },
    update: {}, // Don't update if it already exists
    create: {
      key: "next_lot_sequence",
      value: "1",
      description: "Next sequential number for lot number generation (8-digit format: 01 + 6 digits)",
    },
  })
  console.log(`   ✅ Lot number sequence initialized to: ${lotSequenceSetting.value}`)

  console.log("\n✅ Database seeding completed!")
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
