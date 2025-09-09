import { createClient } from 'redis'

// Redis客户端
const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
})

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err)
})

// 连接Redis
export async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect()
  }
}

// 获取缓存数据
export async function getCachedData(key: string) {
  try {
    await connectRedis()
    const data = await redisClient.get(key)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Redis get error:', error)
    return null
  }
}

// 设置缓存数据
export async function setCachedData(key: string, data: any, expireInSeconds: number = 300) {
  try {
    await connectRedis()
    await redisClient.setEx(key, expireInSeconds, JSON.stringify(data))
  } catch (error) {
    console.error('Redis set error:', error)
  }
}

// 删除缓存数据
export async function deleteCachedData(key: string) {
  try {
    await connectRedis()
    await redisClient.del(key)
  } catch (error) {
    console.error('Redis delete error:', error)
  }
}

// 生成缓存key
export function generateCacheKey(fileId: string, type: string) {
  return `adx:analytics:${fileId}:${type}`
}

// 关闭Redis连接
export async function closeRedis() {
  if (redisClient.isOpen) {
    await redisClient.quit()
  }
}