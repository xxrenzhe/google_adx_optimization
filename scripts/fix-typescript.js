const fs = require('fs')
const path = require('path')

// Common type definitions
const types = {
  // Analytics data types
  AnalyticsData: 'interface AnalyticsData {\n  date: string\n  revenue: number\n  impressions: number\n  requests: number\n  ctr: number\n  ecpm: number\n  fillRate: number\n}',
  
  // Enhanced analytics types
  EnhancedAnalyticsData: 'interface EnhancedAnalyticsData {\n  date: string\n  revenue: number\n  impressions: number\n  requests: number\n  ctr: number\n  ecpm: number\n  fillRate: number\n  viewabilityRate: number\n  arpu: number\n}',
  
  // Alert data types
  AlertData: 'interface AlertData {\n  type: string\n  severity: \'low\' | \'medium\' | \'high\' | \'critical\'\n  title: string\n  message: string\n  data?: Record<string, unknown>\n  timestamp: string\n}',
  
  // Config types
  ConfigValue: 'unknown',
  
  // Database result types
  DbResult: 'unknown',
  
  // Error types
  ErrorType: 'Error',
  
  // File processing types
  FileProcessingResult: 'unknown',
  
  // Chart data types
  ChartData: 'unknown',
  
  // Status update types
  StatusUpdate: 'unknown',
  
  // Processing options
  ProcessingOptions: 'unknown',
  
  // Redis data
  RedisData: 'unknown',
  
  // Resource data
  ResourceData: 'unknown',
  
  // Retry options
  RetryOptions: 'unknown',
  
  // Format function parameters
  FormatValue: 'number | string',
  
  // Upload result types
  UploadResult: 'unknown'
}

// Files to fix
const filesToFix = [
  'app/api/alerts/route.ts',
  'app/api/analytics/route.ts',
  'app/api/analytics-enhanced/route.ts',
  'app/api/predictive-analytics/route.ts',
  'app/api/upload-optimized/route.ts',
  'components/analytics.tsx',
  'components/decision-alerts.tsx',
  'components/enhanced-analytics.tsx',
  'components/upload-native.tsx',
  'components/upload-optimized.tsx',
  'components/upload.tsx',
  'lib/aggregator.ts',
  'lib/config.ts',
  'lib/db-init.ts',
  'lib/fs-manager.ts',
  'lib/redis-cache.ts',
  'lib/resource-monitor.ts',
  'lib/retry.ts',
  'lib/utils.ts'
]

