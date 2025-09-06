import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentSession } from '@/lib/session'

interface Alert {
  id: string
  type: 'warning' | 'success' | 'error'
  title: string
  message: string
  data?: any
}

interface Recommendation {
  id: string
  type: 'website' | 'country' | 'device' | 'format'
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
    
    const alerts: Alert[] = []
    const recommendations: Recommendation[] = []

    // Get recent data for analysis
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

    // 1. Low Fill Rate Alerts
    const lowFillRateData = await prisma.adReport.groupBy({
      by: ['website'],
      where: {
        sessionId: session.id,
        dataDate: { gte: sevenDaysAgo },
        fillRate: { lt: 30 } // Less than 30% fill rate
      },
      _avg: {
        fillRate: true,
        revenue: true
      },
      _count: true,
      having: {
        fillRate: { _avg: { lt: 30 } }
      }
    })

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
        dataDate: { gte: sevenDaysAgo }
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
        dataDate: { gte: sevenDaysAgo }
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
        dataDate: { gte: sevenDaysAgo },
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
        dataDate: { gte: sevenDaysAgo },
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
        dataDate: { gte: sevenDaysAgo }
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
        dataDate: { gte: sevenDaysAgo },
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

    return NextResponse.json({
      alerts: alerts.slice(0, 10), // Limit to top 10 alerts
      recommendations: recommendations.slice(0, 10) // Limit to top 10 recommendations
    })
  } catch (error) {
    console.error('Error generating alerts:', error)
    return NextResponse.json({ error: 'Failed to generate alerts' }, { status: 500 })
  }
}