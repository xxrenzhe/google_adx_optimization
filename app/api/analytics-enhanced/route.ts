import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentSession } from '@/lib/session'
import { createClient } from 'redis'

// Redis connection manager (same as in data route)
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
        
        await this.instance.ping()
      } catch (error) {
        console.error('Redis connection failed:', error)
        this.instance = null
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
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Get session info
    const sessionInfo = await getSessionInfo(session.id, redis)
    if (!sessionInfo) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    // Generate cache key
    const cacheKey = `enhanced-analytics:${session.id}:${startDate || 'all'}:${endDate || 'all'}:${new Date().toISOString().slice(0, 10)}`
    
    // Try cache first
    const cached = await redis.get(cacheKey)
    if (cached) {
      return NextResponse.json(JSON.parse(cached))
    }
    
    // Validate date range
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      const daysDiff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
      
      if (daysDiff > 90) {
        return NextResponse.json(
          { error: 'Date range cannot exceed 90 days for enhanced analytics' },
          { status: 400 }
        )
      }
    }

    // Build where conditions
    const whereConditions = []
    const params: any[] = []
    
    if (startDate && endDate) {
      whereConditions.push(`dataDate BETWEEN $${params.length + 1} AND $${params.length + 2}`)
      params.push(startDate, endDate)
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    // Set timeout for long-running queries
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Enhanced analytics timeout')), 60000) // 60 second timeout
    })

    // Execute all analytics queries in parallel
    const analyticsPromise = Promise.all([
      // 1. Advertiser Value Analysis
      prisma.$queryRawUnsafe(`
        SELECT 
          advertiser,
          domain,
          AVG(ecpm) as avg_ecpm,
          AVG(ctr) as avg_ctr,
          AVG(fillRate) as avg_fillRate,
          AVG(viewabilityRate) as avg_viewabilityRate,
          SUM(revenue) as total_revenue,
          SUM(impressions) as total_impressions,
          SUM(clicks) as total_clicks,
          COUNT(*) as record_count
        FROM ${sessionInfo.tempTableName}
        ${whereClause}
        GROUP BY advertiser, domain
        ORDER BY total_revenue DESC
        LIMIT 20
      `, ...params),
      
      // 2. Device-Browser Performance Matrix
      prisma.$queryRawUnsafe(`
        SELECT 
          device,
          browser,
          AVG(ecpm) as avg_ecpm,
          AVG(ctr) as avg_ctr,
          AVG(fillRate) as avg_fillRate,
          SUM(revenue) as total_revenue,
          SUM(impressions) as total_impressions,
          COUNT(*) as record_count
        FROM ${sessionInfo.tempTableName}
        ${whereClause}
        AND device IS NOT NULL AND browser IS NOT NULL
        GROUP BY device, browser
        ORDER BY total_revenue DESC
      `, ...params),
      
      // 3. Ad Unit Performance Analysis
      prisma.$queryRawUnsafe(`
        SELECT 
          adFormat,
          adUnit,
          AVG(ecpm) as avg_ecpm,
          AVG(ctr) as avg_ctr,
          AVG(fillRate) as avg_fillRate,
          SUM(revenue) as total_revenue,
          SUM(impressions) as total_impressions,
          COUNT(*) as record_count
        FROM ${sessionInfo.tempTableName}
        ${whereClause}
        AND adFormat IS NOT NULL AND adUnit IS NOT NULL
        GROUP BY adFormat, adUnit
        ORDER BY avg_ecpm DESC
        LIMIT 50
      `, ...params),
      
      // 4. Geographic Performance
      prisma.$queryRawUnsafe(`
        SELECT 
          country,
          COUNT(DISTINCT website) as unique_websites,
          SUM(revenue) as total_revenue,
          AVG(ecpm) as avg_ecpm,
          SUM(impressions) as total_impressions,
          AVG(fillRate) as avg_fillRate
        FROM ${sessionInfo.tempTableName}
        ${whereClause}
        AND country IS NOT NULL
        GROUP BY country
        ORDER BY total_revenue DESC
        LIMIT 20
      `, ...params),
      
      // 5. Performance Distribution
      prisma.$queryRawUnsafe(`
        SELECT 
          CASE 
            WHEN ecpm < 1 THEN '< $1'
            WHEN ecpm < 5 THEN '$1-$5'
            WHEN ecpm < 10 THEN '$5-$10'
            WHEN ecpm < 20 THEN '$10-$20'
            ELSE '> $20'
          END as ecpm_range,
          COUNT(*) as count,
          AVG(revenue) as avg_revenue,
          SUM(impressions) as total_impressions
        FROM ${sessionInfo.tempTableName}
        ${whereClause}
        GROUP BY ecpm_range
        ORDER BY ecpm_range
      `, ...params),
      
      // 6. Time-based Analysis
      prisma.$queryRawUnsafe(`
        SELECT 
          EXTRACT(DOW FROM dataDate) as day_of_week,
          AVG(revenue) as avg_revenue,
          AVG(ecpm) as avg_ecpm,
          AVG(fillRate) as avg_fillRate,
          SUM(impressions) as total_impressions
        FROM ${sessionInfo.tempTableName}
        ${whereClause}
        GROUP BY day_of_week
        ORDER BY day_of_week
      `, ...params)
    ])

    // Execute with timeout
    const results = await Promise.race([
      analyticsPromise,
      timeoutPromise
    ]) as any[][]

    // Process results
    const response = {
      advertiserAnalysis: results[0].map(item => ({
        advertiser: item.advertiser || 'Unknown',
        domain: item.domain || 'Unknown',
        avgEcpm: Number(item.avg_ecpm || 0),
        avgCtr: Number(item.avg_ctr || 0),
        avgFillRate: Number(item.avg_fillRate || 0),
        avgViewabilityRate: Number(item.avg_viewabilityRate || 0),
        totalRevenue: Number(item.total_revenue || 0),
        totalImpressions: Number(item.total_impressions || 0),
        totalClicks: Number(item.total_clicks || 0),
        recordCount: Number(item.record_count || 0)
      })),
      
      deviceBrowserMatrix: results[1].map(item => ({
        device: item.device || 'Unknown',
        browser: item.browser || 'Unknown',
        avgEcpm: Number(item.avg_ecpm || 0),
        avgCtr: Number(item.avg_ctr || 0),
        avgFillRate: Number(item.avg_fillRate || 0),
        totalRevenue: Number(item.total_revenue || 0),
        totalImpressions: Number(item.total_impressions || 0),
        recordCount: Number(item.record_count || 0)
      })),
      
      adUnitAnalysis: results[2].map(item => ({
        adFormat: item.adFormat || 'Unknown',
        adUnit: item.adUnit || 'Unknown',
        avgEcpm: Number(item.avg_ecpm || 0),
        avgCtr: Number(item.avg_ctr || 0),
        avgFillRate: Number(item.avg_fillRate || 0),
        totalRevenue: Number(item.total_revenue || 0),
        totalImpressions: Number(item.total_impressions || 0),
        recordCount: Number(item.record_count || 0)
      })),
      
      geographicAnalysis: results[3].map(item => ({
        country: item.country || 'Unknown',
        uniqueWebsites: Number(item.unique_websites || 0),
        totalRevenue: Number(item.total_revenue || 0),
        avgEcpm: Number(item.avg_ecpm || 0),
        totalImpressions: Number(item.total_impressions || 0),
        avgFillRate: Number(item.avg_fillRate || 0)
      })),
      
      performanceDistribution: results[4].map(item => ({
        ecpmRange: item.ecpm_range,
        count: Number(item.count || 0),
        avgRevenue: Number(item.avg_revenue || 0),
        totalImpressions: Number(item.total_impressions || 0)
      })),
      
      timeAnalysis: results[5].map(item => ({
        dayOfWeek: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][Number(item.day_of_week)],
        avgRevenue: Number(item.avg_revenue || 0),
        avgEcpm: Number(item.avg_ecpm || 0),
        avgFillRate: Number(item.avg_fillRate || 0),
        totalImpressions: Number(item.total_impressions || 0)
      })),
      
      meta: {
        processingMethod: 'direct',
        warning: sessionInfo.recordCount > 500000 ? '数据量较大，分析结果基于优化的查询算法' : undefined
      }
    }

    // Cache the result for 15 minutes (longer cache for complex analytics)
    try {
      await redis.setEx(cacheKey, 900, JSON.stringify(response))
    } catch (error) {
      console.error('Redis set failed:', error)
    }

    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Enhanced analytics error:', error)
    
    if (error instanceof Error && (error instanceof Error ? error.message : String(error)) === 'Enhanced analytics timeout') {
      return NextResponse.json(
        { error: 'Analysis timeout, please try a smaller date range' },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch enhanced analytics' },
      { status: 500 }
    )
  }
}

async function getSessionInfo(sessionId: string, redis: any) {
  try {
    const cached = await redis.get(`session:${sessionId}`)
    if (cached) {
      return JSON.parse(cached)
    }
  } catch (error) {
    console.error('Redis get session failed:', error)
  }
  
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