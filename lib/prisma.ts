import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Create Prisma client with optimized connection pool
const prismaClient = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['warn', 'error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL + (process.env.DATABASE_URL?.includes('?') ? '&' : '?') + 
           'charset=utf8&pool_timeout=60&connect_timeout=30&application_name=adx_optimization' +
           '&connection_limit=20' // PostgreSQL connection limit
    }
  }
})

export const prisma = globalForPrisma.prisma ?? prismaClient

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Set client encoding to UTF-8
async function setUTF8Encoding() {
  try {
    await prisma.$executeRaw`SET client_encoding TO 'UTF8'`
    console.log('[PRISMA] Database client encoding set to UTF-8')
  } catch (error) {
    console.warn('[PRISMA] Failed to set client encoding:', error)
  }
}

// Set encoding on startup
setUTF8Encoding()

// Initialize database on startup in production
if (process.env.NODE_ENV === 'production') {
  import('./db-init').catch(() => {
    console.error('Failed to initialize database')
  })
}