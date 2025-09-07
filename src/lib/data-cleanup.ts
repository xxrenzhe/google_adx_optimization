import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentSession } from '@/lib/session'

// 数据清理中间件 - 在上传新数据前清理用户的旧数据
export async function cleanupUserOldData(request: NextRequest) {
  try {
    // 获取当前会话
    const currentSession = getCurrentSession(request)
    
    if (currentSession) {
      // 清理该用户的旧数据
      await cleanupSessionData(currentSession.id)
    }
    
    return NextResponse.next()
    
  } catch (error) {
    console.error('Cleanup user old data failed:', error)
    // 不阻塞上传流程，继续执行
    return NextResponse.next()
  }
}

// 清理会话数据
async function cleanupSessionData(sessionId: string) {
  try {
    // 获取会话信息
    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
      select: { tempTableName: true }
    })
    
    if (session) {
      // 删除临时表
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${session.tempTableName}`)
      
      // 更新会话状态
      await prisma.uploadSession.update({
        where: { id: sessionId },
        data: { 
          status: 'replaced',
          errorMessage: 'Replaced by new upload'
        }
      })
      
      console.log(`Cleaned up old data for session: ${sessionId}`)
    }
  } catch (error) {
    console.error(`Failed to cleanup session ${sessionId}:`, error)
  }
}

// 批量清理过期数据
export async function batchCleanupExpiredData() {
  const cutoffDate = new Date()
  cutoffDate.setHours(cutoffDate.getHours() - 24) // 24小时前
  
  try {
    // 查找过期的会话
    const expiredSessions = await prisma.uploadSession.findMany({
      where: {
        uploadedAt: {
          lt: cutoffDate
        },
        status: {
          in: ['completed', 'failed', 'replaced']
        }
      },
      select: {
        id: true,
        tempTableName: true
      }
    })
    
    let cleanedCount = 0
    
    // 批量删除临时表
    for (const session of expiredSessions) {
      try {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS ${session.tempTableName}`)
        cleanedCount++
      } catch (error) {
        console.error(`Failed to drop table ${session.tempTableName}:`, error)
      }
    }
    
    // 批量删除会话记录
    await prisma.uploadSession.deleteMany({
      where: {
        uploadedAt: {
          lt: cutoffDate
        },
        status: {
          in: ['completed', 'failed', 'replaced']
        }
      }
    })
    
    console.log(`Batch cleanup completed: ${cleanedCount} tables dropped`)
    
    return {
      success: true,
      cleanedCount,
      totalSessions: expiredSessions.length
    }
    
  } catch (error) {
    console.error('Batch cleanup failed:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取数据清理统计
export async function getCleanupStats() {
  try {
    const stats = await prisma.$queryRaw`
      SELECT 
        status,
        COUNT(*) as count,
        COALESCE(SUM(file_size), 0) as total_size
      FROM upload_sessions
      GROUP BY status
    `
    
    return stats
    
  } catch (error) {
    console.error('Get cleanup stats failed:', error)
    return []
  }
}