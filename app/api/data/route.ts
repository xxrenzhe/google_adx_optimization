import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentSession } from '@/lib/session'
import { createClient } from 'redis'

// Redis connection manager
class RedisManager {
  private static instance: any = null
  
  static async getClient() {
    if (!this.instance) {
      try {
        this.instance = createClient({
          url: process.env.REDIS_URL || '',
          socket: {
            reconnectStrategy: (retries) => Math.min(retries * 50, 500),
            timeout: 5000
          }
        })
        
        // Test connection
        await this.instance.ping()
      } catch (error) {
        console.error('Redis connection failed:', error)
        this.instance = null
        // Return a mock Redis client for fallback
        return {
          get: async () => null,
          set: async () => {},
          setex: async () => {},
          del: async () => {},
          keys: async () => []
        }
      }
    }
    return this.instance
  }
}

export async function GET(request: NextRequest) {
  const redis = await RedisManager.getClient()
  
  try {
    const session = getCurrentSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No data uploaded yet' }, { status: 404 })
    }
    
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 1000)
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'dataDate'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    // Get session info from cache or database
    let sessionInfo = await getSessionInfo(session.id, redis)
    if (!sessionInfo) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    // Validate cursor if provided
    if (cursor) {
      const cursorExists = await validateCursor(cursor, sessionInfo.tempTableName)
      if (!cursorExists) {
        return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
      }
    }
    
    // Build query conditions
    const whereConditions = []
    const params: any[] = []
    
    if (search) {
      whereConditions.push(`(
        website ILIKE $${params.length + 1} OR
        country ILIKE $${params.length + 2} OR
        domain ILIKE $${params.length + 3} OR
        device ILIKE $${params.length + 4}
      )`)
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`)
    }
    
    if (cursor) {
      whereConditions.push(`id > $${params.length + 1}`)
      params.push(cursor)
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    
    // Add query hints for large tables
    const queryHints = sessionInfo.recordCount > 500000 ? '/*+ MAX_EXECUTION_TIME(60000) */' : ''
    
    // Generate cache key
    const cacheKey = `data:${session.id}:${cursor || 'first'}:${limit}:${search}:${sortBy}:${sortOrder}`
    
    // Try to get from cache first with timeout
    let cached
    try {
      cached = await redis.get(cacheKey)
    } catch (error) {
      console.error('Redis get failed:', error)
      cached = null
    }
    
    if (cached) {
      return NextResponse.json(JSON.parse(cached))
    }
    
    // Set timeout for database operations
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Database query timeout')), 60000) // Increased to 60s
    })
    
    // Build the query with additional safety checks
    const offset = params.length + 1
    const query = `
      ${queryHints}
      SELECT 
        id,
        dataDate,
        website,
        country,
        adFormat,
        adUnit,
        advertiser,
        domain,
        device,
        browser,
        requests,
        impressions,
        clicks,
        ctr,
        ecpm,
        revenue,
        viewableImpressions,
        viewabilityRate,
        measurableImpressions,
        fillRate,
        arpu
      FROM ${sessionInfo.tempTableName}
      ${whereClause}
      ORDER BY ${sortBy} ${sortOrder}
      LIMIT $${offset}
    `
    
    // Get count query
    const countQuery = `
      ${queryHints}
      SELECT COUNT(*) as total
      FROM ${sessionInfo.tempTableName}
      ${whereClause.replace(/id > \$\d+ AND /, '')}
    `
    
    // Execute queries with timeout
    const [data, countResult] = await Promise.race([
      Promise.all([
        prisma.$queryRawUnsafe(query, ...params, limit),
        prisma.$queryRawUnsafe(countQuery, ...params.slice(0, cursor ? params.length - 1 : params.length))
      ]),
      timeoutPromise
    ]) as [any[], any[]]
    
    // Transform BigInt values to regular numbers
    const transformedData = data.map(record => ({
      ...record,
      requests: record.requests ? Number(record.requests) : null,
      impressions: record.impressions ? Number(record.impressions) : null,
      clicks: record.clicks ? Number(record.clicks) : null,
      viewableImpressions: record.viewableImpressions ? Number(record.viewableImpressions) : null,
      measurableImpressions: record.measurableImpressions ? Number(record.measurableImpressions) : null
    }))
    
    const totalCount = Number(countResult[0]?.total || 0)
    
    const response = {
      data: transformedData,
      pagination: {
        nextCursor: transformedData.length === limit ? transformedData[transformedData.length - 1].id : null,
        totalCount,
        hasMore: transformedData.length === limit,
        limit
      }
    }
    
    // Cache the result for 5 minutes
    try {
      await redis.setEx(cacheKey, 300, JSON.stringify(response))
    } catch (error) {
      console.error('Redis set failed:', error)
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Data fetch error:', error)
    
    if (error instanceof Error && error.message === 'Database query timeout') {
      return NextResponse.json(
        { error: 'Query timeout, please try again' },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}

async function getSessionInfo(sessionId: string, redis: any) {
  // Try to get from cache first
  try {
    const cached = await redis.get(`session:${sessionId}`)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (error) {
    console.error('Redis get session failed:', error)
  }
  
  // Get from database
  try {
    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        filename: true,
        recordCount: true,
        tempTableName: true,
        status: true
      }
    })
    
    if (session) {
      // Cache the session info
      try {
        await redis.setEx(`session:${sessionId}`, 3600, JSON.stringify(session))
      } catch (error) {
        console.error('Redis set session failed:', error)
      }
    }
    
    return session
  } catch (error) {
    console.error('Database get session failed:', error)
    return null
  }
}

async function validateCursor(cursor: string, tempTableName: string) {
  try {
    const result = await prisma.$queryRawUnsafe(
      'SELECT 1 FROM ' + tempTableName + ' WHERE id = $1 LIMIT 1',
      cursor
    )
    return (result as any[]).length > 0
  } catch (error) {
    console.error('Cursor validation failed:', error)
    return false
  }
}