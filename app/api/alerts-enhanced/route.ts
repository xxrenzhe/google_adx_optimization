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
  type: 'website' | 'country' | 'device' | 'format' | 'combination' | 'competitive' | 'predictive' | 'timing' | 'pricing'
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

    // 1. Low Fill Rate Alerts - 降低阈值到20%
    const lowFillRateData = await prisma.adReport.groupBy({
      by: ['website'],
      where: {
        sessionId: session.id,
        dataDate: { gte: startDate },
        fillRate: { lt: 20 } // 降低阈值
      },
      _avg: {
        fillRate: true,
        revenue: true
      },
      _count: true
    })

    lowFillRateData.forEach((item, index) => {
      alerts.push({
        id: `low-fill-${index}`,
        type: 'warning',
        title: '低填充率警告',
        message: `${item.website} 的平均填充率仅为 ${item._avg.fillRate?.toFixed(2)}%，低于20%警戒线`,
        data: {
          website: item.website,
          avgFillRate: item._avg.fillRate,
          avgRevenue: item._avg.revenue,
          recordCount: item._count
        }
      })
    })

    // 2. High-value Website Recommendations - 降低阈值到1.2倍
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
      take: 10
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
      if (item._avg.ecpm && avgEcpm._avg.ecpm && item._avg.ecpm > avgEcpm._avg.ecpm * 1.2) {
        recommendations.push({
          id: `high-value-${index}`,
          type: 'website',
          title: '高价值网站推荐',
          message: `${item.website} 的 eCPM ($${item._avg.ecpm.toFixed(2)}) 高于平均水平${((item._avg.ecpm / avgEcpm._avg.ecpm! - 1) * 100).toFixed(1)}%，建议增加广告投放`,
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

    // 3. Country Performance Analysis - 降低收入阈值
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
      take: 15
    })

    // Find underperforming countries with low fill rate but high potential
    countryPerformance.forEach((item, index) => {
      if (item._avg.fillRate && item._avg.fillRate < 60 && item._sum.revenue && item._sum.revenue > 10) {
        recommendations.push({
          id: `country-opp-${index}`,
          type: 'country',
          title: '国家市场优化机会',
          message: `${item.country} 填充率较低 (${item._avg.fillRate.toFixed(2)}%) 但有一定收入，建议优化广告配置`,
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

    // 6. Ad Format Performance - 降低阈值
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
      if (item._avg.ecpm && item._avg.ecpm > 5) { // 降低阈值到5
        recommendations.push({
          id: `format-high-${index}`,
          type: 'format',
          title: '广告格式优化建议',
          message: `${item.adFormat} 格式表现良好，eCPM达 $${item._avg.ecpm.toFixed(2)}，建议增加使用比例`,
          impact: item._avg.ecpm > 10 ? 'high' : 'medium',
          data: {
            adFormat: item.adFormat,
            avgEcpm: item._avg.ecpm,
            avgFillRate: item._avg.fillRate,
            totalRevenue: item._sum.revenue
          }
        })
      }
    })

    // 7. Device-Browser Combination Analysis - 降低阈值
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

    // Find high eCPM but low fill rate combinations
    deviceBrowserCombinations.forEach((item, index) => {
      if (item._avg.ecpm && item._avg.ecpm > 10 && item._avg.fillRate && item._avg.fillRate < 60) {
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

    // 8. Competitive Intelligence Alerts - 降低阈值
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
      take: 15
    })

    // Analyze competitor strategies
    const topCompetitor = competitorData[0]
    if (topCompetitor && topCompetitor._sum.revenue && topCompetitor._sum.revenue > 50) {
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

      if (competitorCountries.length > 1) {
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

    // 9. Timing Analysis - 新增时段分析
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

    if (hourlyAvg[peakHour] > hourlyAvg[lowHour] * 2) {
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

    // 10. Pricing Strategy - 新增定价策略
    const ecpmDistribution = await prisma.adReport.groupBy({
      by: ['adFormat'],
      where: {
        sessionId: session.id,
        dataDate: { gte: startDate },
        adFormat: { not: null },
        ecpm: { not: null }
      },
      _avg: {
        ecpm: true
      },
      _count: true
    })

    // Find underpriced formats
    ecpmDistribution.forEach((item, index) => {
      if (item._avg.ecpm && item._avg.ecpm < 3 && item._count > 10) {
        recommendations.push({
          id: `pricing-${index}`,
          type: 'pricing',
          title: '定价策略建议',
          message: `${item.adFormat} 的平均eCPM仅为$${item._avg.ecpm.toFixed(2)}，可能定价过低，建议调整定价策略`,
          impact: 'medium',
          data: {
            adFormat: item.adFormat,
            avgEcpm: item._avg.ecpm,
            impressionCount: item._count
          }
        })
      }
    })

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
      recommendations: serializeData(recommendations.slice(0, 15)) // Limit to top 15 recommendations
    })
  } catch (error) {
    console.error('Error generating enhanced alerts:', error)
    return NextResponse.json({ error: 'Failed to generate alerts' }, { status: 500 })
  }
}