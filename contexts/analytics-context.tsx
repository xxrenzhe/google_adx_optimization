'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AnalyticsData {
  enhanced: any
  predictive: any
  automation: any
  lastUpdated: number
}

interface AnalyticsContextType {
  data: AnalyticsData | null
  loading: boolean
  error: string | null
  refresh: (fileId: string) => Promise<void>
  prefetch: (fileId: string) => Promise<void>
}

const AnalyticsContext = createContext<AnalyticsContextType | undefined>(undefined)

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentFileId, setCurrentFileId] = useState<string | null>(null)

  const fetchAllData = async (fileId: string) => {
    if (!fileId) return
    
    // 如果已经缓存了当前文件的数据，直接返回
    if (data && data.lastUpdated && currentFileId === fileId) {
      const cacheAge = Date.now() - data.lastUpdated
      // 缓存5分钟
      if (cacheAge < 5 * 60 * 1000) {
        return
      }
    }

    setLoading(true)
    setError(null)
    setCurrentFileId(fileId)

    try {
      // 并行获取所有数据
      const [enhanced, predictive, automation] = await Promise.all([
        fetch(`/api/analytics-enhanced?fileId=${fileId}`).then(r => r.json()),
        fetch(`/api/predictive-analytics?fileId=${fileId}`).then(r => r.json()),
        fetch(`/api/automation?fileId=${fileId}`).then(r => r.json())
      ])

      setData({
        enhanced,
        predictive,
        automation,
        lastUpdated: Date.now()
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据失败')
    } finally {
      setLoading(false)
    }
  }

  const refresh = async (fileId: string) => {
    await fetchAllData(fileId)
  }

  const prefetch = async (fileId: string) => {
    if (!data || currentFileId !== fileId) {
      await fetchAllData(fileId)
    }
  }

  return (
    <AnalyticsContext.Provider value={{ data, loading, error, refresh, prefetch }}>
      {children}
    </AnalyticsContext.Provider>
  )
}

export function useAnalytics() {
  const context = useContext(AnalyticsContext)
  if (context === undefined) {
    throw new Error('useAnalytics must be used within AnalyticsProvider')
  }
  return context
}