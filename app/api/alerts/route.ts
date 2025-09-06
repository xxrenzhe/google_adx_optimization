import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentSession } from '@/lib/session'

interface Alert {
  id: string
  type: 'warning' | 'success' | 'error' | 'info'
  title: string
  message: string
  data?: any
}

interface Recommendation {
  id: string
  type: 'website' | 'country' | 'device' | 'format' | 'combination' | 'competitive' | 'predictive'
  title: string
  message: string
  impact: 'high' | 'medium' | 'low'
  data: any
}

export async function GET(request: NextRequest) {
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
    
    const alerts: Alert[] = []
    const recommendations: Recommendation[] = []

    // Get recent data for analysis
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    // 1. Low Fill Rate Alerts
    const lowFillRateData = await prisma.adReport.groupBy({
      by: ['website'],
      where: {
        sessionId: session.id,
        dataDate: { gte: startDate },
        fillRate: { lt: 30 } // Less than 30% fill rate
      },
      _avg: {
        fillRate: true,
        revenue: true
      },
      _count: true
    })

    // Filter for low fill rate after querying
    const filteredLowFillRate = lowFillRateData.filter(item => (item._avg.fillRate || 0) < 30)

    lowFillRateData.forEach((item, index) => {
      alerts.push({
        id: `low-fill-${index}`,
        type: 'warning',
        title: '低填充率警告',
        message: `${item.website} 的平均填充率仅为 ${item._avg.fillRate?.toFixed(2)}%，低于30%警戒线`,
        data: {
          website: item.website,
          avgFillRate: item._avg.fillRate,
          avgRevenue: item._avg.revenue,
          recordCount: item._count
        }
      })
    })

    // 2. High-value Website Recommendations
    const topWebsites = await prisma.adReport.groupBy({
      by: ['website'],
      where: {
        sessionId: session.id,
        dataDate: { gte: startDate }
      },
      _avg: {
        ecpm: true,
        revenue: true
      },
      _sum: {
        revenue: true
      },
      orderBy: {
        _sum: {
          revenue: 'desc'
        }
      },
      take: 5
    })

    const avgEcpm = await prisma.adReport.aggregate({
      where: {
        sessionId: session.id,
        dataDate: { gte: startDate }
      },
      _avg: {
        ecpm: true
      }
    })

    topWebsites.forEach((item, index) => {
      if (item._avg.ecpm && avgEcpm._avg.ecpm && item._avg.ecpm > avgEcpm._avg.ecpm * 1.5) {
        recommendations.push({
          id: `high-value-${index}`,
          type: 'website',
          title: '高价值网站推荐',
          message: `${item.website} 的 eCPM ($${item._avg.ecpm.toFixed(2)}) 显著高于平均水平，建议增加广告投放`,
          impact: 'high',
          data: {
            website: item.website,
            avgEcpm: item._avg.ecpm,
            totalRevenue: item._sum.revenue,
            aboveAverage: ((item._avg.ecpm - avgEcpm._avg.ecpm!) / avgEcpm._avg.ecpm! * 100).toFixed(1)
          }
        })
      }
    })

    // 3. Country Performance Analysis
    const countryPerformance = await prisma.adReport.groupBy({
      by: ['country'],
      where: {
        sessionId: session.id,
        dataDate: { gte: startDate },
        country: { not: null }
      },
      _avg: {
        ecpm: true,
        fillRate: true
      },
      _sum: {
        revenue: true
      },
      orderBy: {
        _sum: {
          revenue: 'desc'
        }
      },
      take: 10
    })

    // Find underperforming countries with low fill rate but high potential
    countryPerformance.forEach((item, index) => {
      if (item._avg.fillRate && item._avg.fillRate < 50 && item._sum.revenue && item._sum.revenue > 100) {
        recommendations.push({
          id: `country-opp-${index}`,
          type: 'country',
          title: '国家市场优化机会',
          message: `${item.country} 填充率较低 (${item._avg.fillRate.toFixed(2)}%) 但收入潜力可观，建议优化广告配置`,
          impact: 'medium',
          data: {
            country: item.country,
            avgFillRate: item._avg.fillRate,
            avgEcpm: item._avg.ecpm,
            totalRevenue: item._sum.revenue
          }
        })
      }
    })

    // 4. Device Type Analysis
    const devicePerformance = await prisma.adReport.groupBy({
      by: ['device'],
      where: {
        sessionId: session.id,
        dataDate: { gte: startDate },
        device: { not: null }
      },
      _avg: {
        ecpm: true,
        fillRate: true
      },
      _sum: {
        revenue: true
      }
    })

    // Find best performing device type
    const bestDevice = devicePerformance.reduce((best, current) => {
      if (!best || (current._avg.ecpm && best._avg.ecpm && current._avg.ecpm > best._avg.ecpm)) {
        return current
      }
      return best
    })

    if (bestDevice && bestDevice.device) {
      recommendations.push({
        id: 'device-best',
        type: 'device',
        title: '设备类型优化建议',
        message: `${bestDevice.device} 设备表现最佳，eCPM达 $${bestDevice._avg.ecpm?.toFixed(2)}`,
        impact: 'medium',
        data: {
          device: bestDevice.device,
          avgEcpm: bestDevice._avg.ecpm,
          avgFillRate: bestDevice._avg.fillRate,
          totalRevenue: bestDevice._sum.revenue
        }
      })
    }

    // 5. Anomaly Detection - Revenue Drop
    const revenueByDay = await prisma.adReport.groupBy({
      by: ['dataDate'],
      where: {
        sessionId: session.id,
        dataDate: { gte: startDate }
      },
      _sum: {
        revenue: true
      },
      orderBy: {
        dataDate: 'asc'
      }
    })

    // Simple anomaly detection - if today's revenue is 50% less than average of last 7 days
    if (revenueByDay.length >= 2) {
      const recentDays = revenueByDay.slice(-7)
      const avgRevenue = recentDays.reduce((sum, day) => sum + (day._sum.revenue || 0), 0) / recentDays.length
      const todayRevenue = revenueByDay[revenueByDay.length - 1]._sum.revenue || 0

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

    // 6. Ad Format Performance
    const formatPerformance = await prisma.adReport.groupBy({
      by: ['adFormat'],
      where: {
        sessionId: session.id,
        dataDate: { gte: startDate },
        adFormat: { not: null }
      },
      _avg: {
        ecpm: true,
        fillRate: true
      },
      _sum: {
        revenue: true
      },
      orderBy: {
        _avg: {
          ecpm: 'desc'
        }
      }
    })

    formatPerformance.forEach((item, index) => {
      if (item._avg.ecpm && item._avg.ecpm > 10) { // High performing format
        recommendations.push({
          id: `format-high-${index}`,
          type: 'format',
          title: '广告格式优化建议',
          message: `${item.adFormat} 格式表现优异，eCPM达 $${item._avg.ecpm.toFixed(2)}，建议增加使用比例`,
          impact: 'high',
          data: {
            adFormat: item.adFormat,
            avgEcpm: item._avg.ecpm,
            avgFillRate: item._avg.fillRate,
            totalRevenue: item._sum.revenue
          }
        })
      }
    })

    // 7. Device-Browser Combination Analysis (复合维度分析)
    const deviceBrowserCombinations = await prisma.adReport.groupBy({
      by: ['device', 'browser'],
      where: {
        sessionId: session.id,
        dataDate: { gte: startDate },
        device: { not: null },
        browser: { not: null }
      },
      _avg: {
        ecpm: true,
        fillRate: true,
        ctr: true
      },
      _sum: {
        revenue: true,
        impressions: true
      },
      _count: true
    })

    // Filter after grouping to check minimum revenue threshold
    const filteredCombinations = deviceBrowserCombinations.filter(item => (item._sum.revenue || 0) >= 10)

    // Find high eCPM but low fill rate combinations
    filteredCombinations.forEach((item, index) => {
      if (item._avg.ecpm && item._avg.ecpm > 15 && item._avg.fillRate && item._avg.fillRate < 40) {
        recommendations.push({
          id: `combo-opp-${index}`,
          type: 'combination',
          title: '设备-浏览器组合优化机会',
          message: `${item.device} + ${item.browser} 组合eCPM高达 $${item._avg.ecpm.toFixed(2)} 但填充率仅${item._avg.fillRate.toFixed(2)}%`,
          impact: 'high',
          data: {
            device: item.device,
            browser: item.browser,
            avgEcpm: item._avg.ecpm,
            avgFillRate: item._avg.fillRate,
            avgCtr: item._avg.ctr,
            totalRevenue: item._sum.revenue
          }
        })
      }
    })

    // 8. Competitive Intelligence Alerts (竞争情报提醒)
    const competitorData = await prisma.adReport.groupBy({
      by: ['advertiser', 'domain'],
      where: {
        sessionId: session.id,
        dataDate: { gte: startDate },
        advertiser: { not: null }
      },
      _avg: {
        ecpm: true
      },
      _sum: {
        revenue: true,
        impressions: true
      },
      orderBy: {
        _sum: {
          revenue: 'desc'
        }
      },
      take: 10
    })

    // Analyze competitor strategies
    const topCompetitor = competitorData[0]
    if (topCompetitor && topCompetitor._sum.revenue && topCompetitor._sum.revenue > 500) {
      // Get countries where top competitor operates
      const competitorCountries = await prisma.adReport.findMany({
        where: {
          sessionId: session.id,
          advertiser: topCompetitor.advertiser,
          country: { not: null }
        },
        select: {
          country: true
        },
        distinct: ['country']
      })

      if (competitorCountries.length > 3) {
        recommendations.push({
          id: 'competitive-intel',
          type: 'competitive',
          title: '竞争对手策略分析',
          message: `${topCompetitor.advertiser} 在${competitorCountries.length}个国家运营，收入达$${topCompetitor._sum.revenue.toFixed(2)}，建议分析其成功策略`,
          impact: 'medium',
          data: {
            advertiser: topCompetitor.advertiser,
            domain: topCompetitor.domain,
            totalRevenue: topCompetitor._sum.revenue,
            avgEcpm: topCompetitor._avg.ecpm,
            countriesCovered: competitorCountries.length,
            countries: competitorCountries.map(c => c.country)
          }
        })
      }
    }

    // 9. Hourly Pattern Analysis (结合24小时表现模式)
    const hourlyPerformance = await prisma.adReport.findMany({
      where: {
        sessionId: session.id,
        dataDate: { gte: startDate }
      },
      select: {
        dataDate: true,
        revenue: true,
        ecpm: true
      }
    })

    // Analyze hourly patterns
    const hourlyRevenue = Array.from({ length: 24 }, () => ({ total: 0, count: 0 }))
    hourlyPerformance.forEach(record => {
      const hour = new Date(record.dataDate).getHours()
      hourlyRevenue[hour].total += record.revenue || 0
      hourlyRevenue[hour].count += 1
    })

    // Find peak and low performance hours
    const hourlyAvg = hourlyRevenue.map(h => h.count > 0 ? h.total / h.count : 0)
    const peakHour = hourlyAvg.indexOf(Math.max(...hourlyAvg))
    const lowHour = hourlyAvg.indexOf(Math.min(...hourlyAvg.filter(h => h > 0)))

    if (hourlyAvg[peakHour] > hourlyAvg[lowHour] * 3) {
      recommendations.push({
        id: 'hourly-optimization',
        type: 'predictive',
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

    const trendData = await prisma.adReport.groupBy({
      by: ['dataDate'],
      where: {
        sessionId: session.id,
        dataDate: { gte: trendStartDate }
      },
      _sum: {
        revenue: true
      },
      orderBy: {
        dataDate: 'asc'
      }
    })

    if (trendData.length > 7) {
      // Calculate 7-day moving averages
      const movingAverages = []
      for (let i = 6; i < trendData.length; i++) {
        const sum = trendData.slice(i - 6, i + 1).reduce((acc, day) => acc + (day._sum.revenue || 0), 0)
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

    // 11. Predictive Alerts (预测性提醒)
    // Get eCPM distribution data
    const ecpmData = await prisma.adReport.findMany({
      where: {
        sessionId: session.id,
        dataDate: { gte: startDate },
        ecpm: { not: null }
      },
      select: {
        ecpm: true,
        revenue: true
      }
    })

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

    // Convert BigInt values to Number for serialization
    const serializeData = (data: any): any => {
      if (Array.isArray(data)) {
        return data.map(item => serializeData(item))
      } else if (data && typeof data === 'object') {
        const result: any = {}
        for (const [key, value] of Object.entries(data)) {
          if (typeof value === 'bigint') {
            result[key] = Number(value)
          } else if (value && typeof value === 'object') {
            result[key] = serializeData(value)
          } else {
            result[key] = value
          }
        }
        return result
      }
      return data
    }

    return NextResponse.json({
      alerts: serializeData(alerts.slice(0, 10)), // Limit to top 10 alerts
      recommendations: serializeData(recommendations.slice(0, 10)) // Limit to top 10 recommendations
    })
  } catch (error) {
    console.error('Error generating alerts:', error)
    return NextResponse.json({ error: 'Failed to generate alerts' }, { status: 500 })
  }
}