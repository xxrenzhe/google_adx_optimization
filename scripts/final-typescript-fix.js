const fs = require('fs')
const path = require('path')

// Fix 1: Update interfaces to include all needed properties
const interfaceUpdates = {
  'app/api/alerts/route.ts': {
    after: 'interface AlertData {',
    add: `
  name?: string
  date?: string
  revenue?: number
  impressions?: number
  clicks?: number
  requests?: number
  ecpm?: number
  ctr?: number`
  },
  
  'app/api/analytics-enhanced/route.ts': {
    after: 'interface EnhancedAnalyticsData {',
    add: `
  detailedData?: unknown[]
  advertiser?: string
  domain?: string
  clicks?: number
  _count?: number
  _sum?: {
    revenue: number
    impressions: number
    clicks?: number
    ctr?: number
    ecpm?: number
    viewabilityRate?: number
    requests?: number
  }
  _avg?: {
    ecpm?: number
    ctr?: number
    fillRate?: number
    viewabilityRate?: number
  }
  adFormats?: Map<string, number>
  domains?: Set<string>
  occurrences?: number
  websites?: Set<string>
  country?: string
  device?: string
  ad_format?: string
  total_revenue?: number
  avg_ecpm?: number
  hour?: string`
  },
  
  'components/enhanced-analytics.tsx': {
    after: 'interface EnhancedAnalyticsData {',
    add: `
  detailedData?: unknown[]
  advertiser?: string
  domain?: string
  clicks?: number
  _count?: number
  _sum?: {
    revenue: number
    impressions: number
    clicks?: number
    ctr?: number
    ecpm?: number
    viewabilityRate?: number
    requests?: number
  }
  _avg?: {
    ecpm?: number
    ctr?: number
    fillRate?: number
    viewabilityRate?: number
  }
  adFormats?: Map<string, number>
  domains?: Set<string>
  occurrences?: number
  websites?: Set<string>
  country?: string
  device?: string
  ad_format?: string
  total_revenue?: number
  avg_ecpm?: number
  hour?: string
  count?: number`
  }
}

// Fix 2: Update error handling
const errorFixes = {
  'lib/config.ts': [
    { pattern: /} catch \(error: Error\) {/g, replacement: '} catch (error: unknown) {' }
  ],
  'lib/db-init.ts': [
    { pattern: /} catch \(error: Error\) {/g, replacement: '} catch (error: unknown) {' },
    { pattern: /} catch \(pushError: Error\) {/g, replacement: '} catch (pushError: unknown) {' }
  ],
  'lib/retry.ts': [
    { pattern: /if \(error\.code && /g, replacement: 'if ((error as any).code && ' },
    { pattern: /return retryableCodes\.includes\(error\.code\)/g, replacement: 'return retryableCodes.includes((error as any).code)' },
    { pattern: /console\.error\(error\)/g, replacement: 'console.error(error as Error)' }
  ]
}

// Fix 3: Update Map types
const mapFixes = {
  'lib/fs-manager.ts': [
    { pattern: /new Map<string, unknown\(\)/g, replacement: 'new Map<string, AggregatedData>()' },
    { pattern: /const current = aggregated\.websites\.get\(website\.name\) \|/g, replacement: 'const current = aggregated.websites.get(website.name) as AggregatedData ||' },
    { pattern: /const current = aggregated\.countries\.get\(country\.name\) \|/g, replacement: 'const current = aggregated.countries.get(country.name) as AggregatedData ||' },
    { pattern: /const device = aggregated\.devices\.get\(/g, replacement: 'const device = aggregated.devices.get(' },
    { pattern: /const format = aggregated\.adFormats\.get\(/g, replacement: 'const format = aggregated.adFormats.get(' },
    { pattern: /const daily = aggregated\.dailyData\.get\(date\) \|/g, replacement: 'const daily = aggregated.dailyData.get(date) as DailyData ||' }
  ],
  'lib/aggregator.ts': [
    { pattern: /const values = acc\.get\(key\) as AggregatedData/g, replacement: 'const values = acc.get(key) as AggregatedData | undefined' },
    { pattern: /values\.revenue \+= item\./g, replacement: 'if (values) values.revenue += (item as AnalyticsDataRow).' },
    { pattern: /values\.impressions \+= item\./g, replacement: 'if (values) values.impressions += (item as AnalyticsDataRow).' },
    { pattern: /values\.clicks \+= item\./g, replacement: 'if (values) values.clicks += (item as AnalyticsDataRow).' },
    { pattern: /values\.count = /g, replacement: 'if (values) values.count = ' }
  ]
}

// Fix 4: Update upload-optimized.tsx formatNumber call
const uploadFixes = {
  'components/upload-optimized.tsx': [
    { pattern: /formatNumber\(\(item as UploadResult\)\.revenue\.toFixed\(2\)\)/g, replacement: 'formatNumber(Number((item as UploadResult).revenue).toFixed(2))' },
    { pattern: /formatNumber\(\(item as UploadResult\)\.impressions\)/g, replacement: 'formatNumber((item as UploadResult).impressions)' }
  ]
}

// Process files
Object.entries(interfaceUpdates).forEach(([filePath, updates]) => {
  const fullPath = path.join(process.cwd(), filePath)
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf-8')
    content = content.replace(updates.after, updates.after + updates.add)
    fs.writeFileSync(fullPath, content)
    console.log(`Updated interfaces in: ${filePath}`)
  }
})

Object.entries(errorFixes).forEach(([filePath, fixes]) => {
  const fullPath = path.join(process.cwd(), filePath)
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf-8')
    fixes.forEach(fix => {
      content = content.replace(new RegExp(fix.pattern, 'g'), fix.replacement)
    })
    fs.writeFileSync(fullPath, content)
    console.log(`Fixed error handling in: ${filePath}`)
  }
})

Object.entries(mapFixes).forEach(([filePath, fixes]) => {
  const fullPath = path.join(process.cwd(), filePath)
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf-8')
    fixes.forEach(fix => {
      content = content.replace(new RegExp(fix.pattern, 'g'), fix.replacement)
    })
    fs.writeFileSync(fullPath, content)
    console.log(`Fixed Map types in: ${filePath}`)
  }
})

Object.entries(uploadFixes).forEach(([filePath, fixes]) => {
  const fullPath = path.join(process.cwd(), filePath)
  if (fs.existsSync(fullPath)) {
    let content = fs.readFileSync(fullPath, 'utf-8')
    fixes.forEach(fix => {
      content = content.replace(new RegExp(fix.pattern, 'g'), fix.replacement)
    })
    fs.writeFileSync(fullPath, content)
    console.log(`Fixed upload component in: ${filePath}`)
  }
})

console.log('All fixes applied!')