import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentSession } from '@/lib/session'

// 数据清理API - 30分钟后自动清理
export async function GET(request: NextRequest) {
  try {
    // 验证权限（可选，也可以移除让内部调用）
    const authHeader = request.headers.get('authorization')
    if (authHeader && authHeader !== `Bearer ${process.env.INTERNAL_API_KEY}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const results = await performDataCleanup()
    
    return NextResponse.json({
      message: 'Data cleanup completed',
      results,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Data cleanup error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup data' },
      { status: 500 }
    )
  }
}

// 执行数据清理 - 清理30分钟前的数据
async function performDataCleanup() {
  const results = {
    expiredSessions: 0,
    expiredTempTables: 0,
    totalSpaceFreed: 0,
    errors: [] as string[]
  }
  
  try {
    // 清理30分钟前的过期会话
    const expiredSince = new Date()
    expiredSince.setMinutes(expiredSince.getMinutes() - 30) // 30分钟前
    
    const expiredSessions = await prisma.uploadSession.findMany({
      where: {
        uploadedAt: {
          lt: expiredSince
        },
        status: {
          in: ['completed', 'failed']
        }
      },
      select: {
        id: true,
        tempTableName: true,
        recordCount: true,
        fileSize: true
      }
    })
    
    results.expiredSessions = expiredSessions.length
    
    // 删除临时表
    for (const session of expiredSessions) {
      try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${session.tempTableName}`)
        results.expiredTempTables++
        
        // 估算释放的空间
        if (session.recordCount) {
          results.totalSpaceFreed += session.recordCount * 500
        }
      } catch (error) {
        console.error(`Failed to drop table ${session.tempTableName}:`, error)
        results.errors.push(`Failed to drop table: ${session.tempTableName}`)
      }
    }
    
    // 删除会话记录
    await prisma.uploadSession.deleteMany({
      where: {
        uploadedAt: {
          lt: expiredSince
        },
        status: {
          in: ['completed', 'failed']
        }
      }
    })
    
    // 同时清理超过1小时的上传中的会话（可能是异常中断的）
    const staleSince = new Date()
    staleSince.setHours(staleSince.getHours() - 1)
    
    const staleSessions = await prisma.uploadSession.findMany({
      where: {
        uploadedAt: {
          lt: staleSince
        },
        status: 'uploading'
      },
      select: {
        id: true,
        tempTableName: true
      }
    })
    
    for (const session of staleSessions) {
      try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${session.tempTableName}`)
        results.expiredTempTables++
      } catch (error) {
        console.error(`Failed to drop stale table ${session.tempTableName}:`, error)
      }
    }
    
    await prisma.uploadSession.deleteMany({
      where: {
        uploadedAt: {
          lt: staleSince
        },
        status: 'uploading'
      }
    })
    
    results.expiredSessions += staleSessions.length
    
    console.log(`Data cleanup completed:`, results)
    
    return results
    
  } catch (error) {
    console.error('Data cleanup failed:', error)
    throw error
  }
}

// 数据清理统计
export async function POST(request: NextRequest) {
  try {
    // 获取数据清理统计
    const stats = await getDataCleanupStats()
    
    return NextResponse.json(stats)
    
  } catch (error) {
    console.error('Get cleanup stats error:', error)
    return NextResponse.json(
      { error: 'Failed to get cleanup stats' },
      { status: 500 }
    )
  }
}

// 获取数据清理统计
async function getDataCleanupStats() {
  try {
    // 当前活跃会话数
    const activeSessions = await prisma.uploadSession.count({
      where: {
        status: 'uploading'
      }
    })
    
    // 30分钟内完成的会话数
    const recentCompleted = await prisma.uploadSession.count({
      where: {
        status: 'completed',
        uploadedAt: {
          gte: new Date(Date.now() - 30 * 60 * 1000)
        }
      }
    })
    
    // 总会话数
    const totalSessions = await prisma.uploadSession.count()
    
    // 估算数据大小
    const sizeResult = await prisma.uploadSession.aggregate({
      _sum: {
        fileSize: true,
        recordCount: true
      }
    })
    
    const estimatedSizeMB = (sizeResult._sum.fileSize || 0) / 1024 / 1024
    const estimatedRecords = sizeResult._sum.recordCount || 0
    
    return {
      activeSessions,
      recentCompleted,
      totalSessions,
      estimatedSizeMB: Math.round(estimatedSizeMB * 100) / 100,
      estimatedRecords,
      dataRetention: '30 minutes',
      lastCleanup: new Date().toISOString()
    }
  } catch (error) {
    console.error('Get cleanup stats failed:', error)
    return {
      error: 'Failed to get stats'
    }
  }
}