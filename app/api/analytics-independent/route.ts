import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentSession } from '@/lib/session'
import { cacheManager } from '@/lib/cache-manager'

// 独立数据分析API - 只分析当前会话的数据
export async function GET(request: NextRequest) {
  try {
    const session = getCurrentSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No data uploaded yet' }, { status: 404 })
    }
    
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'
    
    // 获取会话信息
    const sessionInfo = await getSessionInfo(session.id)
    if (!sessionInfo) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    // 检查缓存
    const cacheKey = `analytics:independent:${session.id}`
    if (!forceRefresh) {
      const cached = await cacheManager.getCachedQuery(cacheKey)
      if (cached) {
        return NextResponse.json(cached)
      }
    }
    
    // 执行独立分析
    const analytics = await performIndependentAnalysis(sessionInfo.tempTableName, session.id)
    
    // 缓存结果
    await cacheManager.cacheQueryResult(cacheKey, analytics, 1800) // 30分钟缓存
    
    return NextResponse.json(analytics)
    
  } catch (error) {
    console.error('Independent analytics error:', error)
    return NextResponse.json(
      { error: 'Failed to analyze data' },
      { status: 500 }
    )
  }
}

// 执行独立数据分析
async function performIndependentAnalysis(tempTableName: string, sessionId: string) {
  // 1. 基础统计
  const basicStats = await getBasicStats(tempTableName)
  
  // 2. 时间序列分析
  const timeSeries = await getTimeSeriesAnalysis(tempTableName)
  
  // 3. 网站性能分析
  const websitePerformance = await getWebsitePerformance(tempTableName)
  
  // 4. 地理分析
  const geoAnalysis = await getGeoAnalysis(tempTableName)
  
  // 5. 设备分析
  const deviceAnalysis = await getDeviceAnalysis(tempTableName)
  
  // 6. 广告格式分析
  const adFormatAnalysis = await getAdFormatAnalysis(tempTableName)
  
  // 7. 收入分析
  const revenueAnalysis = await getRevenueAnalysis(tempTableName)
  
  // 8. 趋势分析
  const trends = await getTrendsAnalysis(tempTableName)
  
  return {
    session: {
      id: sessionId,
      recordCount: basicStats.totalRecords,
      dateRange: {
        start: basicStats.minDate,
        end: basicStats.maxDate
      }
    },
    summary: {
      totalRevenue: basicStats.totalRevenue,
      totalImpressions: basicStats.totalImpressions,
      totalClicks: basicStats.totalClicks,
      avgCTR: basicStats.avgCTR,
      avgECPM: basicStats.avgECPM,
      avgFillRate: basicStats.avgFillRate,
      totalRequests: basicStats.totalRequests
    },
    timeSeries,
    websitePerformance,
    geoAnalysis,
    deviceAnalysis,
    adFormatAnalysis,
    revenueAnalysis,
    trends,
    insights: generateInsights({
      basicStats,
      timeSeries,
      websitePerformance,
      geoAnalysis,
      deviceAnalysis,
      trends
    })
  }
}

// 获取基础统计
async function getBasicStats(tempTableName: string) {
  const result = await prisma.$queryRawUnsafe(`
    SELECT 
      COUNT(*) as total_records,
      MIN(dataDate) as min_date,
      MAX(dataDate) as max_date,
      COALESCE(SUM(revenue), 0) as total_revenue,
      COALESCE(SUM(impressions), 0) as total_impressions,
      COALESCE(SUM(clicks), 0) as total_clicks,
      COALESCE(AVG(ctr), 0) as avg_ctr,
      COALESCE(AVG(ecpm), 0) as avg_ecpm,
      COALESCE(AVG(fillRate), 0) as avg_fill_rate,
      COALESCE(SUM(requests), 0) as total_requests
    FROM ${tempTableName}
    WHERE dataDate IS NOT NULL
  `)
  
  const stats = (result as any[])[0]
  
  return {
    totalRecords: Number(stats.total_records),
    minDate: stats.min_date,
    maxDate: stats.max_date,
    totalRevenue: Number(stats.total_revenue),
    totalImpressions: Number(stats.total_impressions),
    totalClicks: Number(stats.total_clicks),
    avgCTR: Number(stats.avg_ctr),
    avgECPM: Number(stats.avg_ecpm),
    avgFillRate: Number(stats.avg_fill_rate),
    totalRequests: Number(stats.total_requests)
  }
}

