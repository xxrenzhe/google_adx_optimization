import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentSession } from '@/lib/session'
import { createClient } from 'redis'

// Redis client for caching
const redis = createClient({
  url: process.env.REDIS_URL || '',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
})

export async function GET(request: NextRequest) {
  try {
    const session = getCurrentSession(request)
    
    if (!session) {
      return NextResponse.json({ error: 'No data uploaded yet' }, { status: 404 })
    }
    
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Get session info
    const sessionInfo = await getSessionInfo(session.id)
    if (!sessionInfo) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    // Generate cache key
    const cacheKey = `analytics:${session.id}:${startDate || 'all'}:${endDate || 'all'}:${new Date().toISOString().slice(0, 10)}`
    
    // Try to get from cache first
    const cached = await redis.get(cacheKey)
    if (cached) {
      return NextResponse.json(JSON.parse(cached))
    }
    
    // Build where conditions
    const whereConditions = []
    const params: any[] = []
    
    if (startDate && endDate) {
      whereConditions.push(`dataDate BETWEEN $${params.length + 1} AND $${params.length + 2}`)
      params.push(startDate, endDate)
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    
    // Get all analytics data in a single query for better performance
    const analyticsQuery = `
      WITH revenue_data AS (
        SELECT 
          SUM(revenue) as total_revenue,
          SUM(impressions) as total_impressions,
          SUM(requests) as total_requests,
          COUNT(*) as record_count
        FROM ${sessionInfo.tempTableName}
        ${whereClause}
      ),
      date_revenue AS (
        SELECT 
          dataDate::date as date,
          SUM(revenue) as daily_revenue
        FROM ${sessionInfo.tempTableName}
        ${whereClause}
        GROUP BY dataDate::date
        ORDER BY date
      ),
      country_revenue AS (
        SELECT 
          COALESCE(country, 'Unknown') as country,
          SUM(revenue) as country_revenue
        FROM ${sessionInfo.tempTableName}
        ${whereClause}
        GROUP BY country
        ORDER BY country_revenue DESC
        LIMIT 10
      ),
      device_revenue AS (
        SELECT 
          COALESCE(device, 'Unknown') as device,
          SUM(revenue) as device_revenue
        FROM ${sessionInfo.tempTableName}
        ${whereClause}
        GROUP BY device
        ORDER BY device_revenue DESC
      ),
      fill_rate_stats AS (
        SELECT 
          AVG(CASE WHEN fillRate IS NOT NULL THEN fillRate ELSE NULL END) as avg_fill_rate,
          COUNT(CASE WHEN fillRate IS NOT NULL THEN 1 END) as fill_rate_count
        FROM ${sessionInfo.tempTableName}
        ${whereClause}
      )
      SELECT * FROM revenue_data, date_revenue, country_revenue, device_revenue, fill_rate_stats
    `
    
    const result = await prisma.$queryRawUnsafe(analyticsQuery, ...params)
    const data = (result as any[])[0] || {}
    
    // Calculate fill rate distribution
    const fillRateQuery = `
      SELECT 
        CASE 
          WHEN fillRate < 20 THEN '0-20%'
          WHEN fillRate < 40 THEN '20-40%'
          WHEN fillRate < 60 THEN '40-60%'
          WHEN fillRate < 80 THEN '60-80%'
          ELSE '80-100%'
        END as range,
        COUNT(*) as count
      FROM ${sessionInfo.tempTableName}
      ${whereClause}
      AND fillRate IS NOT NULL
      GROUP BY range
      ORDER BY range
    `
    
    const fillRateDist = await prisma.$queryRawUnsafe(fillRateQuery, ...params)
    
    // Transform data
    const responseData = {
      summary: {
        totalRevenue: Number(data.total_revenue || 0),
        totalImpressions: Number(data.total_impressions || 0),
        totalRequests: Number(data.total_requests || 0),
        avgFillRate: Number(data.avg_fill_rate || 0),
        arpu: data.total_requests ? (Number(data.total_revenue || 0) / Number(data.total_requests)) * 1000 : 0
      },
      charts: {
        revenueByDate: Array.isArray(data.date) ? data.date.map((item: any, index: number) => ({
          date: new Date(item.date).toISOString().split('T')[0],
          revenue: Number(data.daily_revenue?.[index] || 0)
        })) : [],
        revenueByCountry: Array.isArray(data.country) ? data.country.map((item: any, index: number) => ({
          country: item.country || 'Unknown',
          revenue: Number(data.country_revenue?.[index] || 0)
        })) : [],
        revenueByDevice: Array.isArray(data.device) ? data.device.map((item: any, index: number) => ({
          device: item.device || 'Unknown',
          revenue: Number(data.device_revenue?.[index] || 0)
        })) : [],
        fillRateDistribution: (fillRateDist as any[]).map(item => ({
          range: item.range,
          count: Number(item.count)
        }))
      },
      meta: {
        recordCount: Number(data.record_count || 0),
        processingMethod: 'direct',
        warning: Number(data.record_count || 0) > 500000 ? '数据量较大，已使用优化的查询算法' : undefined
      }
    }
    
    // Cache the result for 10 minutes
    await redis.setEx(cacheKey, 600, JSON.stringify(responseData))
    
    return NextResponse.json(responseData)
    
  } catch (error) {
    console.error('Analytics fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}

async function getSessionInfo(sessionId: string) {
  // Try to get from cache first
  const cached = await redis.get(`session:${sessionId}`)
  if (cached) {
    return JSON.parse(cached)
  }
  
  // Get from database
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
    await redis.setEx(`session:${sessionId}`, 3600, JSON.stringify(session))
  }
  
  return session
}