'use client'

import { useEffect } from 'react'
import { useAnalytics } from '@/contexts/analytics-context'
import AutomationDashboard from '@/components/automation-dashboard'

interface AutomationDashboardWrapperProps {
  fileId: string | null
  refreshTrigger: number
}

export default function AutomationDashboardWrapper({ fileId, refreshTrigger }: AutomationDashboardWrapperProps) {
  const { data, loading, error, prefetch } = useAnalytics()

  // 预加载数据
  useEffect(() => {
    if (fileId) {
      prefetch(fileId)
    }
  }, [fileId, prefetch])

  // 处理手动刷新
  useEffect(() => {
    if (fileId && refreshTrigger > 0) {
      refresh(fileId)
    }
  }, [refreshTrigger, fileId, refresh])

  if (error) {
    return <div className="text-red-500">加载失败: {error}</div>
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  }

  return <AutomationDashboard fileId={fileId} cachedData={data?.automation} />
}