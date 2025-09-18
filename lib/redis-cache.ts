import { createClient } from 'redis'

// 可选启用的 Redis 客户端（无可用 URL 或连接失败时自动降级为 no-op）
const redisUrl = process.env.REDIS_URL || ''
const redisClient = redisUrl
  ? createClient({
      url: redisUrl,
      socket: {
        // 明确设置连接超时与不自动重连，避免报错刷屏
        connectTimeout: Number(process.env.REDIS_CONNECT_TIMEOUT || 1000),
        reconnectStrategy: () => 0,
      },
    })
  : null

let redisDisabled = !redisUrl

let redisErrorLogged = false
if (redisClient) {
  redisClient.on('error', (err) => {
    if (redisDisabled) return // 降级后不再输出错误
    if (!redisErrorLogged) {
      console.error('Redis Client Error:', err)
      redisErrorLogged = true
    }
  })
}

async function connectWithTimeout(ms: number): Promise<void> {
  if (!redisClient) return
  if (redisClient.isOpen) return
  await Promise.race([
    redisClient.connect(),
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error('REDIS_CONNECT_TIMEOUT')), ms)),
  ])
}

// 连接Redis（失败自动降级）
export async function connectRedis(): Promise<void> {
  if (redisDisabled || !redisClient) return
  try {
    await connectWithTimeout(Number(process.env.REDIS_CONNECT_TIMEOUT || 1000))
  } catch (e) {
    console.warn('[redis-cache] 连接失败，已降级为本地 no-op 缓存。原因：', (e as Error)?.message)
    redisDisabled = true
    try { await redisClient?.disconnect() } catch {}
    try { redisClient?.removeAllListeners('error') } catch {}
  }
}

// 获取缓存数据
export async function getCachedData<T>(key: string): Promise<T | null> {
  try {
    if (redisDisabled || !redisClient) return null
    await connectRedis()
    const data = await redisClient.get(key)
    return data ? JSON.parse(data.toString()) as T : null
  } catch (error) {
    console.error('Redis get error:', error)
    return null
  }
}

// 设置缓存数据
export async function setCachedData(key: string, data: unknown, expireInSeconds: number = 300): Promise<void> {
  try {
    if (redisDisabled || !redisClient) return
    await connectRedis()
    await redisClient.setEx(key, expireInSeconds, JSON.stringify(data))
  } catch (error) {
    console.error('Redis set error:', error)
  }
}

// 删除缓存数据
export async function deleteCachedData(key: string): Promise<void> {
  try {
    if (redisDisabled || !redisClient) return
    await connectRedis()
    await redisClient.del(key)
  } catch (error) {
    console.error('Redis delete error:', error)
  }
}

// 按前缀批量删除（使用SCAN避免阻塞）
export async function deleteByPrefix(prefix: string): Promise<number> {
  try {
    if (redisDisabled || !redisClient) return 0
    await connectRedis()
    let cursor = 0
    let count = 0
    do {
      const res = await (redisClient as any).scan(cursor, { MATCH: `${prefix}*`, COUNT: 100 })
      cursor = res.cursor
      const keys: string[] = res.keys || res[1] || []
      if (keys.length) {
        await redisClient.del(keys)
        count += keys.length
      }
    } while (cursor !== 0)
    return count
  } catch (error) {
    console.error('Redis deleteByPrefix error:', error)
    return 0
  }
}

// 生成缓存key
export function generateCacheKey(fileId: string, type: string): string {
  return `adx:analytics:${fileId}:${type}`
}

// 关闭Redis连接
export async function closeRedis(): Promise<void> {
  if (redisClient && redisClient.isOpen) {
    await redisClient.quit()
  }
}
