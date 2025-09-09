'use client'

import React, { useCallback, useState } from 'react'
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
  const [error, setError] = useState<string | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setError(null) // Clear any previous errors
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    
    try {
      // 验证文件
      validateFile(file)
      
      // 上传文件
      onUploadStart?.()
      
      // 生成临时fileId用于进度跟踪
      const tempFileId = crypto.randomUUID()
      
      // 创建文件对象，初始状态为uploading
      const fileWithProgress: FileWithProgress = {
        file,
        id: tempFileId,
        status: 'uploading',
        progress: 0
      }
      
      // 添加到store，立即显示上传进度
      setFile(tempFileId, fileWithProgress)
      
      // 使用XMLHttpRequest监控上传进度
      const xhr = new XMLHttpRequest()
      
      // 监控上传进度
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          updateFileProgress(tempFileId, progress, 'uploading')
        }
      })
      
      // 监控上传完成
      xhr.addEventListener('load', async () => {
        if (xhr.status === 200) {
          const result = JSON.parse(xhr.responseText)
          
          // 更新为服务器返回的fileId
          const serverFileId = result.fileId
          
          // 上传完成，开始处理阶段
          updateFileProgress(tempFileId, 100, 'processing')
          
          // 更新fileId
          setTimeout(() => {
            // 添加到store，使用服务器返回的fileId
            setFile(serverFileId, {
              ...fileWithProgress,
              id: serverFileId,
              status: 'processing',
              progress: 100
            })
            
            // 通知完成
            onUploadComplete?.(serverFileId)
          }, 500)
        } else {
          // 尝试解析服务器返回的错误信息
          let errorMessage = '上传失败'
          try {
            const errorResponse = JSON.parse(xhr.responseText)
            errorMessage = errorResponse.error || errorResponse.message || errorMessage
          } catch {
            // 如果无法解析JSON，使用HTTP状态码
            if (xhr.status === 413) {
              errorMessage = '文件过大，请上传小于200MB的文件'
            } else if (xhr.status === 415) {
              errorMessage = '文件格式不支持，请上传CSV文件'
            } else if (xhr.status >= 500) {
              errorMessage = '服务器错误，请稍后重试'
            } else if (xhr.status >= 400) {
              errorMessage = `请求错误 (${xhr.status})`
            }
          }
          throw new Error(errorMessage)
        }
      })
      
      // 监控网络错误
      xhr.addEventListener('error', () => {
        throw new Error('网络连接错误，请检查网络后重试')
      })
      
      // 监控超时
      xhr.addEventListener('timeout', () => {
        throw new Error('上传超时，请重试')
      })
      
      // 发送请求
      const formData = new FormData()
      formData.append('file', file)
      
      xhr.open('POST', `/api/upload-optimized`)
      xhr.timeout = 5 * 60 * 1000 // 5分钟超时
      xhr.send(formData)
      
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

  const onDropRejected = useCallback((rejectedFiles: any[]) => {
    setError(null)
    if (rejectedFiles.length > 0) {
      const rejection = rejectedFiles[0]
      if (rejection.errors.some((e: any) => e.code === 'file-too-large')) {
        setError('文件过大，请上传小于200MB的文件')
      } else if (rejection.errors.some((e: any) => e.code === 'file-invalid-type')) {
        setError('只支持CSV文件')
      } else {
        setError('文件不符合要求')
      }
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
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
        data-testid="dropzone"
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
      
      {/* Error message */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}
      
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