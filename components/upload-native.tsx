'use client'

import { useState, useRef, useCallback } from 'react'

interface UploadProps {
  onUploadComplete: () => void
  onDataCleared: () => void
}

export default function Upload({ onUploadComplete, onDataCleared }: UploadProps) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<{ name: string; recordCount: number } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return
    
    if (file.size > 50 * 1024 * 1024) {
      setError('文件大小必须小于50MB')
      return
    }
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('请上传CSV文件')
      return
    }
    
    setUploading(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const xhr = new XMLHttpRequest()
      
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = (event.loaded / event.total) * 100
          setProgress(percentComplete)
        }
      }
      
      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText)
          setUploading(false)
          setUploadedFile({
            name: file.name,
            recordCount: response.recordsProcessed || 0
          })
          onUploadComplete()
        } else {
          setError('上传失败')
          setUploading(false)
        }
      }
      
      xhr.onerror = () => {
        setError('Upload failed')
        setUploading(false)
      }
      
      xhr.open('POST', '/api/upload')
      xhr.send(formData)
    } catch {
      setError('Upload failed')
      setUploading(false)
    }
  }, [onUploadComplete])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleClearData = useCallback(async () => {
    try {
      const response = await fetch('/api/data/clear', {
        method: 'POST',
        credentials: 'include'
      })
      
      if (response.ok) {
        setUploadedFile(null) // 清除文件信息
        onDataCleared()
      } else {
        setError('清除数据失败')
      }
    } catch {
      setError('清除数据失败')
    }
  }, [onDataCleared])

  return (
    <div className="space-y-4">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragOver
            ? 'border-blue-400 bg-blue-50'
            : uploading
            ? 'border-gray-300 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInputChange}
          className="hidden"
          disabled={uploading}
        />
        
        {uploading ? (
          <div className="space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <div>
              <p className="text-sm text-gray-600">上传中...</p>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 mt-1">{Math.round(progress)}%</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <div>
              <p className="text-lg text-gray-600">
                {uploadedFile ? (
                  <span>点击或拖放上传新的CSV文件替换当前文件</span>
                ) : (
                  <span>将CSV文件拖放到此处，或<span className="text-blue-600">点击浏览</span></span>
                )}
              </p>
              <p className="text-sm text-gray-500">
                {uploadedFile ? '支持替换上传' : '最大文件大小：50MB'}
              </p>
            </div>
          </div>
        )}
        
        {/* 显示已上传文件信息 */}
        {uploadedFile && !uploading && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center space-x-2">
              <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-sm text-green-800">
                <p className="font-medium">文件上传成功</p>
                <p className="text-xs text-green-600 mt-1">
                  文件名：{uploadedFile.name} | 数据行数：{uploadedFile.recordCount.toLocaleString()} 行
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      <div className="flex justify-center">
        <button
          onClick={handleClearData}
          disabled={!uploadedFile}
          className={`px-4 py-2 rounded-md transition-colors text-sm font-medium ${
            uploadedFile
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          {uploadedFile ? '清除当前数据' : '暂无数据可清除'}
        </button>
      </div>
    </div>
  )
}