import { PrismaClient } from '@prisma/client'

// Extend Prisma Client with performance optimizations
export const createExtendedPrismaClient = () => {
  const prisma = new PrismaClient()
  prisma.$connect()
  return prisma
}

// Singleton pattern
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createExtendedPrismaClient> | undefined
}

export const prisma = globalForPrisma.prisma ?? createExtendedPrismaClient()
// 单库场景：读连接与写连接一致
export const prismaRead = prisma

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
