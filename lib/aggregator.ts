// import { CONFIG } from './config'

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

interface AggregatedData {
  revenue: number
  impressions: number
  clicks?: number
  ecpm: number
  count?: number
}

interface AnalyticsData {
  date: string
  revenue: number
  impressions: number
  requests: number
  ctr: number
  ecpm: number
  fillRate: number
}

// 轻量级聚合器 - 优化内存使用
export class LightweightAggregator {
  private summary = {
    totalRevenue: 0,
    totalImpressions: 0,
    totalClicks: 0,
    totalRequests: 0,
    avgEcpm: 0,
    avgCtr: 0,
    totalRows: 0
  }
  
  private topData = {
    websites: {} as Record<string, any>,
    countries: {} as Record<string, any>,
    dates: {} as Record<string, any>,
    devices: {} as Record<string, any>,
    adFormats: {} as Record<string, any>,
    advertisers: {} as Record<string, any>,
    adUnits: {} as Record<string, any>
  }
  
  // 详细组合数据 - 用于高级分析
  private detailedCombinations = {
    countryDevice: {} as Record<string, any>,
    countryAdFormat: {} as Record<string, any>,
    deviceAdFormat: {} as Record<string, any>,
    websiteCountry: {} as Record<string, any>,
    adUnitAdFormat: {} as Record<string, any>
  }
  
  private fillRateDistribution = {
    "0-20%": 0,
    "20-40%": 0,
    "40-60%": 0,
    "60-80%": 0,
    "80-100%": 0
  }
  
  private samplePreview: unknown[] = []
  private readonly SAMPLE_LIMIT = 20 // 减少样本数量
  private detailedData: unknown[] = [] // 存储全量详细数据用于分析
  private processedLines = 0
  private columnMap: Record<string, number> = {}
  
  // 设置列映射
  setColumnMap(map: Record<string, number>) {
    this.columnMap = map
  }
  
  // 轻量级更新函数
  private updateMetric(data: Record<string, any>, key: string, values: unknown) {
    if (!data[key]) {
      data[key] = {
        revenue: 0,
        impressions: 0,
        clicks: 0,
        requests: 0
      }
    }
    
    data[key].revenue += (values as any).revenue
    data[key].impressions += (values as any).impressions
    data[key].clicks += (values as any).clicks
    data[key].requests += (values as any).requests
  }
  
  // 更新组合数据
  private updateCombination(data: Record<string, any>, key: string, values: unknown) {
    if (!data[key]) {
      data[key] = {
        revenue: 0,
        impressions: 0,
        clicks: 0,
        requests: 0
      }
    }
    
    data[key].revenue += (values as any).revenue
    data[key].impressions += (values as any).impressions
    data[key].clicks += (values as any).clicks
    data[key].requests += (values as any).requests
  }
  
  // 处理单行数据 - 极度优化
  processRow(cols: string[], columnMap: Record<string, number>) {
    try {
      const getValue = (columnType: string, defaultValue: string = 'Unknown') => {
        const index = columnMap[columnType]
        return index !== undefined ? cols[index]?.trim() || defaultValue : defaultValue
      }
      
      const getNumericValue = (columnType: string, defaultValue: number = 0) => {
        const index = columnMap[columnType]
        if (index === undefined) return defaultValue
        const value = parseFloat(cols[index]) || 0
        return isNaN(value) ? defaultValue : value
      }
      
      const date = getValue('date', '')
      const website = getValue('website')
      const country = getValue('country')
      const adFormat = getValue('adFormat')
      const device = getValue('device')
      const advertiser = getValue('advertiser')
      
      const revenue = getNumericValue('revenue')
      const impressions = getNumericValue('impressions')
      const clicks = getNumericValue('clicks')
      const requests = getNumericValue('requests')
      
      // 更新汇总
      this.summary.totalRevenue += revenue
      this.summary.totalImpressions += impressions
      this.summary.totalClicks += clicks
      this.summary.totalRequests += requests
      
      // 更新聚合数据
      this.updateMetric(this.topData.websites, website, { revenue, impressions, clicks, requests })
      this.updateMetric(this.topData.countries, country, { revenue, impressions, clicks, requests })
      if (date) {
        this.updateMetric(this.topData.dates, date, { revenue, impressions, clicks, requests })
      }
      this.updateMetric(this.topData.devices, device, { revenue, impressions, clicks, requests })
      this.updateMetric(this.topData.adFormats, adFormat, { revenue, impressions, clicks, requests })
      this.updateMetric(this.topData.advertisers, advertiser, { revenue, impressions, clicks, requests })
      
      // 获取adUnit
      const adUnit = getValue('adUnit')
      if (adUnit && adUnit !== 'Unknown') {
        this.updateMetric(this.topData.adUnits, adUnit, { revenue, impressions, clicks, requests })
      }
      
      // 更新详细组合数据
      this.updateCombination(this.detailedCombinations.countryDevice, `${country}|${device}`, { revenue, impressions, clicks, requests })
      this.updateCombination(this.detailedCombinations.countryAdFormat, `${country}|${adFormat}`, { revenue, impressions, clicks, requests })
      this.updateCombination(this.detailedCombinations.deviceAdFormat, `${device}|${adFormat}`, { revenue, impressions, clicks, requests })
      this.updateCombination(this.detailedCombinations.websiteCountry, `${website}|${country}`, { revenue, impressions, clicks, requests })
      
      // 如果adUnit存在，更新adUnitAdFormat组合
      if (adUnit && adUnit !== 'Unknown' && adFormat && adFormat !== 'Unknown') {
        this.updateCombination(this.detailedCombinations.adUnitAdFormat, `${adUnit}|${adFormat}`, { revenue, impressions, clicks, requests })
      }
      
      // 填充率计算
      const fillRate = requests > 0 ? (impressions / requests * 100) : 0
      if (fillRate < 20) this.fillRateDistribution["0-20%"]++
      else if (fillRate < 40) this.fillRateDistribution["20-40%"]++
      else if (fillRate < 60) this.fillRateDistribution["40-60%"]++
      else if (fillRate < 80) this.fillRateDistribution["60-80%"]++
      else this.fillRateDistribution["80-100%"]++
      
      // 收集全量详细数据用于分析
      this.detailedData.push({
        date, website, country, adFormat, device,
        revenue, impressions, clicks, requests,
        ecpm: impressions > 0 ? (revenue / impressions * 1000) : 0,
        ctr: impressions > 0 ? (clicks / impressions * 100) : 0,
        // 额外字段用于更深入的分析
        browser: getValue('browser'),
        domain: getValue('domain', website),
        advertiser: getValue('advertiser'),
        adUnit: getValue('adUnit'),
        viewableImpressions: getNumericValue('viewableImpressions', impressions),
        viewabilityRate: getNumericValue('viewabilityRate', 100)
      })
      
      // 有限样本预览 - 只保留前20条用于界面预览
      if (this.samplePreview.length < this.SAMPLE_LIMIT) {
        this.samplePreview.push({
          date, website, country, adFormat, device,
          revenue, impressions, clicks, requests,
          ecpm: impressions > 0 ? (revenue / impressions * 1000) : 0,
          ctr: impressions > 0 ? (clicks / impressions * 100) : 0
        })
      }
      
      this.processedLines++
      
      // 定期内存检查
      if (this.processedLines % 5000 === 0) {
        // MemoryMonitor.getInstance().checkMemory()
      }
      
    } catch {
      // 静默忽略错误行
    }
  }
  
