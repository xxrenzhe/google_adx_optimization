'use client'

import React, { useEffect, useState } from 'react'
import { CheckCircle, XCircle, Loader, Clock } from 'lucide-react'
import { useUploadStore } from '@/stores/upload'
import { formatFileSize, formatPercentage } from '@/lib/utils'

interface UploadProgressProps {
  fileId: string
}

export default function UploadProgress({ fileId }: UploadProgressProps) {
  const { getFile, getStatus } = useUploadStore()
  const [elapsedTime, setElapsedTime] = useState(0)
  
  const file = getFile(fileId)
  const status = getStatus(fileId)
  
  useEffect(() => {
    if (!file || file.status === 'completed' || file.status === 'failed') return
    
    const interval = setInterval(() => {
      setElapsedTime(prev => prev + 1)
    }, 1000)
    
    return () => clearInterval(interval)
  }, [file])
  
  if (!file) return null
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  const getEstimatedTime = () => {
    if (!status?.progress || status.progress < 10) return '估算中...'
    
    const progressPerSecond = status.progress / elapsedTime
    const remainingProgress = 100 - status.progress
    const estimatedSeconds = Math.ceil(remainingProgress / progressPerSecond)
    
    return formatTime(estimatedSeconds)
  }
  
  return (
    <div className="space-y-4">
      {/* 文件信息 */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-3">
          {file.status === 'uploading' && <Loader className="w-5 h-5 text-blue-600 animate-spin" />}
          {file.status === 'processing' && <Loader className="w-5 h-5 text-green-600 animate-spin" />}
          {file.status === 'completed' && <CheckCircle className="w-5 h-5 text-green-600" />}
          {file.status === 'failed' && <XCircle className="w-5 h-5 text-red-600" />}
          
          <div>
            <p className="font-medium text-gray-900">{file.file.name}</p>
            <p className="text-sm text-gray-500">{formatFileSize(file.file.size)}</p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">
            {file.status === 'uploading' && '上传中...'}
            {file.status === 'processing' && '分析中...'}
            {file.status === 'completed' && '已完成'}
            {file.status === 'failed' && '失败'}
          </p>
          <p className="text-sm text-gray-500">
            {file.status === 'processing' && `已处理: ${status?.processedLines || 0} 行`}
          </p>
        </div>
      </div>
      
      {/* 进度条 */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">进度</span>
          <span className="font-medium">{formatPercentage(file.progress)}</span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`
              h-2 rounded-full transition-all duration-300
              ${file.status === 'failed' ? 'bg-red-600' : 
                file.status === 'completed' ? 'bg-green-600' : 
                'bg-blue-600'}
            `}
            style={{ width: `${file.progress}%` }}
          />
        </div>
        
        {file.status === 'processing' && (
          <div className="flex justify-between text-xs text-gray-500">
            <span>已用时: {formatTime(elapsedTime)}</span>
            <span>预计剩余: {getEstimatedTime()}</span>
          </div>
        )}
      </div>
      
      {/* 错误信息 */}
      {file.error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{file.error}</p>
        </div>
      )}
      
      {/* 状态信息 */}
      {status && status.status === 'processing' && (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          <span>
            正在分析数据，请稍候...
            {status.processedLines && status.processedLines > 0 && (
              <span className="ml-2">已处理 {status.processedLines} 行数据</span>
            )}
          </span>
        </div>
      )}
    </div>
  )
}