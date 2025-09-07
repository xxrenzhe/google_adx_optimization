import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from 'redis'

// Redis client for caching
const redis = createClient({
  url: process.env.REDIS_URL || '',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
})

// 清理过期会话和临时表
export async function POST() {
  try {
    const cleanedCount = await cleanupExpiredSessions()
    
    return NextResponse.json({ 
      message: `Cleaned up ${cleanedCount} expired sessions`,
      cleanedCount 
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup sessions' },
      { status: 500 }
    )
  }
}

// 自动清理函数（可以通过定时任务调用）
export async function GET() {
  try {
    const cleanedCount = await cleanupExpiredSessions()
    
    return NextResponse.json({ 
      message: `Auto-cleaned ${cleanedCount} expired sessions`,
      cleanedCount 
    })
  } catch (error) {
    console.error('Auto cleanup error:', error)
    return NextResponse.json(
      { error: 'Failed to auto cleanup' },
      { status: 500 }
    )
  }
}

async function cleanupExpiredSessions(): Promise<number> {
  let cleanedCount = 0
  
  try {
    // 查找过期会话（24小时前）
    const expiredSessions = await prisma.uploadSession.findMany({
      where: {
        OR: [
          {
            analyzedAt: { 
              lt: new Date(Date.now() - 24 * 60 * 60 * 1000) 
            }
          },
          {
            uploadedAt: { 
              lt: new Date(Date.now() - 48 * 60 * 60 * 1000) 
            },
            analyzedAt: null
          }
        ]
      },
      select: {
        id: true,
        tempTableName: true
      }
    })
    
    if (expiredSessions.length === 0) {
      return 0
    }
    
    // 清理每个过期会话
    for (const session of expiredSessions) {
      try {
        // 删除临时表
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${session.tempTableName}`)
        
        // 删除Redis缓存
        await redis.del(`session:${session.id}`)
        await redis.del(`upload_progress:${session.id}`)
        
        // 删除相关的数据缓存
        const cacheKeys = await redis.keys(`data:${session.id}:*`)
        if (cacheKeys.length > 0) {
          await redis.del(cacheKeys)
        }
        
        const analyticsKeys = await redis.keys(`analytics:${session.id}:*`)
        if (analyticsKeys.length > 0) {
          await redis.del(analyticsKeys)
        }
        
        cleanedCount++
      } catch (error) {
        console.error(`Failed to cleanup session ${session.id}:`, error)
      }
    }
    
    // 批量删除会话记录
    await prisma.uploadSession.deleteMany({
      where: {
        id: {
          in: expiredSessions.map(s => s.id)
        }
      }
    })
    
    console.log(`Cleaned up ${cleanedCount} expired sessions`)
    
    return cleanedCount
  } catch (error) {
    console.error('Cleanup failed:', error)
    throw error
  }
}