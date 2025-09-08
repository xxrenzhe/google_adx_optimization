import fs from 'fs/promises'
import path from 'path'
import { CONFIG } from './config'

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
      const results = []
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.resultsDir, file)
          const content = await fs.readFile(filePath, 'utf-8')
          const data = JSON.parse(content)
          
          // 添加文件ID
          const fileId = file.replace('.json', '')
          results.push({
            fileId,
            fileName: data.fileName || file,
            uploadTime: data.uploadTime || new Date().toISOString(),
            summary: data.summary,
            topWebsites: data.topWebsites || [],
            topCountries: data.topCountries || [],
            sampleData: data.sampleData || []
          })
        }
      }
      
      // 按上传时间排序
      return results.sort((a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime())
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
        dailyData: new Map<string, any>(),
        websites: new Map<string, any>(),
        countries: new Map<string, any>(),
        devices: new Map<string, any>(),
        adFormats: new Map<string, any>()
      }
      
      for (const result of allResults) {
        // 累加汇总数据
        aggregated.summary.totalRevenue += result.summary.totalRevenue || 0
        aggregated.summary.totalImpressions += result.summary.totalImpressions || 0
        aggregated.summary.totalClicks += result.summary.totalClicks || 0
        
        // 聚合网站数据
        if (result.topWebsites) {
          for (const website of result.topWebsites) {
            const current = aggregated.websites.get(website.name) || {
              revenue: 0,
              impressions: 0,
              clicks: 0,
              ecpm: 0
            }
            current.revenue += website.revenue
            current.impressions += website.impressions
            current.clicks += website.clicks || 0
            aggregated.websites.set(website.name, current)
          }
        }
        
        // 聚合国家数据
        if (result.topCountries) {
          for (const country of result.topCountries) {
            const current = aggregated.countries.get(country.name) || {
              revenue: 0,
              impressions: 0,
              clicks: 0
            }
            current.revenue += country.revenue
            current.impressions += country.impressions
            current.clicks += country.clicks || 0
            aggregated.countries.set(country.name, current)
          }
        }
        
        // 处理样本数据以获取设备、广告格式等分布
        if (result.sampleData) {
          for (const row of result.sampleData) {
            // 设备统计
            if (row.device) {
              const device = aggregated.devices.get(row.device) || {
                revenue: 0,
                impressions: 0,
                count: 0
              }
              device.revenue += row.revenue || 0
              device.impressions += row.impressions || 0
              device.count += 1
              aggregated.devices.set(row.device, device)
            }
            
            // 广告格式统计
            if (row.adFormat) {
              const format = aggregated.adFormats.get(row.adFormat) || {
                revenue: 0,
                impressions: 0,
                count: 0
              }
              format.revenue += row.revenue || 0
              format.impressions += row.impressions || 0
              format.count += 1
              aggregated.adFormats.set(row.adFormat, format)
            }
            
            // 日期统计
            if (row.dataDate) {
              const date = row.dataDate.split(' ')[0] // 只取日期部分
              const daily = aggregated.dailyData.get(date) || {
                date,
                revenue: 0,
                impressions: 0,
                clicks: 0
              }
              daily.revenue += row.revenue || 0
              daily.impressions += row.impressions || 0
              daily.clicks += row.clicks || 0
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
        dailyData: Array.from(aggregated.dailyData.values()).sort((a, b) => a.date.localeCompare(b.date)),
        topWebsites: Array.from(aggregated.websites.entries())
          .map(([name, data]) => ({ name, ...data, ecpm: data.impressions > 0 ? data.revenue / data.impressions * 1000 : 0 }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 20),
        topCountries: Array.from(aggregated.countries.entries())
          .map(([name, data]) => ({ name, ...data, ecpm: data.impressions > 0 ? data.revenue / data.impressions * 1000 : 0 }))
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 20),
        topDevices: Array.from(aggregated.devices.entries())
          .map(([name, data]) => ({ name, ...data, ecpm: data.impressions > 0 ? data.revenue / data.impressions * 1000 : 0 }))
          .sort((a, b) => b.revenue - a.revenue),
        topAdFormats: Array.from(aggregated.adFormats.entries())
          .map(([name, data]) => ({ name, ...data, ecpm: data.impressions > 0 ? data.revenue / data.impressions * 1000 : 0 }))
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