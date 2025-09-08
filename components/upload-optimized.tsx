'use client'

import React, { useEffect } from 'react'
import { useUploadStore } from '@/stores/upload'
import FileUploader from './FileUploader'
import UploadProgress from './UploadProgress'
import UploadResults from './UploadResults'
import type { UploadProps } from '@/types'

export default function FileUploadOptimized({ fileId, onFileUploaded, onClearFile }: UploadProps) {
  const { 
    currentFileId, 
    currentFile, 
    setCurrentFileId, 
    getResult,
    clearFile 
  } = useUploadStore()

  // 同步外部fileId变化
  useEffect(() => {
    if (fileId !== currentFileId) {
      setCurrentFileId(fileId)
    }
  }, [fileId, currentFileId, setCurrentFileId])

  // 处理上传完成
  const handleUploadComplete = (newFileId: string) => {
    onFileUploaded(newFileId)
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
    return (
      <div className="space-y-6">
        <FileUploader 
          onUploadStart={() => {}}
          onUploadComplete={handleUploadComplete}
        />
      </div>
    )
  }

  // 如果文件正在上传或处理中，显示进度
  if (currentFile.status === 'uploading' || currentFile.status === 'processing') {
    return (
      <div className="space-y-6">
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
        <UploadResults 
          fileId={currentFileId}
          onClear={handleClearFile}
        />
      )
    }
    
    // 如果没有结果但有错误
    if (currentFile.error) {
      return (
        <div className="space-y-6">
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