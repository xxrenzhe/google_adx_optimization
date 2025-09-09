import { NextRequest, NextResponse } from 'next/server'
import { FileSystemManager } from '@/lib/fs-manager'

interface AlertData {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  data?: Record<string, unknown>
  timestamp: string
}

interface AnalyticsDataRow {
  date: string
  website: string
  country?: string
  device?: string
  browser?: string
  adFormat?: string
  adUnit?: string
  requests?: number
  impressions?: number
  clicks?: number
  ctr?: number
  ecpm?: number
  revenue?: number
  viewableImpressions?: number
  viewabilityRate?: number
  fillRate?: number
  arpu?: number
}

interface DailyData {
  date: string
  revenue: number
  impressions: number
  clicks?: number
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
  type: 'website' | 'country' | 'device' | 'format' | 'combination' | 'competitive' | 'predictive' | 'timing' | 'pricing' | 'warning'
  title: string
  message: string
  impact: 'high' | 'medium' | 'low'
  data: any
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get('fileId')
    
    let data
    
    if (fileId) {
      // 分析单个文件
      const result = await FileSystemManager.getAnalysisResult(fileId)
      if (!result) {
        return NextResponse.json({ 
          alerts: [], 
          recommendations: [] 
        })
      }
      
      // 转换数据格式以兼容alerts分析
      const dailyData = (result.dailyTrend || []).map((item: { name?: string; date?: string; revenue: number; impressions: number; clicks?: number; requests?: number; ecpm?: number; ctr?: number }) => ({
        date: item.name || item.date || '', // 兼容优化前后的格式
        revenue: item.revenue,
        impressions: item.impressions,
        clicks: item.clicks,
        requests: item.requests,
        ecpm: item.ecpm,
        ctr: item.ctr
      }))
      
      data = {
        summary: result.summary,
        dailyData,
        topWebsites: result.topWebsites || [],
        topCountries: result.topCountries || [],
        topDevices: result.devices || [],
        topAdFormats: result.adFormats || []
      }
    } else {
      // 没有提供fileId时，不返回任何数据
      return NextResponse.json({ 
        alerts: [], 
        recommendations: [],
        summary: {
          totalRevenue: 0,
          avgEcpm: 0,
          avgCtr: 0,
          totalFiles: 0
        }
      })
    }
    
    const alerts: Alert[] = []
    const recommendations: Recommendation[] = []
    
    // 生成告警
    const { summary, topWebsites, topCountries } = data
    
    // 1. 收入告警
    if (summary.totalRevenue && summary.totalRevenue < 100) {
      alerts.push({
        id: 'revenue-low',
        type: 'warning',
        title: '收入偏低',
        message: `当前总收入 ¥${summary.totalRevenue.toFixed(2)}，建议优化广告配置`,
        data: { revenue: summary.totalRevenue }
      })
    }
    
    // 2. eCPM告警
    if (summary.avgEcpm && summary.avgEcpm < 1) {
      alerts.push({
        id: 'ecpm-low',
        type: 'warning',
        title: 'eCPM偏低',
        message: `平均eCPM为 ¥${summary.avgEcpm.toFixed(2)}，低于行业平均水平`,
        data: { ecpm: summary.avgEcpm }
      })
    }
    
    // 3. CTR告警
    if (summary.avgCtr && summary.avgCtr < 0.5) {
      alerts.push({
        id: 'ctr-low',
        type: 'warning',
        title: '点击率偏低',
        message: `平均点击率为 ${summary.avgCtr.toFixed(2)}%，建议优化广告位`,
        data: { ctr: summary.avgCtr }
      })
    }
    
    // 生成建议
    // 1. 网站优化建议 - 只在有多于一个网站时才生成
    if (topWebsites && topWebsites.length > 1) {
      const bestPerformer = topWebsites[0]
      const worstPerformer = topWebsites[topWebsites.length - 1]
      
      // 确保不是同一个网站
      if (bestPerformer && worstPerformer && 
          bestPerformer.name !== worstPerformer.name &&
          bestPerformer.ecpm && worstPerformer.ecpm && 
          worstPerformer.ecpm > 0) {
        const ratio = bestPerformer.ecpm / worstPerformer.ecpm
        // 只有当差异显著时才提供建议
        if (ratio > 1.5) {
          recommendations.push({
            id: 'website-optimization',
            type: 'website',
            title: '优化网站表现',
            message: `${bestPerformer.name}的eCPM(¥${bestPerformer.ecpm.toFixed(2)})是${worstPerformer.name}(¥${worstPerformer.ecpm.toFixed(2)})的${ratio.toFixed(1)}倍`,
            impact: 'high',
            data: { best: bestPerformer, worst: worstPerformer }
          })
        }
      }
    }
    
