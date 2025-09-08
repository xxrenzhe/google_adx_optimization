// Google ADX Optimization System - Type Definitions

// 核心业务类型
export interface AdData {
  date: string
  website: string
  country?: string
  adFormat?: string
  adUnit?: string
  advertiser?: string
  domain?: string
  device?: string
  browser?: string
  requests: number
  impressions: number
  clicks: number
  ctr?: number
  ecpm?: number
  revenue: number
  viewableImpressions?: number
  viewabilityRate?: number
  measurableImpressions?: number
}

// 聚合指标数据
export interface MetricData {
  revenue: number
  impressions: number
  clicks: number
  requests: number
  avgEcpm?: number
  ctr?: number
}

// 带名称的指标数据
export interface NamedMetricData extends MetricData {
  name: string
}

// 分析结果摘要
export interface AnalysisSummary {
  totalRows: number
  totalRevenue: number
  totalImpressions: number
  totalClicks: number
  totalRequests: number
  avgEcpm: number
  avgCtr: number
}

// 详细分析结果
export interface AnalysisResult {
  fileId: string
  fileName: string
  summary: AnalysisSummary
  topWebsites: NamedMetricData[]
  topCountries: NamedMetricData[]
  dailyTrend: DailyTrendData[]
  devices: NamedMetricData[]
  adFormats: NamedMetricData[]
  advertisers: NamedMetricData[]
  domains: NamedMetricData[]
  browsers: NamedMetricData[]
  adUnits: NamedMetricData[]
  detailedAnalytics: {
    countryDeviceCombination: NamedMetricData[]
    countryAdFormatCombination: NamedMetricData[]
    deviceAdFormatCombination: NamedMetricData[]
    websiteCountryCombination: NamedMetricData[]
    adUnitAdFormatCombination: NamedMetricData[]
  }
  samplePreview: AdData[]
  fillRateDistribution: Record<string, number>
  processedAt: string
}

// 每日趋势数据
export interface DailyTrendData {
  date: string
  revenue: number
  impressions: number
  clicks: number
  requests: number
  avgEcpm: number
  ctr: number
}

// 上传状态
export type UploadStatus = 'processing' | 'completed' | 'failed' | 'not_found' | 'expired'

// 上传状态信息
export interface UploadStatusInfo {
  status: UploadStatus
  progress?: number
  processedLines?: number
  fileName?: string
  fileSize?: number
  uploadTime?: string
  error?: string
  completedAt?: string
  resultPath?: string
}

// 文件上传结果
export interface UploadResult {
  fileId: string
  message: string
  fileName: string
  fileSize: number
  error?: string
}

// 带进度的文件
export interface FileWithProgress {
  file: File
  id: string
  status: 'uploading' | 'processing' | 'completed' | 'failed'
  progress: number
  result?: UploadResult
  error?: string
}

// 上传组件Props
export interface UploadProps {
  fileId: string | null
  onFileUploaded: (fileId: string) => void
  onClearFile: () => void
}

// 列名映射配置
export interface ColumnMapping {
  date: string[]
  website: string[]
  country: string[]
  adFormat: string[]
  adUnit: string[]
  advertiser: string[]
  domain: string[]
  device: string[]
  browser: string[]
  requests: string[]
  impressions: string[]
  clicks: string[]
  ctr: string[]
  ecpm: string[]
  revenue: string[]
  viewableImpressions: string[]
  viewabilityRate: string[]
  measurableImpressions: string[]
}

// CSV处理选项
export interface CsvProcessingOptions {
  maxFileSize: number
  batchSize: number
  progressUpdateInterval: number
  sampleSize: number
}

// 填充率分布
export interface FillRateDistribution {
  "0-20%": number
  "20-40%": number
  "40-60%": number
  "60-80%": number
  "80-100%": number
}

// API响应类型
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// 错误类型
export class UploadError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any
  ) {
    super(message)
    this.name = 'UploadError'
  }
}

export class ValidationError extends UploadError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details)
  }
}

export class FileSystemError extends UploadError {
  constructor(message: string, details?: any) {
    super(message, 'FILESYSTEM_ERROR', details)
  }
}

export class ProcessingError extends UploadError {
  constructor(message: string, details?: any) {
    super(message, 'PROCESSING_ERROR', details)
  }
}