// 时间序列分析
async function getTimeSeriesAnalysis(tempTableName: string) {
  const result = await prisma.$queryRawUnsafe(`
    SELECT 
      dataDate,
      COUNT(*) as records,
      COALESCE(SUM(revenue), 0) as revenue,
      COALESCE(SUM(impressions), 0) as impressions,
      COALESCE(SUM(clicks), 0) as clicks,
      COALESCE(AVG(ctr), 0) as ctr,
      COALESCE(AVG(ecpm), 0) as ecpm,
      COALESCE(SUM(requests), 0) as requests
    FROM ${tempTableName}
    GROUP BY dataDate
    ORDER BY dataDate
  `)
  
  return (result as any[]).map((row: any) => ({
    date: row.dataDate,
    records: Number(row.records),
    revenue: Number(row.revenue),
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
    ctr: Number(row.ctr),
    ecpm: Number(row.ecpm),
    requests: Number(row.requests)
  }))
}

// 网站性能分析
async function getWebsitePerformance(tempTableName: string) {
  const result = await prisma.$queryRawUnsafe(`
    SELECT 
      website,
      COUNT(*) as records,
      COALESCE(SUM(revenue), 0) as revenue,
      COALESCE(SUM(impressions), 0) as impressions,
      COALESCE(SUM(clicks), 0) as clicks,
      COALESCE(AVG(ctr), 0) as ctr,
      COALESCE(AVG(ecpm), 0) as ecpm,
      COALESCE(AVG(fillRate), 0) as fill_rate
    FROM ${tempTableName}
    GROUP BY website
    ORDER BY revenue DESC
    LIMIT 20
  `)
  
  return (result as any[]).map((row: any) => ({
    website: row.website,
    records: Number(row.records),
    revenue: Number(row.revenue),
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
    ctr: Number(row.ctr),
    ecpm: Number(row.ecpm),
    fillRate: Number(row.fill_rate)
  }))
}

// 地理分析
async function getGeoAnalysis(tempTableName: string) {
  const result = await prisma.$queryRawUnsafe(`
    SELECT 
      country,
      COUNT(*) as records,
      COALESCE(SUM(revenue), 0) as revenue,
      COALESCE(SUM(impressions), 0) as impressions,
      COALESCE(AVG(ecpm), 0) as ecpm
    FROM ${tempTableName}
    WHERE country IS NOT NULL
    GROUP BY country
    ORDER BY revenue DESC
    LIMIT 15
  `)
  
  return (result as any[]).map((row: any) => ({
    country: row.country,
    records: Number(row.records),
    revenue: Number(row.revenue),
    impressions: Number(row.impressions),
    ecpm: Number(row.ecpm)
  }))
}

// 设备分析
async function getDeviceAnalysis(tempTableName: string) {
  const result = await prisma.$queryRawUnsafe(`
    SELECT 
      device,
      COUNT(*) as records,
      COALESCE(SUM(revenue), 0) as revenue,
      COALESCE(SUM(impressions), 0) as impressions,
      COALESCE(AVG(ctr), 0) as ctr,
      COALESCE(AVG(ecpm), 0) as ecpm
    FROM ${tempTableName}
    WHERE device IS NOT NULL
    GROUP BY device
    ORDER BY revenue DESC
  `)
  
  return (result as any[]).map((row: any) => ({
    device: row.device,
    records: Number(row.records),
    revenue: Number(row.revenue),
    impressions: Number(row.impressions),
    ctr: Number(row.ctr),
    ecpm: Number(row.ecpm)
  }))
}

// 广告格式分析
async function getAdFormatAnalysis(tempTableName: string) {
  const result = await prisma.$queryRawUnsafe(`
    SELECT 
      adFormat,
      COUNT(*) as records,
      COALESCE(SUM(revenue), 0) as revenue,
      COALESCE(SUM(impressions), 0) as impressions,
      COALESCE(AVG(ecpm), 0) as ecpm,
      COALESCE(AVG(viewabilityRate), 0) as viewability_rate
    FROM ${tempTableName}
    WHERE adFormat IS NOT NULL
    GROUP BY adFormat
    ORDER BY revenue DESC
  `)
  
  return (result as any[]).map((row: any) => ({
    adFormat: row.adformat,
    records: Number(row.records),
    revenue: Number(row.revenue),
    impressions: Number(row.impressions),
    ecpm: Number(row.ecpm),
    viewabilityRate: Number(row.viewability_rate)
  }))
}

