import { 
  UploadError, 
  ValidationError, 
  FileSystemError, 
  ProcessingError,
  type ColumnMapping,
  type AdData,
  type MetricData,
  type AnalysisSummary,
  type NamedMetricData,
  type DailyTrendData,
  type FillRateDistribution
} from '@/types'

// 列名映射配置
export const COLUMN_MAPPINGS: ColumnMapping = {
  date: ['日期', 'Date'],
  website: ['网站', 'Website'],
  country: ['国家/地区', '国家', 'Country'],
  adFormat: ['广告资源格式', '广告格式', 'Ad Format'],
  adUnit: ['广告单元（所有级别）', '广告单元', 'Ad Unit'],
  advertiser: ['广告客户（已分类）', '广告客户', 'Advertiser'],
  domain: ['广告客户网域', '域名', 'Domain'],
  device: ['设备', 'Device'],
  browser: ['浏览器', 'Browser'],
  requests: ['Ad Exchange 请求总数', '请求数', 'Requests'],
  impressions: ['Ad Exchange 展示次数', '展示数', 'Impressions'],
  clicks: ['Ad Exchange 点击次数', '点击数', 'Clicks'],
  ctr: ['Ad Exchange 点击率', '点击率', 'CTR'],
  ecpm: ['Ad Exchange 平均 eCPM', 'eCPM', 'CPM'],
  revenue: ['Ad Exchange 收入', '收入', 'Revenue'],
  viewableImpressions: ['Ad Exchange Active View可见展示次数', '可见展示', 'Viewable Impressions'],
  viewabilityRate: ['Ad Exchange Active View可见展示次数百分比', '可见率', 'Viewability Rate'],
  measurableImpressions: ['Ad Exchange Active View可衡量展示次数', '可衡量展示', 'Measurable Impressions']
}

// 常量配置
export const CONFIG = {
  MAX_FILE_SIZE: 200 * 1024 * 1024, // 200MB
  UPLOAD_DIR: './uploads',
  RESULTS_DIR: './results',
  BATCH_SIZE: 1000,
  PROGRESS_UPDATE_INTERVAL: 10,
  SAMPLE_SIZE: 100,
  REQUIRED_COLUMNS: ['date', 'website'] as const
} as const

// 创建列名到索引的映射
export function createColumnMap(headers: string[]): Record<string, number> {
  const columnMap: Record<string, number> = {}
  
  headers.forEach((header, index) => {
    const normalizedHeader = header.trim().toLowerCase()
    
    // 检查每个可能的列类型
    for (const [columnType, possibleNames] of Object.entries(COLUMN_MAPPINGS)) {
      for (const name of possibleNames) {
        if (normalizedHeader === name.toLowerCase()) {
          if (columnMap[columnType] !== undefined) {
            console.log(`[WARNING] Column "${header}" conflicts with already mapped ${columnType} at index ${columnMap[columnType]}`)
          }
          columnMap[columnType] = index
          console.log(`[DEBUG] Mapped column "${header}" to ${columnType} at index ${index}`)
          break
        }
      }
    }
  })
  
  // 检查必需列
  const missingColumns = CONFIG.REQUIRED_COLUMNS.filter(col => columnMap[col] === undefined)
  if (missingColumns.length > 0) {
    console.log(`[DEBUG] Missing required columns: ${missingColumns.join(', ')}`)
    console.log(`[DEBUG] Available headers: ${headers.join(', ')}`)
  }
  
  return columnMap
}

// 解析CSV行，正确处理带引号的字段
export function parseCSVLine(line: string): string[] {
  const cols: string[] = []
  let current = ''
  let inQuotes = false
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      cols.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  cols.push(current.trim())
  
  return cols
}

// 验证文件
export function validateFile(file: File): void {
  if (!file) {
    throw new ValidationError('没有找到文件')
  }
  
  if (file.size > CONFIG.MAX_FILE_SIZE) {
    throw new ValidationError(`文件过大，请上传小于${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB的文件`)
  }
  
  if (!file.name.endsWith('.csv')) {
    throw new ValidationError('只支持CSV格式文件')
  }
}

// 更新聚合器数据
export function updateAggregator(
  map: Map<string, MetricData>,
  key: string,
  data: MetricData
): void {
  const current = map.get(key) || { revenue: 0, impressions: 0, clicks: 0, requests: 0 }
  current.revenue += data.revenue
  current.impressions += data.impressions
  current.clicks += data.clicks
  current.requests += data.requests
  map.set(key, current)
}

// 获取Top N项目
export function getTopItems(map: Map<string, MetricData>, limit: number): NamedMetricData[] {
  return Array.from(map.entries())
    .map(([name, data]) => ({
      name,
      ...data,
      avgEcpm: data.impressions > 0 ? (data.revenue / data.impressions * 1000) : 0,
      ctr: data.impressions > 0 ? (data.clicks / data.impressions * 100) : 0
    }))
    .filter(item => item.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit)
}

// 计算填充率分布
export function updateFillRateDistribution(
  distribution: FillRateDistribution,
  fillRate: number
): void {
  if (fillRate < 20) {
    distribution["0-20%"]++
  } else if (fillRate < 40) {
    distribution["20-40%"]++
  } else if (fillRate < 60) {
    distribution["40-60%"]++
  } else if (fillRate < 80) {
    distribution["60-80%"]++
  } else {
    distribution["80-100%"]++
  }
}

