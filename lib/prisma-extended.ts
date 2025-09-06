import { PrismaClient } from '@prisma/client'

// Extend Prisma Client with performance optimizations
export const createExtendedPrismaClient = () => {
  const prisma = new PrismaClient()
  
  // Add query logging for development
  if (process.env.NODE_ENV === 'development') {
    prisma.$use(async (params, next) => {
      const before = Date.now()
      const result = await next(params)
      const after = Date.now()
      console.log(`Query ${params.model}.${params.action} took ${after - before}ms`)
      return result
    })
  }
  
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