// 收入分析
async function getRevenueAnalysis(tempTableName: string) {
  const result = await prisma.$queryRawUnsafe(`
    SELECT 
      PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY revenue) as median_revenue,
      PERCENTILE_CONT(0.9) WITHIN GROUP (ORDER BY revenue) as p90_revenue,
      PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY revenue) as p95_revenue,
      PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY revenue) as p99_revenue,
      AVG(revenue) as avg_revenue,
      STDDEV(revenue) as stddev_revenue
    FROM ${tempTableName}
    WHERE revenue IS NOT NULL
  `)
  
  const stats = (result as any[])[0]
  
  return {
    median: Number(stats.median_revenue),
    p90: Number(stats.p90_revenue),
    p95: Number(stats.p95_revenue),
    p99: Number(stats.p99_revenue),
    avg: Number(stats.avg_revenue),
    stddev: Number(stats.stddev_revenue)
  }
}

// 趋势分析
async function getTrendsAnalysis(tempTableName: string) {
  // 计算日环比增长
  const result = await prisma.$queryRawUnsafe(`
    WITH daily_data AS (
      SELECT 
        dataDate,
        COALESCE(SUM(revenue), 0) as daily_revenue,
        COALESCE(SUM(impressions), 0) as daily_impressions
      FROM ${tempTableName}
      GROUP BY dataDate
      ORDER BY dataDate
    )
    SELECT 
      dataDate,
      daily_revenue,
      daily_impressions,
      LAG(daily_revenue, 1) OVER (ORDER BY dataDate) as prev_revenue,
      CASE 
        WHEN LAG(daily_revenue, 1) OVER (ORDER BY dataDate) > 0 
        THEN (daily_revenue - LAG(daily_revenue, 1) OVER (ORDER BY dataDate)) / LAG(daily_revenue, 1) OVER (ORDER BY dataDate)
        ELSE NULL 
      END as revenue_growth
    FROM daily_data
    ORDER BY dataDate DESC
    LIMIT 14
  `)
  
  return (result as any[]).map((row: any) => ({
    date: row.dataDate,
    revenue: Number(row.daily_revenue),
    impressions: Number(row.daily_impressions),
    prevRevenue: Number(row.prev_revenue),
    growthRate: row.revenue_growth ? Number(row.revenue_growth) * 100 : null
  }))
}

// 生成洞察
function generateInsights(data: any) {
  const insights = []
  
  // 收入洞察
  if (data.basicStats.totalRevenue > 0) {
    const topWebsite = data.websitePerformance[0]
    insights.push({
      type: 'revenue',
      title: '最佳表现网站',
      message: `${topWebsite.website} 贡献了最高收入 $${topWebsite.revenue.toFixed(2)}`,
      value: topWebsite.revenue,
      impact: 'high'
    })
  }
  
  // CTR洞察
  if (data.basicStats.avgCTR > 0.05) {
    insights.push({
      type: 'performance',
      title: '点击率表现优异',
      message: `平均点击率 ${(data.basicStats.avgCTR * 100).toFixed(2)}% 高于行业平均水平`,
      value: data.basicStats.avgCTR,
      impact: 'medium'
    })
  }
  
  // 地理洞察
  if (data.geoAnalysis.length > 0) {
    const topCountry = data.geoAnalysis[0]
    insights.push({
      type: 'geographic',
      title: '主要市场',
      message: `${topCountry.country} 是收入最高的市场，占比 ${((topCountry.revenue / data.basicStats.totalRevenue) * 100).toFixed(1)}%`,
      value: topCountry.revenue,
      impact: 'medium'
    })
  }
  
  // 设备洞察
  const topDevice = data.devicePerformance?.[0]
  if (topDevice) {
    insights.push({
      type: 'device',
      title: '最佳设备类型',
      message: `${topDevice.device} 设备 eCPM 最高，达到 $${topDevice.ecpm.toFixed(2)}`,
      value: topDevice.ecpm,
      impact: 'medium'
    })
  }
  
  // 趋势洞察
  const recentTrend = data.trends?.[0]
  if (recentTrend && recentTrend.growthRate !== null) {
    if (recentTrend.growthRate > 10) {
      insights.push({
        type: 'trend',
        title: '收入增长强劲',
        message: `最新日收入较前日增长 ${recentTrend.growthRate.toFixed(1)}%`,
        value: recentTrend.growthRate,
        impact: 'high'
      })
    } else if (recentTrend.growthRate < -10) {
      insights.push({
        type: 'warning',
        title: '收入下降预警',
        message: `最新日收入较前日下降 ${Math.abs(recentTrend.growthRate).toFixed(1)}%`,
        value: recentTrend.growthRate,
        impact: 'high'
      })
    }
  }
  
  return insights
}

// 获取会话信息
async function getSessionInfo(sessionId: string) {
  try {
    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        filename: true,
        recordCount: true,
        tempTableName: true,
        status: true,
        uploadedAt: true
      }
    })
    
    return session
  } catch (error) {
    console.error('Get session info failed:', error)
    return null
  }
}