    // 2. 地理优化建议
    if (topCountries && topCountries.length > 0) {
      const topCountry = topCountries[0]
      if (topCountry && topCountry.revenue && summary.totalRevenue) {
        recommendations.push({
          id: 'geo-optimization',
          type: 'country',
          title: '地理市场优化',
          message: `${topCountry.name}贡献了¥${topCountry.revenue.toFixed(2)}收入，占总收入的${((topCountry.revenue / summary.totalRevenue) * 100).toFixed(1)}%`,
          impact: 'medium',
          data: topCountry
        })
      }
    }
    
    // 3. 设备优化建议
    if (data.topDevices && data.topDevices.length > 0) {
      const topDevice = data.topDevices[0]
      if (topDevice && topDevice.ecpm) {
        recommendations.push({
          id: 'device-optimization',
          type: 'device',
          title: '设备优化建议',
          message: `${topDevice.name}设备表现最佳，eCPM达到¥${topDevice.ecpm.toFixed(2)}`,
          impact: 'medium',
          data: topDevice
        })
      }
    }
    
    // 4. 广告格式建议
    if (data.topAdFormats && data.topAdFormats.length > 0) {
      const bestFormat = data.topAdFormats[0]
      if (bestFormat && bestFormat.name) {
        recommendations.push({
          id: 'format-optimization',
          type: 'format',
          title: '广告格式优化',
          message: `${bestFormat.name}格式效果最好，建议增加投放比例`,
          impact: 'high',
          data: bestFormat
        })
      }
    }
    
    // 5. 收入增长建议
    if (summary.totalRevenue && summary.totalRevenue > 0 && data.dailyData && data.dailyData.length > 1) {
      const recentDays = data.dailyData.slice(-7)
      const earlierDays = data.dailyData.slice(-14, -7)
      
      if (recentDays.length > 0 && earlierDays.length > 0) {
        const recentAvg = recentDays.reduce((sum: number, day: DailyData) => sum + (day.revenue || 0), 0) / recentDays.length
        const earlierAvg = earlierDays.reduce((sum: number, day: DailyData) => sum + (day.revenue || 0), 0) / earlierDays.length
        const growth = earlierAvg > 0 ? ((recentAvg - earlierAvg) / earlierAvg) * 100 : 0
        
        if (growth > 10) {
          recommendations.push({
            id: 'growth-positive',
            type: 'predictive',
            title: '收入增长趋势良好',
            message: `最近7天收入增长${growth.toFixed(1)}%，继续保持当前策略`,
            impact: 'high',
            data: { growth, recentAvg, earlierAvg }
          })
        } else if (growth < -10) {
          recommendations.push({
            id: 'growth-negative',
            type: 'warning',
            title: '收入下滑警告',
            message: `最近7天收入下降${Math.abs(growth).toFixed(1)}%，需要立即调整策略`,
            impact: 'high',
            data: { growth, recentAvg, earlierAvg }
          })
        }
      }
    }
    
    // 获取总文件数（缓存优化）
    let totalFiles = 0
    try {
      // 使用更轻量级的方法获取文件数量
      const fs = require('fs')
      const path = require('path')
      const resultsDir = path.join(process.cwd(), 'results')
      if (fs.existsSync(resultsDir)) {
        const files = fs.readdirSync(resultsDir)
        totalFiles = files.filter((f: string) => f.endsWith('.json')).length
      }
    } catch (error) {
      console.warn('Failed to get total files count:', error)
      totalFiles = 0
    }
    
    return NextResponse.json({ 
      alerts, 
      recommendations,
      summary: {
        totalRevenue: summary.totalRevenue,
        avgEcpm: summary.avgEcpm,
        avgCtr: summary.avgCtr,
        totalFiles
      }
    })
    
  } catch (error) {
    console.error('Alerts API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}