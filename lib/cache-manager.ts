import { createClient } from 'redis'

// Redis缓存管理器 - 优化大数据量查询
export class CacheManager {
  private static instance: CacheManager
  private client: any
  private connected = false
  
  private constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL || '',
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 50, 500),
        timeout: 5000,
        connectTimeout: 5000
      }
    })
    
    this.client.on('error', (err: Error) => {
      console.error('Redis Client Error:', err)
      this.connected = false
    })
    
    this.client.on('connect', () => {
      console.log('Redis Connected')
      this.connected = true
    })
  }
  
  static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager()
    }
    return CacheManager.instance
  }
  
  async connect() {
    if (!this.connected) {
      try {
        await this.client.connect()
      } catch (error) {
        console.error('Redis connection failed:', error)
        throw error
      }
    }
  }
  
  // 缓存数据查询结果
  async cacheQueryResult(key: string, data: any, ttl: number = 300) {
    try {
      if (!this.connected) return false
      
      // 使用管道减少网络往返
      const pipeline = this.client.multi()
      pipeline.setEx(key, ttl, JSON.stringify(data))
      pipeline.zAdd('query_keys', { score: Date.now() + ttl * 1000, value: key })
      await pipeline.exec()
      
      return true
    } catch (error) {
      console.error('Cache set failed:', error)
      return false
    }
  }
  
  // 获取缓存的查询结果
  async getCachedQuery(key: string): Promise<any> {
    try {
      if (!this.connected) return null
      
      const cached = await this.client.get(key)
      if (!cached) return null
      
      return JSON.parse(cached)
    } catch (error) {
      console.error('Cache get failed:', error)
      return null
    }
  }
  
  // 缓存分析结果 - 更长的TTL
  async cacheAnalytics(sessionId: string, analytics: any) {
    const keys = [
      `analytics:daily:${sessionId}`,
      `analytics:website:${sessionId}`,
      `analytics:country:${sessionId}`,
      `analytics:device:${sessionId}`
    ]
    
    try {
      const pipeline = this.client.multi()
      
      // 缓存各个维度的分析数据
      pipeline.setEx(keys[0], 3600, JSON.stringify(analytics.daily))
      pipeline.setEx(keys[1], 3600, JSON.stringify(analytics.byWebsite))
      pipeline.setEx(keys[2], 3600, JSON.stringify(analytics.byCountry))
      pipeline.setEx(keys[3], 3600, JSON.stringify(analytics.byDevice))
      
      // 设置过期时间标记
      pipeline.zAdd('analytics_keys', { score: Date.now() + 3600 * 1000, value: sessionId })
      
      await pipeline.exec()
      return true
    } catch (error) {
      console.error('Analytics cache failed:', error)
      return false
    }
  }
  
  // 获取缓存的分析结果
  async getCachedAnalytics(sessionId: string): Promise<any> {
    try {
      if (!this.connected) return null
      
      const pipeline = this.client.multi()
      pipeline.get(`analytics:daily:${sessionId}`)
      pipeline.get(`analytics:website:${sessionId}`)
      pipeline.get(`analytics:country:${sessionId}`)
      pipeline.get(`analytics:device:${sessionId}`)
      
      const results = await pipeline.exec()
      
      if (!results || results.some((r: any[]) => !r[1])) return null
      
      return {
        daily: JSON.parse(results[0][1]),
        byWebsite: JSON.parse(results[1][1]),
        byCountry: JSON.parse(results[2][1]),
        byDevice: JSON.parse(results[3][1])
      }
    } catch (error) {
      console.error('Get cached analytics failed:', error)
      return null
    }
  }
  
  // 缓存分页数据 - 使用列表结构
  async cachePaginatedData(sessionId: string, page: number, data: any, filters: string) {
    const key = `page:${sessionId}:${page}:${filters}`
    
    try {
      // 存储页面数据
      await this.client.setEx(key, 1800, JSON.stringify(data))
      
      // 维护页面列表
      const pageKey = `pages:${sessionId}:${filters}`
      await this.client.zAdd(pageKey, { score: Date.now() + 1800 * 1000, value: String(page) })
      
      return true
    } catch (error) {
      console.error('Page cache failed:', error)
      return false
    }
  }
  
  // 获取缓存的分页数据
  async getCachedPage(sessionId: string, page: number, filters: string): Promise<any> {
    try {
      const key = `page:${sessionId}:${page}:${filters}`
      const cached = await this.client.get(key)
      
      return cached ? JSON.parse(cached) : null
    } catch (error) {
      console.error('Get cached page failed:', error)
      return null
    }
  }
  
  // 实现查询结果预缓存
  async prefetchData(sessionId: string, totalRecords: number) {
    try {
      // 预缓存前几页数据
      const prefetchPages = Math.min(5, Math.ceil(totalRecords / 100))
      
      for (let i = 1; i <= prefetchPages; i++) {
        // 这里应该触发后台任务来预缓存
        // 实际实现需要配合消息队列
      }
    } catch (error) {
      console.error('Prefetch failed:', error)
    }
  }
  
  // 清理过期缓存
  async cleanupExpiredCache() {
    try {
      const now = Date.now()
      
      // 清理查询缓存
      const expiredQueries = await this.client.zRangeByScore('query_keys', 0, now)
      if (expiredQueries.length > 0) {
        await this.client.del(...expiredQueries)
        await this.client.zRemRangeByScore('query_keys', 0, now)
      }
      
      // 清理分析缓存
      const expiredAnalytics = await this.client.zRangeByScore('analytics_keys', 0, now)
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
        await this.client.del(...keysToDelete)
        await this.client.zRemRangeByScore('analytics_keys', 0, now)
      }
      
      console.log(`Cleaned up ${expiredQueries.length} query caches and ${expiredAnalytics.length} analytics caches`)
    } catch (error) {
      console.error('Cache cleanup failed:', error)
    }
  }
  
  // 获取缓存统计
  async getCacheStats() {
    try {
      const info = await this.client.info('memory')
      const usedMemory = info.match(/used_memory_human:([^\r\n]+)/)?.[1]
      
      const queryKeys = await this.client.zcard('query_keys')
      const analyticsKeys = await this.client.zcard('analytics_keys')
      
      return {
        usedMemory,
        activeQueryCaches: queryKeys,
        activeAnalyticsCaches: analyticsKeys,
        connected: this.connected
      }
    } catch (error) {
      console.error('Get cache stats failed:', error)
      return null
    }
  }
  
  // 批量操作优化
  async batchGet(keys: string[]): Promise<any[]> {
    try {
      if (!this.connected) return []
      
      const results = await this.client.mget(keys)
      return results.map((r: string | null) => r ? JSON.parse(r) : null)
    } catch (error) {
      console.error('Batch get failed:', error)
      return []
    }
  }
  
  // 使用Lua脚本实现原子操作
  async getOrSet(key: string, fetchData: () => Promise<any>, ttl: number = 300): Promise<any> {
    const luaScript = `
      local cached = redis.call('GET', KEYS[1])
      if cached then
        return cached
      end
      return nil
    `
    
    try {
      const cached = await this.client.eval(luaScript, 1, key)
      if (cached) {
        return JSON.parse(cached)
      }
      
      // 获取新数据并缓存
      const data = await fetchData()
      await this.cacheQueryResult(key, data, ttl)
      
      return data
    } catch (error) {
      console.error('Get or set failed:', error)
      throw error
    }
  }
}

// 导出单例实例
export const cacheManager = CacheManager.getInstance()

// 定期清理过期缓存
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    cacheManager.cleanupExpiredCache()
  }, 300000) // 每5分钟清理一次
}