// 计算每日趋势
export function calculateDailyTrend(
  datesMap: Map<string, MetricData>
): DailyTrendData[] {
  return Array.from(datesMap.entries())
    .map(([date, data]) => ({
      date,
      ...data,
      avgEcpm: data.impressions > 0 ? (data.revenue / data.impressions * 1000) : 0,
      ctr: data.impressions > 0 ? (data.clicks / data.impressions * 100) : 0
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

// 智能数据检测和纠正
export function detectAndCorrectDataIssues(
  data: Partial<AdData>,
  lineIndex: number
): Partial<AdData> {
  const corrected = { ...data }
  const detectedIssues: string[] = []
  
  // 1. 如果国家列包含广告格式关键词
  if (corrected.country && (
    corrected.country.includes('广告') || 
    corrected.country.includes('Ad') || 
    corrected.country.includes('ad') || 
    corrected.country.includes('插页') || 
    corrected.country.includes('横幅') || 
    corrected.country.includes('视频') ||
    corrected.country.includes('原生') || 
    corrected.country.includes('激励') || 
    corrected.country.includes('Banner') ||
    corrected.country.includes('Interstitial') || 
    corrected.country.includes('Rewarded')
  )) {
    detectedIssues.push(`Country contains ad format: ${corrected.country}`)
    if (!corrected.adFormat || corrected.adFormat === 'Unknown') {
      corrected.adFormat = corrected.country
      corrected.country = 'Unknown'
    }
  }
  
  // 2. 如果网站列看起来像国家
  const countryCodes = ['US', 'CN', 'JP', 'KR', 'UK', 'DE', 'FR', 'IT', 'ES', 'BR', 'IN', 'RU', 'CA', 'AU']
  if (corrected.website && (
    countryCodes.includes(corrected.website.toUpperCase()) || 
    corrected.website.length === 2
  )) {
    detectedIssues.push(`Website looks like country: ${corrected.website}`)
  }
  
  // 3. 如果adFormat看起来像国家
  const knownCountries = ['中国', '美国', '日本', '韩国', '英国', '德国', '法国', '意大利', '西班牙', '巴西', '印度', '俄罗斯', '加拿大', '澳大利亚']
  if (corrected.adFormat && knownCountries.includes(corrected.adFormat)) {
    detectedIssues.push(`AdFormat looks like country: ${corrected.adFormat}`)
    if (!corrected.country || corrected.country === 'Unknown') {
      corrected.country = corrected.adFormat
      corrected.adFormat = 'Unknown'
    }
  }
  
  // 记录检测到的问题
  if (detectedIssues.length > 0 && lineIndex < 10) {
    console.log(`[DEBUG] Data issues detected at line ${lineIndex}:`, detectedIssues)
    console.log(`[DEBUG] After correction - country: ${corrected.country}, adFormat: ${corrected.adFormat}`)
  }
  
  return corrected
}

// 过滤数据
export function filterData(
  items: NamedMetricData[],
  type: 'websites' | 'countries' | 'devices' | 'adFormats'
): NamedMetricData[] {
  return items.filter(item => {
    switch (type) {
      case 'websites':
        // 过滤掉明显的非网站数据
        const isNotWebsite = item.name.length === 2 || 
                            ['中国', '美国', '日本', '广告', 'Ad'].includes(item.name) ||
                            item.name.includes('广告') || item.name.includes('插页')
        if (isNotWebsite && item.revenue > 0) {
          console.log(`[DEBUG] Filtered out non-website from websites: ${item.name} (revenue: ${item.revenue})`)
        }
        return !isNotWebsite
        
      case 'countries':
        // 过滤掉明显的广告格式
        const isAdFormat = item.name.includes('广告') || item.name.includes('Ad') || item.name.includes('ad') ||
                          item.name.includes('插页') || item.name.includes('横幅') || item.name.includes('视频') ||
                          item.name.includes('Banner') || item.name.includes('Interstitial')
        if (isAdFormat && item.revenue > 0) {
          console.log(`[DEBUG] Filtered out ad format from countries: ${item.name} (revenue: ${item.revenue})`)
        }
        return !isAdFormat
        
      case 'devices':
        // 过滤掉明显的国家或网站
        const isNotDevice = item.name.length === 2 || 
                           ['中国', '美国', '日本', '网站'].includes(item.name)
        if (isNotDevice && item.revenue > 0) {
          console.log(`[DEBUG] Filtered out non-device from devices: ${item.name} (revenue: ${item.revenue})`)
        }
        return !isNotDevice
        
      case 'adFormats':
        // 过滤掉明显的国家
        const isNotAdFormat = ['中国', '美国', '日本', 'Unknown'].includes(item.name)
        if (isNotAdFormat && item.revenue > 0) {
          console.log(`[DEBUG] Filtered out non-ad-format from adFormats: ${item.name} (revenue: ${item.revenue})`)
        }
        return !isNotAdFormat
        
      default:
        return true
    }
  })
}

// 创建分析结果摘要
export function createSummary(
  totalRows: number,
  totalRevenue: number,
  totalImpressions: number,
  totalClicks: number,
  totalRequests: number
): AnalysisSummary {
  return {
    totalRows,
    totalRevenue,
    totalImpressions,
    totalClicks,
    totalRequests,
    avgEcpm: totalImpressions > 0 ? (totalRevenue / totalImpressions) * 1000 : 0,
    avgCtr: totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0
  }
}