import { create } from 'zustand'
import type { 
  AnalysisResult, 
  UploadStatusInfo, 
  FileWithProgress,
  UploadResult 
} from '@/types'

interface UploadState {
  // 当前文件
  currentFileId: string | null
  currentFile: FileWithProgress | null
  
  // 所有文件状态
  files: Map<string, FileWithProgress>
  
  // 分析结果缓存
  results: Map<string, AnalysisResult>
  
  // 上传状态
  uploadStatus: Map<string, UploadStatusInfo>
  
  // Actions
  setCurrentFileId: (fileId: string | null) => void
  setFile: (fileId: string, file: FileWithProgress) => void
  updateFileProgress: (fileId: string, progress: number, status: FileWithProgress['status']) => void
  setUploadResult: (fileId: string, result: UploadResult) => void
  setResult: (fileId: string, result: AnalysisResult) => void
  updateStatus: (fileId: string, status: Partial<UploadStatusInfo>) => void
  clearFile: (fileId: string) => void
  clearAll: () => void
  
  // Helpers
  getFile: (fileId: string) => FileWithProgress | undefined
  getResult: (fileId: string) => AnalysisResult | undefined
  getStatus: (fileId: string) => UploadStatusInfo | undefined
}

export const useUploadStore = create<UploadState>((set, get) => ({
  // Initial state
  currentFileId: null,
  currentFile: null,
  files: new Map(),
  results: new Map(),
  uploadStatus: new Map(),
  
  // Actions
  setCurrentFileId: (fileId) => {
    set({ currentFileId: fileId })
    
    // 同步到URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (fileId) {
        url.searchParams.set('fileId', fileId)
      } else {
        url.searchParams.delete('fileId')
      }
      window.history.pushState({}, '', url)
    }
    
    // 更新当前文件引用
    const files = get().files
    set({ currentFile: files.get(fileId) || null })
  },
  
  setFile: (fileId, file) => {
    const files = new Map(get().files)
    files.set(fileId, file)
    set({ 
      files,
      currentFileId: fileId,
      currentFile: file 
    })
  },
  
  updateFileProgress: (fileId, progress, status) => {
    const files = new Map(get().files)
    const file = files.get(fileId)
    
    if (file) {
      files.set(fileId, {
        ...file,
        progress,
        status
      })
      set({ files })
    }
  },
  
  setUploadResult: (fileId, result) => {
    const files = new Map(get().files)
    const file = files.get(fileId)
    
    if (file) {
      files.set(fileId, {
        ...file,
        result,
        status: result.error ? 'failed' : 'completed'
      })
      set({ files })
    }
  },
  
  setResult: (fileId, result) => {
    const results = new Map(get().results)
    results.set(fileId, result)
    set({ results })
  },
  
  updateStatus: (fileId, status) => {
    const uploadStatus = new Map(get().uploadStatus)
    const currentStatus = uploadStatus.get(fileId) || {}
    uploadStatus.set(fileId, { ...currentStatus, ...status })
    set({ uploadStatus })
  },
  
  clearFile: (fileId) => {
    const files = new Map(get().files)
    const results = new Map(get().results)
    const uploadStatus = new Map(get().uploadStatus)
    
    files.delete(fileId)
    results.delete(fileId)
    uploadStatus.delete(fileId)
    
    set({ 
      files,
      results,
      uploadStatus,
      currentFileId: get().currentFileId === fileId ? null : get().currentFileId,
      currentFile: get().currentFile?.id === fileId ? null : get().currentFile
    })
  },
  
  clearAll: () => {
    set({
      currentFileId: null,
      currentFile: null,
      files: new Map(),
      results: new Map(),
      uploadStatus: new Map()
    })
    
    // 清除URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.delete('fileId')
      window.history.replaceState({}, '', url)
    }
  },
  
  // Helpers
  getFile: (fileId) => get().files.get(fileId),
  getResult: (fileId) => get().results.get(fileId),
  getStatus: (fileId) => get().uploadStatus.get(fileId)
}))