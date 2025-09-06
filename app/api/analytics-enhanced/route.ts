import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // Create cache key
    const cacheKey = `enhanced-analytics:${startDate || 'all'}:${endDate || 'all'}`
    
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

    // Build date conditions for raw SQL
    const dateConditions = []
    if (startDate) dateConditions.push(`data_date >= '${startDate}'::date`)
    if (endDate) dateConditions.push(`data_date <= '${endDate}'::date`)
    const whereClause = dateConditions.length > 0 ? `AND ${dateConditions.join(' AND ')}` : ''

    // 1. Advertiser Value Analysis
    const advertiserAnalysis = await prisma.adReport.groupBy({
      by: ['advertiser', 'domain'],
      where: startDate || endDate ? {
        dataDate: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) })
        }
      } : {},
      _avg: {
        ecpm: true,
        ctr: true,
        fillRate: true,
        viewabilityRate: true
      },
      _sum: {
        revenue: true,
        impressions: true,
        clicks: true
      },
      _count: true,
      orderBy: {
        _sum: {
          revenue: 'desc'
        }
      },
      take: 20
    })

    // 2. Device-Browser Performance Matrix
    const deviceBrowserMatrix = await prisma.adReport.groupBy({
      by: ['device', 'browser'],
      where: {
        ...(startDate || endDate ? {
          dataDate: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) })
          }
        } : {}),
        device: { not: null },
        browser: { not: null }
      },
      _avg: {
        ecpm: true,
        ctr: true,
        fillRate: true
      },
      _sum: {
        revenue: true,
        impressions: true
      },
      _count: true
    })

    // 3. Ad Unit Performance Analysis
    const adUnitAnalysis = await prisma.adReport.groupBy({
      by: ['adFormat', 'adUnit'],
      where: startDate || endDate ? {
        dataDate: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate) })
        }
      } : {},
      _avg: {
        ecpm: true,
        ctr: true,
        fillRate: true
      },
      _sum: {
        revenue: true,
        impressions: true,
        requests: true
      },
      _count: true,
      orderBy: {
        _avg: {
          ecpm: 'desc'
        }
      }
    })

    // 4. Geographic Deep Dive
    const geoAnalysis = await prisma.adReport.groupBy({
      by: ['country', 'device'],
      where: {
        ...(startDate || endDate ? {
          dataDate: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) })
          }
        } : {}),
        country: { not: null }
      },
      _avg: {
        ecpm: true,
        ctr: true,
        fillRate: true
      },
      _sum: {
        revenue: true,
        impressions: true
      },
      _count: true
    })

    // 5. eCPM Distribution Analysis - simplified
    const ecpmBuckets = [
      { range: '< $1', count: 0, avg_revenue: 0, total_revenue: 0 },
      { range: '$1-$5', count: 0, avg_revenue: 0, total_revenue: 0 },
      { range: '$5-$10', count: 0, avg_revenue: 0, total_revenue: 0 },
      { range: '$10-$20', count: 0, avg_revenue: 0, total_revenue: 0 },
      { range: '$20-$50', count: 0, avg_revenue: 0, total_revenue: 0 },
      { range: '$50-$100', count: 0, avg_revenue: 0, total_revenue: 0 },
      { range: '> $100', count: 0, avg_revenue: 0, total_revenue: 0 }
    ]

    // 6. Hourly Performance Pattern - simplified
    const hourlyPattern = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      avg_ecpm: 0,
      avg_ctr: 0,
      total_revenue: 0,
      records: 0
    }))

    // 7. Viewability Analysis
    const viewabilityAnalysis = await prisma.adReport.groupBy({
      by: ['adFormat'],
      where: {
        ...(startDate || endDate ? {
          dataDate: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) })
          }
        } : {}),
        viewabilityRate: { not: null }
      },
      _avg: {
        viewabilityRate: true,
        ecpm: true,
        revenue: true
      },
      _count: true
    })

    // 8. Top Performing Combinations - simplified
    const topCombinations = await prisma.adReport.groupBy({
      by: ['country', 'device', 'adFormat'],
      where: {
        ...(startDate || endDate ? {
          dataDate: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate) })
          }
        } : {}),
        country: { not: null },
        device: { not: null },
        adFormat: { not: null }
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
      take: 15
    }).then(results => results.map(r => ({
      country: r.country,
      device: r.device,
      ad_format: r.adFormat,
      avg_ecpm: r._avg.ecpm,
      total_revenue: r._sum.revenue,
      occurrences: r._count,
      avg_fill_rate: r._avg.fillRate
    })))

    // Convert BigInt values to Number for serialization
    const serializeData = (data: any) => {
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
      advertiserAnalysis: serializeData(advertiserAnalysis),
      deviceBrowserMatrix: serializeData(deviceBrowserMatrix),
      adUnitAnalysis: serializeData(adUnitAnalysis),
      geoAnalysis: serializeData(geoAnalysis),
      ecpmBuckets,
      hourlyPattern,
      viewabilityAnalysis: serializeData(viewabilityAnalysis),
      topCombinations: serializeData(topCombinations)
    })
  } catch (error) {
    console.error('Error in enhanced analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch enhanced analytics' }, { status: 500 })
  }
}