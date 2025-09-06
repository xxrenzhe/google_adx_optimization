import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Initialize database on startup in production
if (process.env.NODE_ENV === 'production') {
  import('./db-init').catch(() => {
    console.error('Failed to initialize database')
  })
}