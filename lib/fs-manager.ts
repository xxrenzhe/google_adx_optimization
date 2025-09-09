import fs from 'fs/promises'
import path from 'path'
import { CONFIG } from './config'

interface ResultData {
  fileId: string
  fileName?: string
  uploadTime?: string
  summary: {
    totalRevenue: number
    totalImpressions: number
    totalClicks: number
    avgEcpm: number
    avgCtr: number
  }
  topWebsites: Array<{
    name: string
    revenue: number
    impressions: number
    clicks?: number
    ecpm: number
  }>
  topCountries: Array<{
    name: string
    revenue: number
    impressions: number
    clicks?: number
    ecpm: number
  }>
  sampleData: AnalyticsDataRow[]
}

interface AggregatedData {
  revenue: number
  impressions: number
  clicks?: number
  ecpm: number
  count?: number
}

interface DailyData {
  date: string
  revenue: number
  impressions: number
  clicks?: number
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

// 文件系统数据管理器
export class FileSystemManager {
  private static dataDir = path.join(process.cwd(), 'data')
  private static resultsDir = CONFIG.DIRECTORIES.RESULTS_DIR
  
  static async ensureDirectories() {
    await fs.mkdir(this.dataDir, { recursive: true })
    await fs.mkdir(this.resultsDir, { recursive: true })
  }
  
  // 获取所有分析结果
  static async getAllAnalysisResults() {
    try {
      await this.ensureDirectories()
      const files = await fs.readdir(this.resultsDir)
      const results: ResultData[] = []
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.resultsDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const data: unknown = JSON.parse(content)
          
          // 添加文件ID
          const fileId = file.replace('.json', '')
          results.push({
            fileId,
            fileName: (data as any).fileName || file,
            uploadTime: (data as any).uploadTime || new Date().toISOString(),
            summary: (data as any).summary,
            topWebsites: (data as any).topWebsites || [],
            topCountries: (data as any).topCountries || [],
            sampleData: (data as any).sampleData || []
          })
        }
      }
      
