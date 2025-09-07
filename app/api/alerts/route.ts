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

interface Alert {
  id: string
  type: 'warning' | 'success' | 'error' | 'info'
  title: string
  message: string
  data?: any
}

interface Recommendation {
  id: string
  type: 'website' | 'country' | 'device' | 'format' | 'combination' | 'competitive' | 'predictive' | 'timing' | 'pricing'
  title: string
  message: string
  impact: 'high' | 'medium' | 'low'
  data: any
}

export async function GET(request: NextRequest) {
  const redis = await RedisManager.getClient()
  
  try {
    const session = getCurrentSession(request)
    if (!session) {
      return NextResponse.json({ 
        alerts: [],
        recommendations: []
      })
    }
    
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7')
    
    // Get session info
    const sessionInfo = await getSessionInfo(session.id, redis)
    if (!sessionInfo) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    // Generate cache key
    const cacheKey = `alerts:${session.id}:${days}:${new Date().toISOString().slice(0, 10)}`
    
    // Try cache first
    const cached = await redis.get(cacheKey)
    if (cached) {
      return NextResponse.json(JSON.parse(cached))
    }
    
    const alerts: Alert[] = []
    const recommendations: Recommendation[] = []

    // Get recent data for analysis
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // 1. Low Fill Rate Alerts - 降低阈值到20%
    const lowFillRateData = await prisma.$queryRawUnsafe(`
      SELECT 
        website,
        AVG(fillRate) as avg_fillRate,
        AVG(revenue) as avg_revenue,
        COUNT(*) as count
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
        AND fillRate < 20
      GROUP BY website
    `, startDate.toISOString().split('T')[0]) as any[]

    lowFillRateData.forEach((item, index) => {
      alerts.push({
        id: `low-fill-${index}`,
        type: 'warning',
        title: '低填充率警告',
        message: `${item.website} 的平均填充率仅为 ${Number(item.avg_fillRate || 0).toFixed(2)}%，低于20%警戒线`,
        data: {
          website: item.website,
          avgFillRate: Number(item.avg_fillRate || 0),
          avgRevenue: Number(item.avg_revenue || 0),
          recordCount: Number(item.count || 0)
        }
      })
    })

    // 2. High-value Website Recommendations - 降低阈值到1.2倍
    const topWebsites = await prisma.$queryRawUnsafe(`
      SELECT 
        website,
        AVG(ecpm) as avg_ecpm,
        AVG(revenue) as avg_revenue,
        SUM(revenue) as total_revenue
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
      GROUP BY website
      ORDER BY total_revenue DESC
      LIMIT 10
    `, startDate.toISOString().split('T')[0]) as any[]

    const avgEcpmResult = await prisma.$queryRawUnsafe(`
      SELECT AVG(ecpm) as avg_ecpm
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
        AND ecpm IS NOT NULL
    `, startDate.toISOString().split('T')[0]) as any[]
    
    const avgEcpm = Number(avgEcpmResult[0]?.avg_ecpm || 0)

    topWebsites.forEach((item, index) => {
      if (item.avg_ecpm && avgEcpm > 0 && item.avg_ecpm > avgEcpm * 1.2) {
        recommendations.push({
          id: `high-value-${index}`,
          type: 'website',
          title: '高价值网站推荐',
          message: `${item.website} 的 eCPM ($${item.avg_ecpm.toFixed(2)}) 高于平均水平${((item.avg_ecpm / avgEcpm - 1) * 100).toFixed(1)}%，建议增加广告投放`,
          impact: 'high',
          data: {
            website: item.website,
            avgEcpm: item.avg_ecpm,
            totalRevenue: item.total_revenue,
            aboveAverage: ((item.avg_ecpm - avgEcpm) / avgEcpm * 100).toFixed(1)
          }
        })
      }
    })

    // 3. Country Performance Analysis - 降低收入阈值
    const countryPerformance = await prisma.$queryRawUnsafe(`
      SELECT 
        country,
        AVG(ecpm) as avg_ecpm,
        AVG(fillRate) as avg_fillRate,
        SUM(revenue) as total_revenue
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
        AND country IS NOT NULL
      GROUP BY country
      ORDER BY total_revenue DESC
      LIMIT 15
    `, startDate.toISOString().split('T')[0]) as any[]

    // Find underperforming countries with low fill rate but high potential
    countryPerformance.forEach((item, index) => {
      if (item.avg_fillRate && item.avg_fillRate < 60 && item.total_revenue && item.total_revenue > 10) {
        recommendations.push({
          id: `country-opp-${index}`,
          type: 'country',
          title: '国家市场优化机会',
          message: `${item.country} 填充率较低 (${item.avg_fillRate.toFixed(2)}%) 但有一定收入，建议优化广告配置`,
          impact: 'medium',
          data: {
            country: item.country,
            avgFillRate: item.avg_fillRate,
            avgEcpm: item.avg_ecpm,
            totalRevenue: item.total_revenue
          }
        })
      }
    })

    // 4. Device Type Analysis
    const devicePerformance = await prisma.$queryRawUnsafe(`
      SELECT 
        device,
        AVG(ecpm) as avg_ecpm,
        AVG(fillRate) as avg_fillRate,
        SUM(revenue) as total_revenue
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
        AND device IS NOT NULL
      GROUP BY device
    `, startDate.toISOString().split('T')[0]) as any[]

    // Find best performing device type
    const bestDevice = devicePerformance.reduce((best, current) => {
      if (!best || (current.avg_ecpm && best.avg_ecpm && current.avg_ecpm > best.avg_ecpm)) {
        return current
      }
      return best
    }, null as any)

    if (bestDevice && bestDevice.device) {
      recommendations.push({
        id: 'device-best',
        type: 'device',
        title: '设备类型优化建议',
        message: `${bestDevice.device} 设备表现最佳，eCPM达 $${bestDevice.avg_ecpm?.toFixed(2)}`,
        impact: 'medium',
        data: {
          device: bestDevice.device,
          avgEcpm: bestDevice.avg_ecpm,
          avgFillRate: bestDevice.avg_fillRate,
          totalRevenue: bestDevice.total_revenue
        }
      })
    }

    // 5. Anomaly Detection - Revenue Drop
    const revenueByDay = await prisma.$queryRawUnsafe(`
      SELECT 
        dataDate::date as date,
        SUM(revenue) as total_revenue
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
      GROUP BY dataDate::date
      ORDER BY dataDate::date
    `, startDate.toISOString().split('T')[0]) as any[]

    // Simple anomaly detection - if today's revenue is 50% less than average of last 7 days
    if (revenueByDay.length >= 2) {
      const recentDays = revenueByDay.slice(-7)
      const avgRevenue = recentDays.reduce((sum, day) => sum + (day.total_revenue || 0), 0) / recentDays.length
      const todayRevenue = revenueByDay[revenueByDay.length - 1].total_revenue || 0

      if (todayRevenue < avgRevenue * 0.5) {
        alerts.push({
          id: 'revenue-drop',
          type: 'error',
          title: '收入异常下降',
          message: `今日收入 ($${todayRevenue.toFixed(2)}) 较7日平均值下降 ${((1 - todayRevenue / avgRevenue) * 100).toFixed(1)}%`,
          data: {
            todayRevenue,
            avgRevenue,
            dropPercentage: ((1 - todayRevenue / avgRevenue) * 100).toFixed(1)
          }
        })
      }
    }

    // 6. Ad Format Performance - 降低阈值
    const formatPerformance = await prisma.$queryRawUnsafe(`
      SELECT 
        adFormat,
        AVG(ecpm) as avg_ecpm,
        AVG(fillRate) as avg_fillRate,
        SUM(revenue) as total_revenue
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
        AND adFormat IS NOT NULL
      GROUP BY adFormat
      ORDER BY avg_ecpm DESC
    `, startDate.toISOString().split('T')[0]) as any[]

    formatPerformance.forEach((item, index) => {
      if (item.avg_ecpm && item.avg_ecpm > 5) { // 降低阈值到5
        recommendations.push({
          id: `format-high-${index}`,
          type: 'format',
          title: '广告格式优化建议',
          message: `${item.adFormat} 格式表现良好，eCPM达 $${item.avg_ecpm.toFixed(2)}，建议增加使用比例`,
          impact: item.avg_ecpm > 10 ? 'high' : 'medium',
          data: {
            adFormat: item.adFormat,
            avgEcpm: item.avg_ecpm,
            avgFillRate: item.avg_fillRate,
            totalRevenue: item.total_revenue
          }
        })
      }
    })

    // 7. Device-Browser Combination Analysis - 降低阈值
    const deviceBrowserCombinations = await prisma.$queryRawUnsafe(`
      SELECT 
        device,
        browser,
        AVG(ecpm) as avg_ecpm,
        AVG(fillRate) as avg_fillRate,
        AVG(ctr) as avg_ctr,
        SUM(revenue) as total_revenue,
        SUM(impressions) as total_impressions,
        COUNT(*) as count
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
        AND device IS NOT NULL
        AND browser IS NOT NULL
      GROUP BY device, browser
    `, startDate.toISOString().split('T')[0]) as any[]

    // Find high eCPM but low fill rate combinations
    deviceBrowserCombinations.forEach((item, index) => {
      if (item.avg_ecpm && item.avg_ecpm > 10 && item.avg_fillRate && item.avg_fillRate < 60) {
        recommendations.push({
          id: `combo-opp-${index}`,
          type: 'combination',
          title: '设备-浏览器组合优化机会',
          message: `${item.device} + ${item.browser} 组合eCPM高达 $${item.avg_ecpm.toFixed(2)} 但填充率仅${item.avg_fillRate.toFixed(2)}%`,
          impact: 'high',
          data: {
            device: item.device,
            browser: item.browser,
            avgEcpm: item.avg_ecpm,
            avgFillRate: item.avg_fillRate,
            avgCtr: item.avg_ctr,
            totalRevenue: item.total_revenue
          }
        })
      }
    })

    // 8. Competitive Intelligence Alerts - 降低阈值
    const competitorData = await prisma.$queryRawUnsafe(`
      SELECT 
        advertiser,
        domain,
        AVG(ecpm) as avg_ecpm,
        SUM(revenue) as total_revenue,
        SUM(impressions) as total_impressions
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
        AND advertiser IS NOT NULL
      GROUP BY advertiser, domain
      ORDER BY total_revenue DESC
      LIMIT 15
    `, startDate.toISOString().split('T')[0]) as any[]

    // Analyze competitor strategies
    const topCompetitor = competitorData[0]
    if (topCompetitor && topCompetitor.total_revenue && topCompetitor.total_revenue > 50) {
      // Get countries where top competitor operates
      const competitorCountries = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT country
        FROM ${sessionInfo.tempTableName}
        WHERE dataDate >= $1
          AND advertiser = $2
          AND country IS NOT NULL
      `, startDate.toISOString().split('T')[0], topCompetitor.advertiser) as any[]

      if (competitorCountries.length > 1) {
        recommendations.push({
          id: 'competitive-intel',
          type: 'competitive',
          title: '竞争对手策略分析',
          message: `${topCompetitor.advertiser} 在${competitorCountries.length}个国家运营，收入达$${topCompetitor.total_revenue.toFixed(2)}，建议分析其成功策略`,
          impact: 'medium',
          data: {
            advertiser: topCompetitor.advertiser,
            domain: topCompetitor.domain,
            totalRevenue: topCompetitor.total_revenue,
            avgEcpm: topCompetitor.avg_ecpm,
            countriesCovered: competitorCountries.length,
            countries: competitorCountries.map(c => c.country)
          }
        })
      }
    }

    // 9. Timing Analysis - 时段分析
    const hourlyPerformance = await prisma.$queryRawUnsafe(`
      SELECT 
        dataDate,
        revenue,
        ecpm
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
    `, startDate.toISOString().split('T')[0]) as any[]

    // Analyze hourly patterns
    const hourlyRevenue = Array.from({ length: 24 }, () => ({ total: 0, count: 0 }))
    hourlyPerformance.forEach(record => {
      const hour = new Date(record.dataDate).getHours()
      hourlyRevenue[hour].total += record.revenue || 0
      hourlyRevenue[hour].count += 1
    })

    // Find peak and low performance hours
    const hourlyAvg = hourlyRevenue.map(h => h.count > 0 ? h.total / h.count : 0)
    const validHourlyAvg = hourlyAvg.filter(h => h > 0)
    const peakHour = validHourlyAvg.length > 0 ? hourlyAvg.indexOf(Math.max(...validHourlyAvg)) : -1
    const lowHour = validHourlyAvg.length > 0 ? hourlyAvg.indexOf(Math.min(...validHourlyAvg)) : -1

    if (peakHour >= 0 && lowHour >= 0 && hourlyAvg[peakHour] > hourlyAvg[lowHour] * 2) {
      recommendations.push({
        id: 'timing-optimization',
        type: 'timing',
        title: '时段优化建议',
        message: `${peakHour}:00是高峰时段（平均收入$${hourlyAvg[peakHour].toFixed(2)}），${lowHour}:00是低谷时段，建议调整广告投放策略`,
        impact: 'medium',
        data: {
          peakHour,
          peakRevenue: hourlyAvg[peakHour],
          lowHour,
          lowRevenue: hourlyAvg[lowHour],
          ratio: hourlyAvg[peakHour] / hourlyAvg[lowHour]
        }
      })
    }

    // 10. Trend Analysis (趋势分析)
    const trendStartDate = new Date()
    trendStartDate.setDate(trendStartDate.getDate() - Math.max(30, days * 2))

    const trendData = await prisma.$queryRawUnsafe(`
      SELECT 
        dataDate::date as date,
        SUM(revenue) as total_revenue
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
      GROUP BY dataDate::date
      ORDER BY dataDate::date
    `, trendStartDate.toISOString().split('T')[0]) as any[]

    if (trendData.length > 7) {
      // Calculate 7-day moving averages
      const movingAverages = []
      for (let i = 6; i < trendData.length; i++) {
        const sum = trendData.slice(i - 6, i + 1).reduce((acc, day) => acc + (day.total_revenue || 0), 0)
        movingAverages.push(sum / 7)
      }

      // Detect trends
      const recentTrend = movingAverages.slice(-7)
      const earlierTrend = movingAverages.slice(-14, -7)
      const recentAvg = recentTrend.reduce((a, b) => a + b, 0) / recentTrend.length
      const earlierAvg = earlierTrend.reduce((a, b) => a + b, 0) / earlierTrend.length

      const trendChange = ((recentAvg - earlierAvg) / earlierAvg) * 100

      if (Math.abs(trendChange) > 20) {
        alerts.push({
          id: 'trend-alert',
          type: trendChange > 0 ? 'success' : 'warning',
          title: '收入趋势警报',
          message: `最近7天收入较前期${trendChange > 0 ? '上升' : '下降'}了${Math.abs(trendChange).toFixed(1)}%`,
          data: {
            trendChange: trendChange.toFixed(1),
            recentAvg,
            earlierAvg,
            direction: trendChange > 0 ? 'up' : 'down'
          }
        })
      }
    }

    // 10. Pricing Strategy - 定价策略
    const ecpmDistribution = await prisma.$queryRawUnsafe(`
      SELECT 
        adFormat,
        AVG(ecpm) as avg_ecpm,
        COUNT(*) as count
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
        AND adFormat IS NOT NULL
        AND ecpm IS NOT NULL
      GROUP BY adFormat
    `, startDate.toISOString().split('T')[0]) as any[]

    // Find underpriced formats
    ecpmDistribution.forEach((item, index) => {
      if (item.avg_ecpm && item.avg_ecpm < 3 && item.count > 10) {
        recommendations.push({
          id: `pricing-${index}`,
          type: 'pricing',
          title: '定价策略建议',
          message: `${item.adFormat} 的平均eCPM仅为$${item.avg_ecpm.toFixed(2)}，可能定价过低，建议调整定价策略`,
          impact: 'medium',
          data: {
            adFormat: item.adFormat,
            avgEcpm: item.avg_ecpm,
            impressionCount: item.count
          }
        })
      }
    })

  // 11. Predictive Alerts (预测性提醒)
    // Get eCPM distribution data
    const ecpmData = await prisma.$queryRawUnsafe(`
      SELECT 
        ecpm,
        revenue
      FROM ${sessionInfo.tempTableName}
      WHERE dataDate >= $1
        AND ecpm IS NOT NULL
    `, startDate.toISOString().split('T')[0]) as any[]

    // Analyze eCPM distribution
    const highEcpmRecords = ecpmData.filter(d => d.ecpm && d.ecpm > 20).length
    const totalRecords = ecpmData.length
    const highEcpmRatio = totalRecords > 0 ? (highEcpmRecords / totalRecords) * 100 : 0

    if (highEcpmRatio > 30) {
      recommendations.push({
        id: 'premium-opportunity',
        type: 'predictive',
        title: '高价值广告机会',
        message: `${highEcpmRatio.toFixed(1)}%的广告展示获得高eCPM（>$20），建议优化广告位配置以吸引更多高质量广告`,
        impact: 'high',
        data: {
          highEcpmRatio,
          highEcpmRecords,
          totalRecords,
          potentialRevenueIncrease: ecpmData
            .filter(d => d.ecpm && d.ecpm > 20)
            .reduce((sum, d) => sum + (d.revenue || 0), 0) * 0.2 // 20% potential increase
        }
      })
    }

    const response = {
      alerts: alerts.slice(0, 10), // Limit to top 10 alerts
      recommendations: recommendations.slice(0, 15), // Limit to top 15 recommendations
      meta: {
        processingMethod: 'direct',
        warning: sessionInfo.recordCount > 500000 ? '数据量较大，决策提醒基于优化的查询算法' : undefined
      }
    }
    
    // Cache for 10 minutes (alerts change frequently)
    try {
      await redis.setEx(cacheKey, 600, JSON.stringify(response))
    } catch (error) {
      console.error('Redis set failed:', error)
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error generating alerts:', error)
    return NextResponse.json({ error: 'Failed to generate alerts' }, { status: 500 })
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