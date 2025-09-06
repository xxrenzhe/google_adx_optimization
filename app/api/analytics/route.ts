import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentSession } from '@/lib/session'
import { getAnalyticsByBatch } from '@/lib/analytics-batch'

// Simple in-memory cache (in production, consider Redis)
const analyticsCache = new Map()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

async function getCachedData(key: string) {
  const cached = analyticsCache.get(key)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  return null
}

async function setCachedData(key: string, data: any) {
  analyticsCache.set(key, {
    data,
    timestamp: Date.now()
  })
}

export async function GET(request: NextRequest) {
  try {
    const session = getCurrentSession(request)
    
    if (!session) {
      return NextResponse.json({ error: 'No data uploaded yet' }, { status: 404 })
    }
    
    // 检查数据量决定处理方式
    const recordCount = await prisma.adReport.count({
      where: { sessionId: session.id }
    })
    
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    
    // 数据量小，使用原有方式；数据量大，使用批处理
    let responseData
    
    if (recordCount <= 50000) {
      // 小数据量，使用原有查询方式
      const cacheKey = `analytics:${session.id}:${startDate || 'all'}:${endDate || 'all'}`
      
      // Check if we have cached data
      const cachedData = await getCachedData(cacheKey)
      if (cachedData) {
        return NextResponse.json(cachedData)
      }
      
      const where: any = {
        sessionId: session.id
      }
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
      
      // Convert BigInt to Number for JSON serialization
      responseData = {
        summary: {
          totalRevenue: Number(totalRevenue._sum.revenue || 0),
          totalImpressions: Number(totalImpressions._sum.impressions || 0),
          totalRequests: Number(totalRequests._sum.requests || 0),
          avgFillRate,
          arpu: Number(totalRevenue._sum.revenue || 0) / 5000
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
      }
      
      // Cache the response
      await setCachedData(cacheKey, responseData)
    } else {
      // 大数据量，使用批处理
      const batchResult = await getAnalyticsByBatch(session.id)
      responseData = {
        summary: {
          totalRevenue: batchResult.totalRevenue,
          totalImpressions: batchResult.totalImpressions,
          totalRequests: batchResult.totalRequests,
          avgFillRate: batchResult.avgFillRate,
          arpu: batchResult.totalRevenue / 5000
        },
        charts: {
          revenueByDate: batchResult.byDate,
          revenueByCountry: batchResult.byCountry,
          revenueByDevice: batchResult.byDevice,
          fillRateDistribution: [] // 批处理暂不提供填充率分布
        },
        meta: {
          recordCount,
          processingMethod: 'batch',
          warning: recordCount > 100000 ? '数据量较大，分析结果基于批处理统计' : undefined
        }
      }
    }
    
    return NextResponse.json(responseData)
    
  } catch (error) {
    console.error('Analytics fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    )
  }
}