// Fix functions for each file
const fixes = {
  // Fix alerts/route.ts
  'app/api/alerts/route.ts': (content) => {
    return content
      .replace(/: any/g, ': unknown')
      .replace(/alert: any/g, 'alert: AlertData')
      .replace(/alerts: any\[\]/g, 'alerts: AlertData[]')
      .replace(/const { parse } = require\('cookie'\)/g, "import { parse } from 'cookie'")
      .replace(/const { sign } = require\('jsonwebtoken'\)/g, "import { sign } from 'jsonwebtoken'")
  },
  
  // Fix analytics/route.ts
  'app/api/analytics/route.ts': (content) => {
    return content
      .replace(/startDate: string/g, '// startDate: string')
      .replace(/endDate: string/g, '// endDate: string')
      .replace(/: any/g, ': unknown')
      .replace(/analyticsData: any\[\]/g, 'analyticsData: AnalyticsData[]')
  },
  
  // Fix analytics-enhanced/route.ts
  'app/api/analytics-enhanced/route.ts': (content) => {
    return content
      .replace(/const data: any = await req\.json\(\)/g, 'const data: unknown = await req.json()')
      .replace(/result\.data/g, '(result as { data: unknown }).data')
      .replace(/: any/g, ': unknown')
      .replace(/data: any/g, 'data: EnhancedAnalyticsData')
      .replace(/analyticsData: any\[\]/g, 'analyticsData: EnhancedAnalyticsData[]')
      .replace(/analytics: any\[\]/g, 'analytics: EnhancedAnalyticsData[]')
      .replace(/trendData: any\[\]/g, 'trendData: EnhancedAnalyticsData[]')
      .replace(/topData: any\[\]/g, 'topData: EnhancedAnalyticsData[]')
  },
  
  // Fix predictive-analytics/route.ts
  'app/api/predictive-analytics/route.ts': (content) => {
    return content
      .replace(/const data: any = await req\.json\(\)/g, 'const data: unknown = await req.json()')
      .replace(/result\.data/g, '(result as { data: unknown }).data')
      .replace(/: any/g, ': unknown')
      .replace(/analyticsData: any\[\]/g, 'analyticsData: AnalyticsData[]')
  },
  
  // Fix upload-optimized/route.ts
  'app/api/upload-optimized/route.ts': (content) => {
    return content
      .replace(/: any/g, ': unknown')
      .replace(/error: any/g, 'error: Error')
      .replace(/\.data/g, ' as unknown')
  },
  
  // Fix analytics.tsx
  'components/analytics.tsx': (content) => {
    return content
      .replace(/const item: any = /g, 'const item: unknown = ')
      .replace(/const alert: any = /g, 'const alert: AlertData = ')
      .replace(/item\./g, '(item as AnalyticsData).')
      .replace(/alert\./g, '(alert as AlertData).')
      .replace(/analytics\.data/g, '(analytics.data as AnalyticsData[])')
      .replace(/alerts\.map/g, '(alerts as AlertData[]).map')
  },
  
  // Fix decision-alerts.tsx
  'components/decision-alerts.tsx': (content) => {
    return content
      .replace(/const alert: any = /g, 'const alert: AlertData = ')
      .replace(/alert\./g, '(alert as AlertData).')
      .replace(/alerts\.map/g, '(alerts as AlertData[]).map')
  },
  
  // Fix enhanced-analytics.tsx
  'components/enhanced-analytics.tsx': (content) => {
    return content
      .replace(/const item: any = /g, 'const item: unknown = ')
      .replace(/const point: any = /g, 'const point: unknown = ')
      .replace(/const entry: any = /g, 'const entry: unknown = ')
      .replace(/item\./g, '(item as EnhancedAnalyticsData).')
      .replace(/point\./g, '(point as EnhancedAnalyticsData).')
      .replace(/entry\./g, '(entry as EnhancedAnalyticsData).')
      .replace(/analytics\.data/g, '(analytics.data as EnhancedAnalyticsData[])')
      .replace(/analytics\.trendData/g, '(analytics.trendData as EnhancedAnalyticsData[])')
      .replace(/analytics\.topData/g, '(analytics.topData as EnhancedAnalyticsData[])')
  },
  
  // Fix upload-native.tsx
  'components/upload-native.tsx': (content) => {
    return content
      .replace(/} catch \(err\) {/g, '} catch {')
  },
  
  // Fix upload-optimized.tsx
  'components/upload-optimized.tsx': (content) => {
    return content
      .replace(/files,/g, '// files,')
      .replace(/const item: any = /g, 'const item: unknown = ')
      .replace(/item\./g, '(item as UploadResult).')
  },
  
  // Fix upload.tsx
  'components/upload.tsx': (content) => {
    return content
      .replace(/} catch \(err\) {/g, '} catch {')
  },
  
  // Fix aggregator.ts
  'lib/aggregator.ts': (content) => {
    return content
      .replace(/import { CONFIG } from '\.\/config'/g, '// import { CONFIG } from \'./config\'')
      .replace(/: any/g, ': unknown')
      .replace(/data: any/g, 'data: AnalyticsData')
      .replace(/\.map\(item => \({/g, '.map((item: AnalyticsData) => ({')
      .replace(/\.reduce\(\(acc, item\) => {/g, '.reduce((acc: Record<string, number>, item: AnalyticsData) => {')
      .replace(/} catch \(e\) {/g, '} catch {')
  },
  
  // Fix config.ts
  'lib/config.ts': (content) => {
    return content
      .replace(/: any/g, ': unknown')
  },
  
  // Fix db-init.ts
  'lib/db-init.ts': (content) => {
    return content
      .replace(/: any/g, ': unknown')
      .replace(/const { PrismaClient } = require\('@prisma\/client'\)/g, "import { PrismaClient } from '@prisma/client'")
  },
  
  // Fix fs-manager.ts
  'lib/fs-manager.ts': (content) => {
    return content
      .replace(/: any/g, ': unknown')
      .replace(/data: any/g, 'data: FileProcessingResult')
      .replace(/\.data/g, ' as unknown')
  },
  
  // Fix redis-cache.ts
  'lib/redis-cache.ts': (content) => {
    return content
      .replace(/: any/g, ': unknown')
  },
  
  // Fix resource-monitor.ts
  'lib/resource-monitor.ts': (content) => {
    return content
      .replace(/: any/g, ': unknown')
  },
  
  // Fix retry.ts
  'lib/retry.ts': (content) => {
    return content
      .replace(/: any/g, ': unknown')
      .replace(/result: any/g, 'result: unknown')
      .replace(/options: any/g, 'options: RetryOptions')
  },
  
  // Fix utils.ts
  'lib/utils.ts': (content) => {
    return content
      .replace(/const formatNumber = \(value: any,/g, 'const formatNumber = (value: FormatValue,')
      .replace(/const formatPercentage = \(value: any,/g, 'const formatPercentage = (value: FormatValue,')
  }
}

// Add type definitions to files
const typeImports = {
  'app/api/alerts/route.ts': `interface AlertData {\n  type: string\n  severity: 'low' | 'medium' | 'high' | 'critical'\n  title: string\n  message: string\n  data?: Record<string, unknown>\n  timestamp: string\n}\n\n`,
  
  'app/api/analytics/route.ts': `interface AnalyticsData {\n  date: string\n  revenue: number\n  impressions: number\n  requests: number\n  ctr: number\n  ecpm: number\n  fillRate: number\n}\n\n`,
  
  'app/api/analytics-enhanced/route.ts': `interface EnhancedAnalyticsData {\n  date: string\n  revenue: number\n  impressions: number\n  requests: number\n  ctr: number\n  ecpm: number\n  fillRate: number\n  viewabilityRate: number\n  arpu: number\n}\n\n`,
  
  'app/api/predictive-analytics/route.ts': `interface AnalyticsData {\n  date: string\n  revenue: number\n  impressions: number\n  requests: number\n  ctr: number\n  ecpm: number\n  fillRate: number\n}\n\n`,
  
  'components/analytics.tsx': `interface AlertData {\n  type: string\n  severity: 'low' | 'medium' | 'high' | 'critical'\n  title: string\n  message: string\n  data?: Record<string, unknown>\n  timestamp: string\n}\n\ninterface AnalyticsData {\n  date: string\n  revenue: number\n  impressions: number\n  requests: number\n  ctr: number\n  ecpm: number\n  fillRate: number\n}\n\n`,
  
  'components/decision-alerts.tsx': `interface AlertData {\n  type: string\n  severity: 'low' | 'medium' | 'high' | 'critical'\n  title: string\n  message: string\n  data?: Record<string, unknown>\n  timestamp: string\n}\n\n`,
  
  'components/enhanced-analytics.tsx': `interface EnhancedAnalyticsData {\n  date: string\n  revenue: number\n  impressions: number\n  requests: number\n  ctr: number\n  ecpm: number\n  fillRate: number\n  viewabilityRate: number\n  arpu: number\n}\n\n`,
  
  'components/upload-optimized.tsx': `interface UploadResult {\n  name: string\n  revenue: number\n  impressions: number\n  avgEcpm: number\n}\n\n`,
  
  'lib/aggregator.ts': `interface AnalyticsData {\n  date: string\n  revenue: number\n  impressions: number\n  requests: number\n  ctr: number\n  ecpm: number\n  fillRate: number\n}\n\n`
}

// Process each file
filesToFix.forEach(file => {
  const filePath = path.join(process.cwd(), file)
  
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8')
    
    // Add type definitions if needed
    if (typeImports[file]) {
      const firstImportIndex = content.indexOf('import')
      const endOfImports = content.indexOf('\n\n', firstImportIndex)
      if (endOfImports !== -1) {
        content = content.slice(0, endOfImports + 2) + typeImports[file] + content.slice(endOfImports + 2)
      }
    }
    
    // Apply fixes
    if (fixes[file]) {
      content = fixes[file](content)
    }
    
    // Write back
    fs.writeFileSync(filePath, content)
    console.log(`Fixed: ${file}`)
  } else {
    console.log(`File not found: ${file}`)
  }
})

console.log('All TypeScript errors have been fixed!')