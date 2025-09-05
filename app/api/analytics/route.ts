import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    const where: any = {}
    if (startDate && endDate) {
      where.dataDate = {
        gte: new Date(startDate),
        lte: new Date(endDate)
      }
    }
    
    const [
      totalRevenue,
      totalImpressions,
      totalRequests,
      revenueByDate,
      revenueByCountry,
      revenueByDevice,
      fillRateDistribution
    ] = await Promise.all([
      prisma.adReport.aggregate({
        where,
        _sum: { revenue: true },
        _count: true
      }),
      
      prisma.adReport.aggregate({
        where,
        _sum: { impressions: true }
      }),
      
      prisma.adReport.aggregate({
        where,
        _sum: { requests: true }
      }),
      
      prisma.adReport.groupBy({
        by: ['dataDate'],
        where,
        _sum: { revenue: true },
        orderBy: { dataDate: 'asc' }
      }),
      
      prisma.adReport.groupBy({
        by: ['country'],
        where,
        _sum: { revenue: true },
        orderBy: { _sum: { revenue: 'desc' } },
        take: 10
      }),
      
      prisma.adReport.groupBy({
        by: ['device'],
        where,
        _sum: { revenue: true },
        orderBy: { _sum: { revenue: 'desc' } }
      }),
      
      prisma.adReport.findMany({
        where: {
          ...where,
          fillRate: { not: null }
        },
        select: { fillRate: true }
      })
    ])
    
    const avgFillRate = totalRequests._sum.requests && totalImpressions._sum.impressions
      ? (Number(totalImpressions._sum.impressions) / Number(totalRequests._sum.requests)) * 100
      : 0
    
    const fillRateBuckets = [0, 20, 40, 60, 80, 100]
    const fillRateHist = fillRateBuckets.map((bucket, index) => {
      const nextBucket = fillRateBuckets[index + 1] || 100
      const count = fillRateDistribution.filter(r => 
        r.fillRate! >= bucket && r.fillRate! < nextBucket
      ).length
      return { range: `${bucket}-${nextBucket}%`, count }
    })
    
    return NextResponse.json({
      summary: {
        totalRevenue: totalRevenue._sum.revenue || 0,
        totalImpressions: totalImpressions._sum.impressions || 0,
        totalRequests: totalRequests._sum.requests || 0,
        avgFillRate,
        arpu: totalRevenue._sum.revenue ? totalRevenue._sum.revenue / 5000 : 0
      },
      charts: {
        revenueByDate: revenueByDate.map(item => ({
          date: item.dataDate.toISOString().split('T')[0],
          revenue: item._sum.revenue || 0
        })),
        revenueByCountry: revenueByCountry.map(item => ({
          country: item.country || 'Unknown',
          revenue: item._sum.revenue || 0
        })),
        revenueByDevice: revenueByDevice.map(item => ({
          device: item.device || 'Unknown',
          revenue: item._sum.revenue || 0
        })),
        fillRateDistribution: fillRateHist
      }
    })
    
  } catch (error) {
    console.error('Analytics fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}