      // 按上传时间排序
      return results.sort((a: any, b: any) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime())
    } catch (error) {
      console.error('Error reading analysis results:', error)
      return []
    }
  }
  
  // 获取单个分析结果
  static async getAnalysisResult(fileId: string) {
    try {
      const filePath = path.join(this.resultsDir, `${fileId}.json`)
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      console.error('Error reading analysis result:', error)
      return null
    }
  }
  
  // 聚合所有数据用于分析
  static async getAggregatedData() {
    try {
      const allResults = await this.getAllAnalysisResults()
      
      if (allResults.length === 0) {
        return null
      }
      
      // 聚合所有数据
      const aggregated = {
        summary: {
          totalRevenue: 0,
          totalImpressions: 0,
          totalClicks: 0,
          avgEcpm: 0,
          avgCtr: 0
        },
        dailyData: new Map<string, DailyData>(),
        websites: new Map<string, AggregatedData>(),
        countries: new Map<string, AggregatedData>(),
        devices: new Map<string, AggregatedData>(),
        adFormats: new Map<string, AggregatedData>()
      }
      
      for (const result of allResults) {
        // 累加汇总数据
        aggregated.summary.totalRevenue += (result as ResultData).summary.totalRevenue || 0
        aggregated.summary.totalImpressions += (result as ResultData).summary.totalImpressions || 0
        aggregated.summary.totalClicks += (result as ResultData).summary.totalClicks || 0
        
        // 聚合网站数据
        if ((result as ResultData).topWebsites) {
          for (const website of (result as ResultData).topWebsites) {
            const current: AggregatedData = aggregated.websites.get(website.name) || {
              revenue: 0,
              impressions: 0,
              clicks: 0,
              ecpm: 0,
              count: 0
            }
            const wRevenue = website.revenue as number
          const wImpressions = website.impressions as number
          const wClicks = (website.clicks || 0) as number
          
          (current as AggregatedData).revenue += wRevenue
          ;(current as AggregatedData).impressions += wImpressions
          ;(current as any).clicks += wClicks
            aggregated.websites.set(website.name, current)
          }
        }
        
        // 聚合国家数据
        if ((result as ResultData).topCountries) {
          for (const country of (result as ResultData).topCountries) {
            const current: AggregatedData = aggregated.countries.get(country.name) || {
              revenue: 0,
              impressions: 0,
              clicks: 0,
              ecpm: 0,
              count: 0
            }
            const cRevenue = country.revenue as number
          const cImpressions = country.impressions as number
          const cClicks = (country.clicks || 0) as number
          
          (current as AggregatedData).revenue += cRevenue
          ;(current as AggregatedData).impressions += cImpressions
          ;(current as any).clicks += cClicks
            aggregated.countries.set(country.name, current)
          }
        }
        
        // 处理样本数据以获取设备、广告格式等分布
        if ((result as ResultData).sampleData) {
          for (const row of (result as ResultData).sampleData) {
            // 设备统计
            if (row.device) {
              const device: AggregatedData = aggregated.devices.get((row as AnalyticsDataRow).device!) || {
                revenue: 0,
                impressions: 0,
                clicks: 0,
                ecpm: 0,
                count: 0
              }
              device.revenue += (row as AnalyticsDataRow).revenue || 0
              device.impressions += (row as AnalyticsDataRow).impressions || 0
              device.count += 1
              aggregated.devices.set(row.device, device)
            }
            
            // 广告格式统计
            if (row.adFormat) {
              const format: AggregatedData = aggregated.adFormats.get((row as AnalyticsDataRow).adFormat!) || {
                revenue: 0,
                impressions: 0,
                clicks: 0,
                ecpm: 0,
                count: 0
              }
              format.revenue += (row as AnalyticsDataRow).revenue || 0
              format.impressions += (row as AnalyticsDataRow).impressions || 0
              format.count += 1
              aggregated.adFormats.set(row.adFormat, format)
            }
            
            // 日期统计
            if ((row as any).date) {
              const date = (row as any).date.split(' ')[0] // 只取日期部分
              const daily: DailyData = aggregated.dailyData.get(date) || {
                date,
                revenue: 0,
                impressions: 0,
                clicks: 0
              }
              daily.revenue += (row as AnalyticsDataRow).revenue || 0
              daily.impressions += (row as AnalyticsDataRow).impressions || 0
              daily.clicks += (row as AnalyticsDataRow).clicks || 0
              aggregated.dailyData.set(date, daily)
            }
          }
        }
      }
      
      // 计算平均值
      aggregated.summary.avgEcpm = aggregated.summary.totalImpressions > 0 
        ? aggregated.summary.totalRevenue / aggregated.summary.totalImpressions * 1000 
        : 0
      aggregated.summary.avgCtr = aggregated.summary.totalImpressions > 0 
        ? (aggregated.summary.totalClicks / aggregated.summary.totalImpressions) * 100 
        : 0
      
      // 转换Map为数组并排序
      return {
        summary: aggregated.summary,
        dailyData: Array.from(aggregated.dailyData.values()).sort((a: any, b: any) => a.date.localeCompare(b.date)),
        topWebsites: Array.from(aggregated.websites.entries())
          .map(([name, data]: [string, any]) => ({ name, ...(data as any), ecpm: (data as any).impressions > 0 ? (data as any).revenue / (data as any).impressions * 1000 : 0 }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 20),
        topCountries: Array.from(aggregated.countries.entries())
          .map(([name, data]: [string, any]) => ({ name, ...(data as any), ecpm: (data as any).impressions > 0 ? (data as any).revenue / (data as any).impressions * 1000 : 0 }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 20),
        topDevices: Array.from(aggregated.devices.entries())
          .map(([name, data]: [string, any]) => ({ name, ...(data as any), ecpm: (data as any).impressions > 0 ? (data as any).revenue / (data as any).impressions * 1000 : 0 }))
          .sort((a, b) => b.revenue - a.revenue),
        topAdFormats: Array.from(aggregated.adFormats.entries())
          .map(([name, data]: [string, any]) => ({ name, ...(data as any), ecpm: (data as any).impressions > 0 ? (data as any).revenue / (data as any).impressions * 1000 : 0 }))
          .sort((a, b) => b.revenue - a.revenue)
      }
    } catch (error) {
      console.error('Error aggregating data:', error)
      return null
    }
  }
  
  // 获取最近的文件用于会话管理
  static async getRecentFile() {
    const allResults = await this.getAllAnalysisResults()
    return allResults.length > 0 ? allResults[0] : null
  }
}