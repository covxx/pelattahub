import { prisma } from "../lib/prisma"

async function main() {
  const settings = await prisma.integrationSettings.findUnique({
    where: { provider: "qbo" },
  })
  
  console.log("QBO Integration Settings:")
  console.log(JSON.stringify(settings, null, 2))
  
  await prisma.$disconnect()
}

main().catch(console.error)


