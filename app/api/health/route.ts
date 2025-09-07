import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // 检查数据库连接
    const { prisma } = await import('@/lib/prisma')
    await prisma.$queryRaw`SELECT 1`
    
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected'
    })
  } catch (error) {
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}