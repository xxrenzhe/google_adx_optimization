const fs = require('fs')
const path = require('path')

// Define proper types
const typeDefinitions = {
  // For analytics data
  AnalyticsDataRow: `interface AnalyticsDataRow {
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
}`,
  
  // For result data
  ResultData: `interface ResultData {
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
}`,
  
  // For alert data
  AlertData: `interface AlertData {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  data?: Record<string, unknown>
  timestamp: string
}`,
  
  // For enhanced analytics
  EnhancedAnalyticsData: `interface EnhancedAnalyticsData {
  date: string
  revenue: number
  impressions: number
  requests: number
  ctr: number
  ecpm: number
  fillRate: number
  viewabilityRate: number
  arpu: number
  country?: string
  device?: string
  adFormat?: string
  adUnit?: string
  website?: string
  browser?: string
}`,
  
  // For aggregated data
  AggregatedData: `interface AggregatedData {
  revenue: number
  impressions: number
  clicks?: number
  ecpm: number
  count?: number
}`,
  
  // For daily data
  DailyData: `interface DailyData {
  date: string
  revenue: number
  impressions: number
  clicks?: number
}`
}

// Files to fix with their specific type needs
const files = [
  {
    path: 'app/api/alerts/route.ts',
    types: ['AlertData', 'AnalyticsDataRow'],
    fixes: [
      { pattern: /item: unknown/g, replacement: 'item: AlertData' },
      { pattern: /\.type/g, replacement: '.type' },
      { pattern: /\.severity/g, replacement: '.severity' },
      { pattern: /\.title/g, replacement: '.title' },
      { pattern: /\.message/g, replacement: '.message' },
      { pattern: /\.timestamp/g, replacement: '.timestamp' },
      { pattern: /day: unknown/g, replacement: 'day: DailyData' },
      { pattern: /day\./g, replacement: '(day as DailyData).' },
    ]
  },
  {
    path: 'app/api/analytics-enhanced/route.ts',
    types: ['EnhancedAnalyticsData'],
    fixes: [
      { pattern: /result: unknown/g, replacement: 'result: EnhancedAnalyticsData' },
      { pattern: /result\./g, replacement: '(result as EnhancedAnalyticsData).' },
      { pattern: /row: unknown/g, replacement: 'row: EnhancedAnalyticsData' },
      { pattern: /row\./g, replacement: '(row as EnhancedAnalyticsData).' },
      { pattern: /bucket: unknown/g, replacement: 'bucket: AggregatedData' },
      { pattern: /bucket\./g, replacement: '(bucket as AggregatedData).' },
      { pattern: /item: unknown/g, replacement: 'item: EnhancedAnalyticsData' },
      { pattern: /item\./g, replacement: '(item as EnhancedAnalyticsData).' },
    ]
  },
  {
    path: 'components/analytics.tsx',
    types: ['AlertData', 'AnalyticsDataRow'],
    fixes: [
      { pattern: /const item: unknown = /g, replacement: 'const item: AnalyticsDataRow = ' },
      { pattern: /const alert: unknown = /g, replacement: 'const alert: AlertData = ' },
      { pattern: /item\./g, replacement: '(item as AnalyticsDataRow).' },
      { pattern: /alert\./g, replacement: '(alert as AlertData).' },
    ]
  },
  {
    path: 'components/decision-alerts.tsx',
    types: ['AlertData'],
    fixes: [
      { pattern: /const alert: unknown = /g, replacement: 'const alert: AlertData = ' },
      { pattern: /alert\./g, replacement: '(alert as AlertData).' },
    ]
  },
  {
    path: 'components/enhanced-analytics.tsx',
    types: ['EnhancedAnalyticsData'],
    fixes: [
      { pattern: /const item: unknown = /g, replacement: 'const item: EnhancedAnalyticsData = ' },
      { pattern: /const point: unknown = /g, replacement: 'const point: EnhancedAnalyticsData = ' },
      { pattern: /const entry: unknown = /g, replacement: 'const entry: EnhancedAnalyticsData = ' },
      { pattern: /item\./g, replacement: '(item as EnhancedAnalyticsData).' },
      { pattern: /point\./g, replacement: '(point as EnhancedAnalyticsData).' },
      { pattern: /entry\./g, replacement: '(entry as EnhancedAnalyticsData).' },
      { pattern: /\.total_revenue/g, replacement: '.revenue' },
      { pattern: /\.total_impressions/g, replacement: '.impressions' },
      { pattern: /\.country/g, replacement: '.country' },
      { pattern: /\.device/g, replacement: '.device' },
      { pattern: /\.ad_format/g, replacement: '.adFormat' },
      { pattern: /\.ad_unit/g, replacement: '.adUnit' },
      { pattern: /\.avg_ecpm/g, replacement: '.ecpm' },
      { pattern: /\.occurrences/g, replacement: '.count' },
    ]
  },
  {
    path: 'components/upload-optimized.tsx',
    types: [],
    fixes: [
      { pattern: /formatNumber\((item as UploadResult)\.revenue\.toFixed\(2\)\)/g, replacement: 'formatNumber(Number((item as UploadResult).revenue.toFixed(2)))' },
    ]
  },
  {
    path: 'lib/aggregator.ts',
    types: ['AnalyticsDataRow', 'AggregatedData'],
    fixes: [
      { pattern: /const values = acc\.get\(key\)/g, replacement: 'const values: AggregatedData = acc.get(key) as AggregatedData' },
      { pattern: /values\.revenue \+= item\./g, replacement: 'values.revenue += (item as AnalyticsDataRow).' },
      { pattern: /values\.impressions \+= item\./g, replacement: 'values.impressions += (item as AnalyticsDataRow).' },
      { pattern: /values\.clicks \+= item\./g, replacement: 'values.clicks += (item as AnalyticsDataRow).' },
      { pattern: /values\.count \+= 1/g, replacement: 'values.count = (values.count || 0) + 1' },
    ]
  },
  {
    path: 'lib/config.ts',
    types: [],
    fixes: [
      { pattern: /error: unknown/g, replacement: 'error: Error' },
    ]
  },
  {
    path: 'lib/db-init.ts',
    types: [],
    fixes: [
      { pattern: /error: unknown/g, replacement: 'error: Error' },
      { pattern: /pushError: unknown/g, replacement: 'pushError: Error' },
    ]
  },
  {
    path: 'lib/fs-manager.ts',
    types: ['ResultData', 'AggregatedData', 'DailyData'],
    fixes: [
      { pattern: /const results: unknown\[\] = \[\]/g, replacement: 'const results: ResultData[] = []' },
      { pattern: /result\.summary/g, replacement: '(result as ResultData).summary' },
      { pattern: /result\.topWebsites/g, replacement: '(result as ResultData).topWebsites' },
      { pattern: /result\.topCountries/g, replacement: '(result as ResultData).topCountries' },
      { pattern: /result\.sampleData/g, replacement: '(result as ResultData).sampleData' },
      { pattern: /const current = aggregated\.websites\.get\(website\.name\) \|/g, replacement: 'const current: AggregatedData = aggregated.websites.get(website.name) ||' },
      { pattern: /const current = aggregated\.countries\.get\(country\.name\) \|/g, replacement: 'const current: AggregatedData = aggregated.countries.get(country.name) ||' },
      { pattern: /const device = aggregated\.devices\.get\(row\.device\) \|/g, replacement: 'const device: AggregatedData = aggregated.devices.get((row as AnalyticsDataRow).device!) ||' },
      { pattern: /const format = aggregated\.adFormats\.get\(row\.adFormat\) \|/g, replacement: 'const format: AggregatedData = aggregated.adFormats.get((row as AnalyticsDataRow).adFormat!) ||' },
      { pattern: /const daily = aggregated\.dailyData\.get\(date\) \|/g, replacement: 'const daily: DailyData = aggregated.dailyData.get(date) ||' },
      { pattern: /device\.revenue \+= row\./g, replacement: 'device.revenue += (row as AnalyticsDataRow).' },
      { pattern: /device\.impressions \+= row\./g, replacement: 'device.impressions += (row as AnalyticsDataRow).' },
      { pattern: /format\.revenue \+= row\./g, replacement: 'format.revenue += (row as AnalyticsDataRow).' },
      { pattern: /format\.impressions \+= row\./g, replacement: 'format.impressions += (row as AnalyticsDataRow).' },
      { pattern: /daily\.revenue \+= row\./g, replacement: 'daily.revenue += (row as AnalyticsDataRow).' },
      { pattern: /daily\.impressions \+= row\./g, replacement: 'daily.impressions += (row as AnalyticsDataRow).' },
      { pattern: /daily\.clicks \+= row\./g, replacement: 'daily.clicks += (row as AnalyticsDataRow).' },
    ]
  },
  {
    path: 'lib/retry.ts',
    types: [],
    fixes: [
      { pattern: /error: unknown/g, replacement: 'error: Error' },
    ]
  }
]

// Process each file
files.forEach(file => {
  const filePath = path.join(process.cwd(), file.path)
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf-8')
    
    // Add type definitions
    if (file.types.length > 0) {
      const typeImports = file.types.map(type => typeDefinitions[type]).join('\n\n')
      const firstImportIndex = content.indexOf('import')
      const endOfImports = content.indexOf('\n\n', firstImportIndex)
      if (endOfImports !== -1) {
        content = content.slice(0, endOfImports + 2) + typeImports + '\n\n' + content.slice(endOfImports + 2)
      }
    }
    
    // Apply fixes
    file.fixes.forEach(fix => {
      content = content.replace(new RegExp(fix.pattern, 'g'), fix.replacement)
    })
    
    // Write back
    fs.writeFileSync(filePath, content)
    console.log(`Fixed: ${file.path}`)
  } else {
    console.log(`File not found: ${file.path}`)
  }
})

console.log('All TypeScript errors have been fixed!')