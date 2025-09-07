import { NextRequest, NextResponse } from 'next/server'
import { cacheManager } from '@/lib/cache-manager'
import { createClient } from 'redis'

// 缓存清理API
export async function GET(request: NextRequest) {
  try {
    // 注意：CRON_SECRET已移除，如需保护此端点，请实现其他认证方式
    
    const results = await performCacheCleanup()
    
    return NextResponse.json({
      message: 'Cache cleanup completed',
      results,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Cache cleanup error:', error)
    return NextResponse.json(
      { error: 'Failed to cleanup cache' },
      { status: 500 }
    )
  }
}

// 执行缓存清理
async function performCacheCleanup() {
  const results = {
    expiredQueryKeys: 0,
    expiredAnalyticsKeys: 0,
    expiredPageKeys: 0,
    expiredSessions: 0,
    totalKeysCleaned: 0,
    errors: [] as string[]
  }
  
  try {
    // 获取Redis客户端
    const redis = createClient({
      url: process.env.REDIS_URL || '',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500)
      }
    })
    
    await redis.connect()
    
    // 1. 清理过期的查询缓存
    const now = Date.now()
    const expiredQueries = await redis.zRangeByScore('query_keys', 0, now)
    
    if (expiredQueries.length > 0) {
      await redis.del(expiredQueries)
      await redis.zRemRangeByScore('query_keys', 0, now)
      results.expiredQueryKeys = expiredQueries.length
      results.totalKeysCleaned += expiredQueries.length
    }
    
    // 2. 清理过期的分析缓存
    const expiredAnalytics = await redis.zRangeByScore('analytics_keys', 0, now)
    
    if (expiredAnalytics.length > 0) {
      const keysToDelete = []
      for (const sessionId of expiredAnalytics) {
        keysToDelete.push(
          `analytics:daily:${sessionId}`,
          `analytics:website:${sessionId}`,
          `analytics:country:${sessionId}`,
          `analytics:device:${sessionId}`
        )
      }
      
      if (keysToDelete.length > 0) {
        await redis.del(keysToDelete)
        await redis.zRemRangeByScore('analytics_keys', 0, now)
        results.expiredAnalyticsKeys = expiredAnalytics.length
        results.totalKeysCleaned += keysToDelete.length
      }
    }
    
    // 3. 清理过期的页面缓存
    const pagePattern = 'pages:*'
    const allPageKeys = await redis.keys(pagePattern)
    
    for (const pageKey of allPageKeys) {
      const expiredPages = await redis.zRangeByScore(pageKey, 0, now)
      if (expiredPages.length > 0) {
        const pageKeysToDelete = expiredPages.map((page: string) => `page:${pageKey.split(':')[1]}:${page}`)
        await redis.del(pageKeysToDelete)
        await redis.zRemRangeByScore(pageKey, 0, now)
        results.expiredPageKeys += expiredPages.length
        results.totalKeysCleaned += expiredPages.length
      }
    }
    
    // 4. 清理过期的会话缓存
    const sessionPattern = 'session:*'
    const allSessionKeys = await redis.keys(sessionPattern)
    
    for (const sessionKey of allSessionKeys) {
      const sessionData = await redis.get(sessionKey)
      if (sessionData) {
        try {
          const session = JSON.parse(sessionData)
          // 如果会话超过24小时，清理缓存
          const sessionTime = new Date(session.uploadedAt).getTime()
          if (now - sessionTime > 24 * 60 * 60 * 1000) {
            await redis.del(sessionKey)
            results.expiredSessions++
            results.totalKeysCleaned++
          }
        } catch (e) {
          // 无效的JSON，删除
          await redis.del(sessionKey)
          results.totalKeysCleaned++
        }
      }
    }
    
    // 5. 获取Redis统计信息
    const info = await redis.info('memory')
    const usedMemory = info.match(/used_memory_human:([^\r\n]+)/)?.[1]
    const keyCount = info.match(/keyspace_hits:([^\r\n]+)/)?.[1]
    
    await redis.disconnect()
    
    console.log(`Cache cleanup completed:`, results)
    
    return {
      ...results,
      memoryUsage: usedMemory,
      keyspaceHits: keyCount
    }
    
  } catch (error) {
    console.error('Cache cleanup failed:', error)
    throw error
  }
}