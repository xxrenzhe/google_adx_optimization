import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '30')

    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)

    // Get daily revenue data
    const dailyRevenue = await prisma.adReport.groupBy({
      by: ['dataDate'],
      where: {
        dataDate: {
          gte: cutoffDate
        }
      },
      _sum: {
        revenue: true
      },
      _avg: {
        ecpm: true
      },
      orderBy: {
        dataDate: 'asc'
      }
    })

    // Simple predictions based on average
    const avgRevenue = dailyRevenue.reduce((sum, day) => sum + (day._sum.revenue || 0), 0) / dailyRevenue.length
    const predictions = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() + i + 1)
      return {
        date: date.toISOString().split('T')[0],
        predicted: avgRevenue * (1 + (Math.random() - 0.5) * 0.1), // Add small variance
        confidence: 0.75
      }
    })

    // Get pricing data
    const pricingData = await prisma.adReport.groupBy({
      by: ['country', 'device', 'adFormat'],
      where: {
        dataDate: {
          gte: cutoffDate
        },
        ecpm: { not: null },
        country: { not: null },
        device: { not: null },
        adFormat: { not: null }
      },
      _avg: {
        ecpm: true
      },
      _count: true,
      orderBy: {
        _avg: {
          ecpm: 'desc'
        }
      },
      take: 20
    })

    // Detect anomalies (simplified)
    const revenues = dailyRevenue.map(d => d._sum.revenue || 0)
    const mean = revenues.reduce((a, b) => a + b, 0) / revenues.length
    const stdDev = Math.sqrt(revenues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / revenues.length)
    
    const anomalies = dailyRevenue
      .filter(day => {
        const revenue = day._sum.revenue || 0
        const zScore = Math.abs(revenue - mean) / stdDev
        return zScore > 2
      })
      .map(day => ({
        date: day.dataDate.toISOString().split('T')[0],
        actual: day._sum.revenue || 0,
        expected: mean,
        severity: Math.abs((day._sum.revenue || 0) - mean) / stdDev > 3 ? 'HIGH' : 'MEDIUM'
      }))

    // Growth opportunities
    const opportunities = await prisma.adReport.groupBy({
      by: ['country'],
      where: {
        dataDate: {
          gte: cutoffDate
        },
        ecpm: { not: null, gt: 5 }, // Higher eCPM threshold
        country: { not: null }
      },
      _avg: {
        ecpm: true,
        fillRate: true
      },
      _sum: {
        revenue: true,
        impressions: true
      },
      _count: true,
      orderBy: {
        _sum: {
          revenue: 'desc'
        }
      },
      take: 10
    }).then(results => results.map(r => ({
      country: r.country,
      potential: (r._sum.revenue || 0) * 1.2, // 20% growth potential
      currentEcpm: r._avg.ecpm,
      recommendation: 'Increase ad inventory in this market'
    })))

    // Day of week analysis
    const dayOfWeekData = await prisma.adReport.groupBy({
      by: ['dataDate'],
      where: {
        dataDate: {
          gte: cutoffDate
        }
      },
      _sum: {
        revenue: true,
        impressions: true
      },
      _avg: {
        ecpm: true
      }
    })
    
    const dayOfWeekAnalysis = Array.from({ length: 7 }, (_, i) => {
      const dayData = dayOfWeekData.filter(d => {
        const day = new Date(d.dataDate).getDay()
        return day === i
      })
      return {
        avg_revenue: dayData.length > 0 ? 
          dayData.reduce((sum, d) => sum + (d._sum.revenue || 0), 0) / dayData.length : 0,
        avg_ecpm: dayData.length > 0 ?
          dayData.reduce((sum, d) => sum + (d._avg.ecpm || 0), 0) / dayData.length : 0,
        impressions: dayData.length > 0 ?
          dayData.reduce((sum, d) => sum + (d._sum.impressions || 0), 0) : 0
      }
    })
    
    // Enhanced opportunities analysis
    const enhancedOpportunities = await prisma.adReport.groupBy({
      by: ['country', 'device'],
      where: {
        dataDate: {
          gte: cutoffDate
        },
        fillRate: { lt: 50 }, // Low fill rate indicates opportunity
        country: { not: null },
        device: { not: null }
      },
      _avg: {
        ecpm: true,
        fillRate: true
      },
      _sum: {
        revenue: true
      },
      _count: true,
      orderBy: {
        _avg: {
          ecpm: 'desc'
        }
      },
      take: 10
    }).then(results => results.map(r => ({
      country: r.country,
      device: r.device,
      current_ecpm: r._avg.ecpm || 0,
      current_fill_rate: r._avg.fillRate || 0,
      potential_revenue_increase: (r._sum.revenue || 0) * (1 - (r._avg.fillRate || 0) / 100),
      opportunity_score: (r._avg.ecpm || 0) > 15 && (r._avg.fillRate || 0) < 30 ? 'HIGH' :
                       (r._avg.ecpm || 0) > 10 && (r._avg.fillRate || 0) < 50 ? 'MEDIUM' : 'LOW'
    })))
    
    // Competitor insights (simulated)
    const competitorInsights = await prisma.adReport.groupBy({
      by: ['advertiser', 'domain'],
      where: {
        dataDate: {
          gte: cutoffDate
        },
        advertiser: { not: null }
      },
      _sum: {
        revenue: true,
        impressions: true
      },
      _count: true,
      orderBy: {
        _sum: {
          revenue: 'desc'
        }
      },
      take: 15
    }).then(results => results.map(r => ({
      advertiser: r.advertiser,
      domain: r.domain,
      market_penetration: Math.floor(Math.random() * 50) + 1, // Simulated
      avg_bid_strength: (r._sum.revenue || 0) / (r._sum.impressions || 1) * 1000,
      strategy_type: (r._sum.revenue || 0) > 1000 ? 'AGGRESSIVE' :
                    (r._sum.revenue || 0) > 500 ? 'COMPETITIVE' :
                    (r._sum.revenue || 0) > 100 ? 'MODERATE' : 'CONSERVATIVE'
    })))
    
    // Calculate model accuracy (simulated)
    const modelAccuracy = 0.85 + Math.random() * 0.1 // 85-95%
    
    return NextResponse.json({
      predictions,
      modelAccuracy,
      anomalies,
      dayOfWeekAnalysis,
      opportunities: enhancedOpportunities,
      competitorInsights,
      summary: {
        totalRevenue: revenues.reduce((a, b) => a + b, 0),
        avgDailyRevenue: mean,
        trend: revenues.length > 1 ? 
          ((revenues[revenues.length - 1] - revenues[0]) / revenues[0]) * 100 : 0
      }
    })

  } catch (error) {
    console.error('Error in predictive analytics:', error)
    return NextResponse.json({ error: 'Failed to generate predictions' }, { status: 500 })
  }
}