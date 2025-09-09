import { createClient } from 'redis'

// Redis客户端
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
})

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err)
})

// 连接Redis
export async function connectRedis(): Promise<void> {
  if (!redisClient.isOpen) {
    await redisClient.connect()
  }
}

// 获取缓存数据
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    await connectRedis()
    const data = await redisClient.get(key)
    return data ? JSON.parse(data) as T : null
  } catch (error) {
    console.error('Redis get error:', error)
    return null
  }
}

// 设置缓存数据
export async function setCachedData(key: string, data: unknown, expireInSeconds: number = 300): Promise<void> {
  try {
    await connectRedis()
    await redisClient.setEx(key, expireInSeconds, JSON.stringify(data))
  } catch (error) {
    console.error('Redis set error:', error)
  }
}

// 删除缓存数据
export async function deleteCachedData(key: string): Promise<void> {
  try {
    await connectRedis()
    await redisClient.del(key)
  } catch (error) {
    console.error('Redis delete error:', error)
  }
}

// 生成缓存key
export function generateCacheKey(fileId: string, type: string): string {
  return `adx:analytics:${fileId}:${type}`
}

// 关闭Redis连接
export async function closeRedis(): Promise<void> {
  if (redisClient.isOpen) {
    await redisClient.quit()
  }
}