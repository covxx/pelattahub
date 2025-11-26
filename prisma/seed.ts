import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Starting database seed...')

  // Clear existing data (optional - comment out if you want to keep existing data)
  console.log('🗑️  Cleaning up existing data...')
  await prisma.inventoryLot.deleteMany()
  await prisma.product.deleteMany()
  await prisma.user.deleteMany()

  // Create Admin User
  console.log('👤 Creating admin user...')
  const hashedPassword = await bcrypt.hash('admin123', 10)
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@freshproduce.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  })
  console.log(`✅ Created admin user: ${adminUser.email}`)

  // Create Sample Products
  console.log('📦 Creating sample products...')
  
  const product1 = await prisma.product.create({
    data: {
      sku: 'APP-GAL-40',
      name: 'Gala Apples',
      variety: 'Royal Gala',
      description: 'Fresh Gala Apples - 40lb box',
      gtin: '10012345678902', // 14-digit GTIN
      target_temp_f: 32,
      image_url: null,
    },
  })
  console.log(`✅ Created product: ${product1.name} (GTIN: ${product1.gtin})`)

  const product2 = await prisma.product.create({
    data: {
      sku: 'BAN-CAV-40',
      name: 'Cavendish Bananas',
      variety: 'Cavendish',
      description: 'Premium Cavendish Bananas - 40lb box',
      gtin: '10012345678919', // 14-digit GTIN
      target_temp_f: 56,
      image_url: null,
    },
  })
  console.log(`✅ Created product: ${product2.name} (GTIN: ${product2.gtin})`)

  console.log('')
  console.log('🎉 Seed completed successfully!')
  console.log('')
  console.log('📝 Login credentials:')
  console.log('   Email: admin@freshproduce.com')
  console.log('   Password: admin123')
  console.log('')
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

