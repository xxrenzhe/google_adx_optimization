'use client'

import React, { useEffect, useState } from 'react'
import { 
  BarChart3, 
  TrendingUp, 
  Globe, 
  DollarSign, 
  Eye, 
  MousePointer,
  Download,
  RefreshCw,
  CheckCircle
} from 'lucide-react'
import { useUploadStore } from '@/stores/upload'
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/utils'
import type { AnalysisResult } from '@/types'

interface UploadResultsProps {
  fileId: string
  onClear?: () => void
}

export default function UploadResults({ fileId, onClear }: UploadResultsProps) {
  const { getResult, getStatus } = useUploadStore()
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [status, setStatus] = useState<any>(null)
  
  useEffect(() => {
    setResult(getResult(fileId) || null)
    setStatus(getStatus(fileId) || null)
  }, [fileId, getResult, getStatus])
  
  // 轮询状态直到完成
  useEffect(() => {
    if (status?.status === 'completed') return
    
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/upload-optimized?fileId=${fileId}`)
        const data = await response.json()
        
        // Debug logging removed
        
        if (data.status === 'completed') {
          // 无论是否有resultPath，都尝试获取结果
          const resultResponse = await fetch(`/api/result/${fileId}`)
          const resultData = await resultResponse.json()
          
          if (resultResponse.ok) {
            // 存储结果到 Zustand store
            const { setResult } = useUploadStore.getState()
            setResult(fileId, resultData.result || resultData)
          }
        }
        
        setStatus(data)
      } catch (error) {
        console.error('Error polling status:', error)
      }
    }, 2000)
    
    return () => clearInterval(interval)
  }, [fileId, status?.status])
  
  if (!result) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-600">正在加载结果...</span>
      </div>
    )
  }
  
  const { summary, topWebsites, dailyTrend } = result
  
  return (
    <div className="space-y-6">
      {/* 操作栏 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-green-600" />
          <span className="text-green-800 font-medium">分析完成</span>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => {
              const dataStr = JSON.stringify(result, null, 2)
              const dataBlob = new Blob([dataStr], { type: 'application/json' })
              const url = URL.createObjectURL(dataBlob)
              const link = document.createElement('a')
              link.href = url
              link.download = `adx-analysis-${fileId}.json`
              link.click()
              URL.revokeObjectURL(url)
            }}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>导出结果</span>
          </button>
          
          {onClear && (
            <button
              onClick={onClear}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              清除结果
            </button>
          )}
        </div>
      </div>
      
      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">总收入</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.totalRevenue)}
              </p>
            </div>
            <DollarSign className="w-8 h-8 text-green-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">总展示数</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatNumber(summary.totalImpressions)}
              </p>
            </div>
            <Eye className="w-8 h-8 text-blue-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">平均eCPM</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(summary.avgEcpm)}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-600" />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">点击率</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatPercentage(summary.avgCtr)}
              </p>
            </div>
            <MousePointer className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>
      
      {/* Top网站 */}
      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Globe className="w-5 h-5 mr-2" />
            Top网站 (按收入)
          </h3>
        </div>
        
        <div className="p-6">
          <div className="space-y-4">
            {topWebsites.slice(0, 10).map((website, index) => (
              <div key={website.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-gray-500 w-8">
                    #{index + 1}
                  </span>
                  <span className="font-medium text-gray-900">{website.name}</span>
                </div>
                
                <div className="text-right">
                  <p className="font-medium text-gray-900">
                    {formatCurrency(website.revenue)}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatNumber(website.impressions)} 展示
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* 每日趋势 */}
      {dailyTrend.length > 1 && (
        <div className="bg-white rounded-lg shadow border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2" />
              每日趋势
            </h3>
          </div>
          
          <div className="p-6">
            <div className="space-y-4">
              {dailyTrend.slice(-7).map((day, index) => (
                <div key={day.date} className="flex items-center justify-between">
                  <span className="font-medium text-gray-900">{day.date}</span>
                  
                  <div className="flex space-x-6 text-sm">
                    <div>
                      <span className="text-gray-500">收入: </span>
                      <span className="font-medium">{formatCurrency(day.revenue)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">eCPM: </span>
                      <span className="font-medium">{formatCurrency(day.avgEcpm)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">展示: </span>
                      <span className="font-medium">{formatNumber(day.impressions)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}