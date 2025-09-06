import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    // Try to query the database to check if tables exist
    await prisma.adReport.count()
    console.log('Database tables already exist')
  } catch (error) {
    if (error.code === 'P2021') {
      console.log('Tables do not exist, creating schema...')
      try {
        // Use db push to create tables
        const { execSync } = require('child_process')
        execSync('npx prisma db push', { stdio: 'inherit' })
        console.log('Database schema created successfully')
      } catch (pushError) {
        console.error('Failed to create database schema:', pushError)
        // Don't exit process, let the app start anyway
      }
    } else {
      console.error('Database connection error:', error)
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })