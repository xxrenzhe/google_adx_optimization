'use client'

import { useEffect } from 'react'
import { useAnalytics } from '@/contexts/analytics-context'
import EnhancedAnalytics from '@/components/enhanced-analytics'

interface EnhancedAnalyticsWrapperProps {
  fileId: string | null
}

export default function EnhancedAnalyticsWrapper({ fileId }: EnhancedAnalyticsWrapperProps) {
  const { data, loading, error, prefetch } = useAnalytics()

  // 预加载数据
  useEffect(() => {
    if (fileId) {
      prefetch(fileId)
    }
  }, [fileId, prefetch])

  if (error) {
    return <div className="text-red-500">加载失败: {error}</div>
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
    </div>
  }

  // 使用缓存的数据或传递fileId给原始组件
  return <EnhancedAnalytics fileId={fileId} cachedData={data?.enhanced} />
}