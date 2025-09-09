import { NextRequest, NextResponse } from 'next/server'
import { FileSystemManager } from '@/lib/fs-manager'

interface AnalyticsData {
  date: string
  revenue: number
  impressions: number
  requests: number
  ctr: number
  ecpm: number
  fillRate: number
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const fileId = searchParams.get('fileId')
    
    let data
    
    if (fileId) {
      // 分析单个文件
      const result = await FileSystemManager.getAnalysisResult(fileId)
      if (!result) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 })
      }
      
      // 转换为analytics格式
      data = {
        summary: {
          totalRevenue: result.summary.totalRevenue,
          totalImpressions: result.summary.totalImpressions,
          totalClicks: result.summary.totalClicks,
          totalRequests: result.summary.totalRequests,
          avgEcpm: result.summary.avgEcpm,
          avgCtr: result.summary.avgCtr
        },
        charts: {
          revenueByDate: (result.dailyTrend || []).map((item: any) => ({
            date: item.name || item.date, // 兼容优化前后的格式
            revenue: item.revenue
          })),
          revenueByCountry: (result.topCountries || []).map((item: any) => ({
            country: item.name,
            revenue: item.revenue
          })),
          revenueByDevice: (result.devices || []).map((item: any) => ({
            device: item.name,
            revenue: item.revenue
          })),
          fillRateDistribution: result.fillRateDistribution ? 
            Object.entries(result.fillRateDistribution).map(([range, count]) => ({
              range,
              count
            })) :
            // 如果没有预计算的填充率分布，使用样本数据计算
            calculateFillRateFromSample(result.samplePreview || [], result.summary.totalRows)
        },
        topWebsites: result.topWebsites || [],
        topCountries: result.topCountries || [],
        topDevices: result.devices || [],
        topAdFormats: result.adFormats || []
      }
    } else {
      // 没有提供fileId时，不返回任何数据
      return NextResponse.json({ 
        error: 'No data uploaded yet',
        summary: {
          totalRevenue: 0,
          totalImpressions: 0,
          totalClicks: 0,
          totalRequests: 0,
          avgEcpm: 0,
          avgCtr: 0,
          avgFillRate: 0,
          arpu: 0
        },
        charts: {
          revenueByDate: [],
          revenueByCountry: [],
          revenueByDevice: [],
          fillRateDistribution: []
        }
      }, { status: 404 })
    }
      
      
    return NextResponse.json(data)
    
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// 从样本数据计算填充率分布的备选函数
function calculateFillRateFromSample(sampleData: any[], totalRows: number) {
  if (!sampleData || sampleData.length === 0) {
    return [
      { range: '0-20%', count: 0 },
      { range: '20-40%', count: 0 },
      { range: '40-60%', count: 0 },
      { range: '60-80%', count: 0 },
      { range: '80-100%', count: 0 }
    ]
  }
  
  const ranges = [
    { min: 0, max: 20, label: '0-20%' },
    { min: 20, max: 40, label: '20-40%' },
    { min: 40, max: 60, label: '40-60%' },
    { min: 60, max: 80, label: '60-80%' },
    { min: 80, max: 100, label: '80-100%' }
  ]
  
  const distribution = ranges.map(range => {
    const count = sampleData.filter(row => {
      const fillRate = row.fillRate !== undefined ? row.fillRate : 
                       (row.requests > 0 ? (row.impressions / row.requests * 100) : 0)
      return fillRate >= range.min && fillRate < range.max
    }).length
    
    // 按比例推断到总行数
    const percentage = count / sampleData.length
    return {
      range: range.label,
      count: Math.round(percentage * totalRows)
    }
  })
  
  return distribution
}