  // 生成最终结果 - 轻量级
  getResult(fileId: string, fileName: string) {
    // 计算平均值
    this.summary.avgEcpm = this.summary.totalImpressions > 0 
      ? (this.summary.totalRevenue / this.summary.totalImpressions * 1000)
      : 0
    this.summary.avgCtr = this.summary.totalImpressions > 0
      ? (this.summary.totalClicks / this.summary.totalImpressions * 100)
      : 0
    this.summary.totalRows = this.processedLines
    
    // 转换并排序Top数据
    const convertTopData = (data: Record<string, any>, limit: number) => {
      return Object.entries(data)
        .map(([name, values]: [string, any]) => ({
          name,
          revenue: (values as any).revenue,
          impressions: (values as any).impressions,
          clicks: (values as any).clicks,
          requests: (values as any).requests,
          ecpm: (values as any).impressions > 0 ? ((values as any).revenue / (values as any).impressions * 1000) : 0,
          ctr: (values as any).impressions > 0 ? ((values as any).clicks / (values as any).impressions * 100) : 0
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit)
    }
    
    // 转换组合数据
    const convertCombinationData = (data: Record<string, any>) => {
      return Object.entries(data)
        .map(([name, values]: [string, any]) => ({
          name,
          revenue: (values as any).revenue,
          impressions: (values as any).impressions,
          clicks: (values as any).clicks,
          requests: (values as any).requests,
          ecpm: (values as any).impressions > 0 ? ((values as any).revenue / (values as any).impressions * 1000) : 0,
          ctr: (values as any).impressions > 0 ? ((values as any).clicks / (values as any).impressions * 100) : 0
        }))
        .sort((a, b) => b.revenue - a.revenue)
    }
    
    return {
      fileId,
      fileName,
      summary: this.summary,
      topWebsites: convertTopData(this.topData.websites, 10),
      topCountries: convertTopData(this.topData.countries, 10),
      dailyTrend: convertTopData(this.topData.dates, 30),
      devices: convertTopData(this.topData.devices, 5),
      adFormats: convertTopData(this.topData.adFormats, 5),
      advertisers: convertTopData(this.topData.advertisers || {}, 10),
      adUnits: convertTopData(this.topData.adUnits || {}, 10),
      samplePreview: this.samplePreview,
      detailedData: this.detailedData, // 包含全量详细数据
      detailedAnalytics: {
        countryDeviceCombination: convertCombinationData(this.detailedCombinations.countryDevice),
        countryAdFormatCombination: convertCombinationData(this.detailedCombinations.countryAdFormat),
        deviceAdFormatCombination: convertCombinationData(this.detailedCombinations.deviceAdFormat),
        websiteCountryCombination: convertCombinationData(this.detailedCombinations.websiteCountry),
        adUnitAdFormatCombination: convertCombinationData(this.detailedCombinations.adUnitAdFormat)
      },
      fillRateDistribution: this.fillRateDistribution,
      processedAt: new Date().toISOString()
    }
  }
  
  // 彻底清理
  cleanup() {
    Object.keys(this.topData).forEach(key => {
      this.topData[key as keyof typeof this.topData] = {}
    })
    Object.keys(this.detailedCombinations).forEach(key => {
      this.detailedCombinations[key as keyof typeof this.detailedCombinations] = {}
    })
    this.samplePreview.length = 0
    this.detailedData.length = 0
  }
}