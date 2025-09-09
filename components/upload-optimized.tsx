'use client'

import React, { useEffect } from 'react'
import { useUploadStore } from '@/stores/upload'
import FileUploader from './FileUploader'
import UploadProgress from './UploadProgress'
import UploadResults from './UploadResults'
import { formatNumber } from '@/lib/utils'
import type { UploadProps } from '@/types'

interface UploadResult {
  name: string
  revenue: number
  impressions: number
  avgEcpm: number
}

export default function FileUploadOptimized({ fileId, onFileUploaded, onClearFile }: UploadProps) {
  const { 
    currentFileId, 
    currentFile, 
    setCurrentFileId, 
    getResult,
    clearFile,
    files
  } = useUploadStore()

  // 同步外部fileId变化
  useEffect(() => {
    if (fileId !== currentFileId) {
      setCurrentFileId(fileId)
    }
  }, [fileId, currentFileId, setCurrentFileId])

  // 处理上传进度（立即显示进度条）
  const handleUploadProgress = (fileId: string) => {
    // 立即设置fileId，显示进度条
    setCurrentFileId(fileId)
  }
  
  // 处理上传完成
  const handleUploadComplete = (fileId: string) => {
    // 直接设置服务器返回的fileId
    setCurrentFileId(fileId)
    onFileUploaded(fileId)
  }

  // 处理清除文件
  const handleClearFile = () => {
    if (currentFileId) {
      clearFile(currentFileId)
    }
    onClearFile()
  }

  // 如果没有活跃文件，显示上传组件
  if (!currentFileId || !currentFile) {
    console.log('No current file, showing uploader - currentFileId:', currentFileId, 'currentFile:', currentFile)
    return (
      <div key="uploader" className="space-y-6">
        <FileUploader 
          onUploadStart={() => {}}
          onUploadProgress={handleUploadProgress}
          onUploadComplete={handleUploadComplete}
        />
      </div>
    )
  }

  // 如果文件正在上传或处理中，显示进度
  if (currentFile.status === 'uploading' || currentFile.status === 'processing') {
    console.log('File is uploading/processing, showing progress - currentFileId:', currentFileId, 'status:', currentFile.status)
    return (
      <div key={`progress-${currentFileId}-${currentFile.status}`} className="space-y-6">
        <UploadProgress fileId={currentFileId} />
      </div>
    )
  }

  // 如果文件已完成或失败，显示结果或错误
  if (currentFile.status === 'completed' || currentFile.status === 'failed') {
    // 检查是否有分析结果
    const result = getResult(currentFileId)
    
    if (result) {
      return (
        <div key={`results-${currentFileId}`} className="space-y-6">
          <UploadResults 
            fileId={currentFileId}
            onClear={handleClearFile}
          />
          
          {/* 分析结果模块 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                分析结果
              </h3>
            </div>
            
            {/* 概览卡片 */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-blue-50 rounded-lg p-4">
                <div className="text-blue-600 text-sm font-medium">总收入</div>
                <div className="text-2xl font-bold text-blue-900">
                  ¥{Number(result.summary.totalRevenue).toFixed(2)}
                </div>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <div className="text-green-600 text-sm font-medium">总展示次数</div>
                <div className="text-2xl font-bold text-green-900">
                  {formatNumber(result.summary.totalImpressions)}
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="text-purple-600 text-sm font-medium">平均eCPM</div>
                <div className="text-2xl font-bold text-purple-900">
                  ¥{Number(result.summary.avgEcpm).toFixed(2)}
                </div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4">
                <div className="text-orange-600 text-sm font-medium">总点击率</div>
                <div className="text-2xl font-bold text-orange-900">
                  {result.summary.avgCtr.toFixed(2)}%
                </div>
              </div>
            </div>

            {/* 图表区域 */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 网站收益排行 */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">网站收益排行</h4>
                <div className="space-y-3">
                  {result.topWebsites.slice(0, 10).map((item: any, index: number) => (
                    <div key={(item as UploadResult).name} className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <span className="text-sm font-medium text-gray-500 w-8">#{index + 1}</span>
                        <span className="text-sm text-gray-900 truncate" title={(item as UploadResult).name}>
                          {(item as UploadResult).name}
                        </span>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          ¥{formatNumber(Number((item as UploadResult).revenue.toFixed(2)))}
                        </div>
                        <div className="text-xs text-gray-500">
                          eCPM: ¥{Number((item as UploadResult).avgEcpm.toFixed(2))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 国家/地区收益排行 */}
              <div>
                <h4 className="text-md font-medium text-gray-900 mb-4">国家/地区收益排行</h4>
                <div className="space-y-3">
                  {result.topCountries.slice(0, 10).map((item: any, index: number) => (
                    <div key={(item as UploadResult).name} className="flex items-center justify-between py-2">
                      <div className="flex items-center space-x-3 min-w-0 flex-1">
                        <span className="text-sm font-medium text-gray-500 w-8">#{index + 1}</span>
                        <span className="text-sm text-gray-900 truncate">{(item as UploadResult).name}</span>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          ¥{Number((item as UploadResult).revenue).toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500">
                          展示: {formatNumber((item as UploadResult).impressions)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
    
    // 如果没有结果但有错误
    if (currentFile.error) {
      return (
        <div key={`error-${currentFileId}`} className="space-y-6">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{currentFile.error}</p>
          </div>
          <button
            onClick={handleClearFile}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            重新上传
          </button>
        </div>
      )
    }
  }

  // 默认返回上传组件
  return (
    <div className="space-y-6">
      <FileUploader 
        onUploadStart={() => {}}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  )
}