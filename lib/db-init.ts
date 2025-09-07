import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function initializeDatabase() {
  console.log('[DB-INIT] Starting database initialization...')
  
  try {
    // Log database connection details
    const databaseUrl = process.env.DATABASE_URL || 'not set'
    console.log(`[DB-INIT] DATABASE_URL: ${databaseUrl.replace(/:([^:@]+)@/, ':***@')}`)
    
    // Try to query the database to check if tables exist
    console.log('[DB-INIT] Checking if database tables exist...')
    const count = await prisma.adReport.count()
    console.log(`[DB-INIT] Database tables already exist. Current record count: ${count}`)
  } catch (error: any) {
    console.log(`[DB-INIT] Database error occurred: ${error.code || 'UNKNOWN_CODE'}`)
    console.log(`[DB-INIT] Error message: ${error.message}`)
    
    if (error.code === 'P2021') {
      console.log('[DB-INIT] Tables do not exist (P2021), creating schema...')
      try {
        // Use db push to create tables
        console.log('[DB-INIT] Executing: npx prisma db push --schema=/app/prisma/schema.prisma')
        const { execSync } = require('child_process')
        execSync('npx prisma db push --schema=/app/prisma/schema.prisma', { 
          stdio: 'inherit',
          cwd: '/app'
        })
        console.log('[DB-INIT] Database schema created successfully')
      } catch (pushError: any) {
        console.error('[DB-INIT] Failed to create database schema:', pushError)
        console.error('[DB-INIT] Stack trace:', pushError.stack)
        // Don't exit process, let the app start anyway
      }
    } else {
      console.error('[DB-INIT] Database connection error:', error)
      console.error('[DB-INIT] Error code:', error.code)
      console.error('[DB-INIT] Error stack:', error.stack)
    }
  } finally {
    console.log('[DB-INIT] Database initialization completed')
  }
}

async function main() {
  await initializeDatabase()
}

main()
  .catch((e) => {
    console.error('[DB-INIT] Unhandled error in main():', e)
    console.error('[DB-INIT] Stack trace:', e.stack)
  })
  .finally(async () => {
    console.log('[DB-INIT] Disconnecting from database...')
    await prisma.$disconnect()
    console.log('[DB-INIT] Disconnected from database')
  })