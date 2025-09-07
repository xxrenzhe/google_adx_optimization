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
    const days = parseInt(searchParams.get('days') || '30')
    
    // Get session info
    const sessionInfo = await getSessionInfo(session.id, redis)
    if (!sessionInfo) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    // Generate cache key
    const cacheKey = `predictive-analytics:${session.id}:${days}:${new Date().toISOString().slice(0, 10)}`
    
    // Try cache first
    const cached = await redis.get(cacheKey)
    if (cached) {
      return NextResponse.json(JSON.parse(cached))
    }
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    
    // Set timeout for predictive analytics
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Predictive analytics timeout')), 45000)
    })
    
    // Execute predictive analytics queries
    const analyticsPromise = Promise.all([
      // Get daily revenue data
      prisma.$queryRawUnsafe(`
        SELECT 
          dataDate::date as date,
          SUM(revenue) as total_revenue,
          AVG(ecpm) as avg_ecpm
        FROM ${sessionInfo.tempTableName}
        WHERE dataDate >= $1
        GROUP BY dataDate::date
        ORDER BY dataDate
      `, cutoffDate.toISOString().split('T')[0]),
      
      // Get pricing data for predictions
      prisma.$queryRawUnsafe(`
        SELECT 
          country,
          device,
          adFormat,
          AVG(ecpm) as avg_ecpm,
          COUNT(*) as record_count
        FROM ${sessionInfo.tempTableName}
        WHERE dataDate >= $1
          AND ecpm IS NOT NULL
          AND country IS NOT NULL
          AND device IS NOT NULL
          AND adFormat IS NOT NULL
        GROUP BY country, device, adFormat
        ORDER BY avg_ecpm DESC
        LIMIT 20
      `, cutoffDate.toISOString().split('T')[0]),
      
      // Get growth opportunities by country
      prisma.$queryRawUnsafe(`
        SELECT 
          country,
          AVG(ecpm) as avg_ecpm,
          SUM(revenue) as total_revenue,
          COUNT(DISTINCT website) as website_count,
          AVG(fillRate) as avg_fillRate
        FROM ${sessionInfo.tempTableName}
        WHERE dataDate >= $1
          AND country IS NOT NULL
        GROUP BY country
        HAVING COUNT(DISTINCT website) > 1
        ORDER BY avg_ecpm DESC
        LIMIT 10
      `, cutoffDate.toISOString().split('T')[0]),
      
      // Get device performance trends
      prisma.$queryRawUnsafe(`
        SELECT 
          device,
          EXTRACT(DOW FROM dataDate) as day_of_week,
          AVG(ecpm) as avg_ecpm,
          AVG(fillRate) as avg_fillRate,
          SUM(revenue) as total_revenue
        FROM ${sessionInfo.tempTableName}
        WHERE dataDate >= $1
          AND device IS NOT NULL
        GROUP BY device, day_of_week
        ORDER BY device, day_of_week
      `, cutoffDate.toISOString().split('T')[0])
    ])
    
    // Execute with timeout
    const results = await Promise.race([
      analyticsPromise,
      timeoutPromise
    ]) as any[][]
    
    // Process results
    const dailyRevenue = results[0]
    const pricingData = results[1]
    const opportunities = results[2]
    const deviceTrends = results[3]
    
    // Calculate predictions
    const avgRevenue = dailyRevenue.reduce((sum: number, day: any) => sum + Number(day.total_revenue || 0), 0) / dailyRevenue.length
    const recentTrend = calculateTrend(dailyRevenue.slice(-7).map((d: any) => Number(d.total_revenue || 0)))
    
    const predictions = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() + i + 1)
      
      // Apply trend adjustment
      const trendMultiplier = 1 + (recentTrend * 0.1)
      const seasonalMultiplier = getSeasonalMultiplier(date.getDay())
      
      return {
        date: date.toISOString().split('T')[0],
        predicted: avgRevenue * trendMultiplier * seasonalMultiplier,
        confidence: Math.max(0.5, 0.8 - (i * 0.05))
      }
    })
    
    // Detect anomalies
    const revenues = dailyRevenue.map((d: any) => Number(d.total_revenue || 0))
    const mean = revenues.reduce((a: number, b: number) => a + b, 0) / revenues.length
    const stdDev = Math.sqrt(revenues.reduce((sum: number, val: number) => sum + Math.pow(val - mean, 2), 0) / revenues.length)
    
    const anomalies = dailyRevenue
      .filter((day: any) => {
        const revenue = Number(day.total_revenue || 0)
        const zScore = Math.abs(revenue - mean) / (stdDev || 1)
        return zScore > 2
      })
      .map((day: any) => ({
        date: day.date,
        actual: Number(day.total_revenue || 0),
        expected: mean,
        severity: Math.abs(Number(day.total_revenue || 0) - mean) / (stdDev || 1) > 3 ? 'HIGH' : 'MEDIUM'
      }))
    
    // Generate insights
    const insights = generateInsights(dailyRevenue, pricingData, opportunities, deviceTrends)
    
    const response = {
      predictions,
      anomalies,
      insights,
      topOpportunities: opportunities.slice(0, 5).map((item: any) => ({
        country: item.country,
        avgEcpm: Number(item.avg_ecpm || 0),
        totalRevenue: Number(item.total_revenue || 0),
        websiteCount: Number(item.website_count || 0),
        avgFillRate: Number(item.avg_fillRate || 0)
      })),
      pricingTrends: pricingData.slice(0, 10).map((item: any) => ({
        country: item.country,
        device: item.device,
        adFormat: item.adFormat,
        avgEcpm: Number(item.avg_ecpm || 0),
        recordCount: Number(item.record_count || 0)
      })),
      meta: {
        processingMethod: 'direct',
        dataPoints: dailyRevenue.length,
        warning: sessionInfo.recordCount > 500000 ? '基于优化的查询算法进行预测分析' : undefined
      }
    }
    
    // Cache for 30 minutes (predictions change frequently)
    try {
      await redis.setEx(cacheKey, 1800, JSON.stringify(response))
    } catch (error) {
      console.error('Redis set failed:', error)
    }
    
    return NextResponse.json(response)
    
  } catch (error) {
    console.error('Predictive analytics error:', error)
    
    if (error instanceof Error && error.message === 'Predictive analytics timeout') {
      return NextResponse.json(
        { error: 'Prediction timeout, please try with a smaller time range' },
        { status: 504 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to generate predictions' },
      { status: 500 }
    )
  }
}

function calculateTrend(values: number[]): number {
  if (values.length < 2) return 0
  
  const n = values.length
  const sumX = (n * (n - 1)) / 2
  const sumY = values.reduce((a, b) => a + b, 0)
  const sumXY = values.reduce((sum, y, x) => sum + x * y, 0)
  const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6
  
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
  return slope / (sumY / n) // Normalize by average
}

function getSeasonalMultiplier(dayOfWeek: number): number {
  // Simple seasonal adjustment based on day of week
  const multipliers = [0.9, 0.95, 1.0, 1.0, 1.05, 1.1, 0.85] // Sun-Sat
  return multipliers[dayOfWeek]
}

function generateInsights(dailyRevenue: any[], pricingData: any[], opportunities: any[], deviceTrends: any[]): string[] {
  const insights: string[] = []
  
  // Revenue trend insight
  const recentAvg = dailyRevenue.slice(-7).reduce((sum: number, day: any) => sum + Number(day.total_revenue || 0), 0) / 7
  const overallAvg = dailyRevenue.reduce((sum: number, day: any) => sum + Number(day.total_revenue || 0), 0) / dailyRevenue.length
  
  if (recentAvg > overallAvg * 1.1) {
    insights.push('近期收入呈上升趋势，建议继续当前策略')
  } else if (recentAvg < overallAvg * 0.9) {
    insights.push('近期收入有所下降，建议检查广告配置')
  }
  
  // Top performing country insight
  if (opportunities.length > 0) {
    const topCountry = opportunities[0]
    insights.push(`${topCountry.country}地区表现最佳，eCPM达到$${topCountry.avg_ecpm.toFixed(2)}`)
  }
  
  // Device performance insight
  const devicePerformance = deviceTrends.reduce((acc: any, item: any) => {
    if (!acc[item.device]) {
      acc[item.device] = { totalRevenue: 0, count: 0 }
    }
    acc[item.device].totalRevenue += Number(item.total_revenue || 0)
    acc[item.device].count += 1
    return acc
  }, {})
  
  const bestDevice = Object.entries(devicePerformance)
    .map(([device, data]: [string, any]) => ({
      device,
      avgRevenue: data.totalRevenue / data.count
    }))
    .sort((a, b) => b.avgRevenue - a.avgRevenue)[0]
  
  if (bestDevice) {
    insights.push(`${bestDevice.device}设备平均收入最高，建议优化该设备广告展示`)
  }
  
  return insights
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