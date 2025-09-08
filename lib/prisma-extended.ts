import { PrismaClient } from '@prisma/client'

// Extend Prisma Client with performance optimizations
export const createExtendedPrismaClient = () => {
  const prisma = new PrismaClient()
  
  // Add connection pooling configuration
  prisma.$connect()
  
  return prisma
}

// Singleton pattern
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createExtendedPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createExtendedPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma