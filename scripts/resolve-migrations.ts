#!/usr/bin/env tsx
/**
 * Script to resolve orphaned migrations
 * Handles connection retries for Railway database
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function resolveMigrations() {
  const maxRetries = 5
  let retries = 0

  while (retries < maxRetries) {
    try {
      console.log(`Attempt ${retries + 1}/${maxRetries}: Connecting to database...`)
      
      // Test connection
      await prisma.$connect()
      console.log('✅ Connected to database')

      // Check if migrations exist in database
      const migrations = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
        SELECT migration_name, finished_at 
        FROM _prisma_migrations 
        WHERE migration_name IN ('20251210000001_add_srjlab_role', '20251224025334_add_srjlab_role')
        ORDER BY started_at
      `

      console.log(`Found ${migrations.length} orphaned migrations in database:`)
      migrations.forEach(m => {
        console.log(`  - ${m.migration_name} (finished: ${m.finished_at ? 'yes' : 'no'})`)
      })

      if (migrations.length > 0) {
        // Delete orphaned migrations from database
        console.log('\n🗑️  Removing orphaned migrations from database...')
        await prisma.$executeRaw`
          DELETE FROM _prisma_migrations 
          WHERE migration_name IN ('20251210000001_add_srjlab_role', '20251224025334_add_srjlab_role')
        `
        console.log('✅ Orphaned migrations removed from database')
      } else {
        console.log('✅ No orphaned migrations found in database')
      }

      // Now try to run migrations
      console.log('\n🔄 Running migrations...')
      const { execSync } = require('child_process')
      execSync('npx prisma migrate deploy', { 
        stdio: 'inherit',
        env: { ...process.env }
      })

      console.log('\n✅ Migrations resolved successfully!')
      break

    } catch (error: any) {
      retries++
      const errorMessage = error.message || String(error)
      
      if (errorMessage.includes('P1001') || errorMessage.includes('Connection') || errorMessage.includes('closed')) {
        if (retries < maxRetries) {
          const waitTime = retries * 2
          console.log(`⚠️  Connection failed. Retrying in ${waitTime} seconds...`)
          await new Promise(resolve => setTimeout(resolve, waitTime * 1000))
          continue
        } else {
          console.error('\n❌ Failed to connect to database after', maxRetries, 'attempts')
          console.error('Error:', errorMessage)
          console.error('\n💡 Possible solutions:')
          console.error('  1. Check if Railway database is running (may be paused on free tier)')
          console.error('  2. Verify DATABASE_URL is correct')
          console.error('  3. Check network connectivity')
          process.exit(1)
        }
      } else {
        console.error('\n❌ Unexpected error:', errorMessage)
        throw error
      }
    } finally {
      await prisma.$disconnect()
    }
  }
}

resolveMigrations().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

