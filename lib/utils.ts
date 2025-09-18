import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 格式化数字
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toFixed(0)
}

// 格式化货币
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

// 格式化百分比
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// 计算百分比
export function calculatePercentage(value: number, total: number): number {
  if (total === 0) return 0
  return (value / total) * 100
}

// 生成唯一ID
export function generateId(): string {
  return crypto.randomUUID()
}

// 防抖函数
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null
  
  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout)
    }
    timeout = setTimeout(() => func(...args), wait)
  }
}

// 节流函数
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => inThrottle = false, limit)
    }
  }
}

// 日期格式化
export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('zh-CN')
}

// 时间格式化
export function formatTime(date: string | Date): string {
  return new Date(date).toLocaleTimeString('zh-CN')
}

// 日期时间格式化
export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('zh-CN')
}

// 计算两个日期之间的天数
export function daysBetween(startDate: string | Date, endDate: string | Date): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

// 深拷贝
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as T
  if (obj instanceof Array) return obj.map(item => deepClone(item)) as T
  
  const clonedObj = {} as T
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clonedObj[key] = deepClone(obj[key])
    }
  }
  return clonedObj
}

// 获取URL参数
export function getUrlParam(param: string): string | null {
  if (typeof window === 'undefined') return null
  
  const url = new URL(window.location.href)
  return url.searchParams.get(param)
}

// 设置URL参数
export function setUrlParam(param: string, value: string): void {
  if (typeof window === 'undefined') return
  
  const url = new URL(window.location.href)
  url.searchParams.set(param, value)
  window.history.pushState({}, '', url)
}

// 删除URL参数
export function removeUrlParam(param: string): void {
  if (typeof window === 'undefined') return
  
  const url = new URL(window.location.href)
  url.searchParams.delete(param)
  window.history.replaceState({}, '', url)
}
