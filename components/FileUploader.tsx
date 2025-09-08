'use client'

import React, { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, AlertCircle } from 'lucide-react'
import { useUploadStore } from '@/stores/upload'
import { validateFile } from '@/lib/file-processing'
import { formatFileSize } from '@/lib/utils'
import type { FileWithProgress } from '@/types'

interface FileUploaderProps {
  onUploadStart?: () => void
  onUploadComplete?: (fileId: string) => void
}

export default function FileUploader({ onUploadStart, onUploadComplete }: FileUploaderProps) {
  const { setFile, updateFileProgress } = useUploadStore()

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    
    try {
      // 验证文件
      validateFile(file)
      
      // 创建文件对象
      const fileId = crypto.randomUUID()
      const fileWithProgress: FileWithProgress = {
        file,
        id: fileId,
        status: 'uploading',
        progress: 0
      }
      
      // 添加到store
      setFile(fileId, fileWithProgress)
      
      // 上传文件
      onUploadStart?.()
      
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch('/api/upload-optimized', {
        method: 'POST',
        body: formData
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || '上传失败')
      }
      
      // 更新进度
      updateFileProgress(fileId, 100, 'processing')
      
      // 通知完成
      onUploadComplete?.(result.fileId)
      
    } catch (error) {
      console.error('Upload error:', error)
      const fileId = crypto.randomUUID()
      const fileWithProgress: FileWithProgress = {
        file,
        id: fileId,
        status: 'failed',
        progress: 0,
        error: error instanceof Error ? error.message : '上传失败'
      }
      setFile(fileId, fileWithProgress)
    }
  }, [setFile, updateFileProgress, onUploadStart, onUploadComplete])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv']
    },
    multiple: false,
    maxSize: 200 * 1024 * 1024 // 200MB
  })

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
          }
        `}
      >
        <input {...getInputProps()} />
        
        <div className="flex flex-col items-center space-y-4">
          <Upload className="w-12 h-12 text-gray-400" />
          
          {isDragActive ? (
            <p className="text-lg text-blue-600">松开以上传文件</p>
          ) : (
            <div className="space-y-2">
              <p className="text-lg text-gray-700">
                拖拽CSV文件到此处，或<span className="text-blue-600">点击选择</span>
              </p>
              <p className="text-sm text-gray-500">
                最大文件大小：200MB
              </p>
            </div>
          )}
        </div>
      </div>
      
      <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-800">
          <p className="font-medium mb-1">文件格式要求：</p>
          <ul className="space-y-1 text-blue-700">
            <li>• 必须包含列：日期(Date)、网站(Website)</li>
            <li>• 可选列：国家、设备、广告格式、请求数、展示数、点击数、收入等</li>
            <li>• 支持中英文列名</li>
          </ul>
        </div>
      </div>
    </div>
  )
}