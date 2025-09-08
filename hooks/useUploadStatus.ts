import { useEffect, useState } from 'react'
import { useUploadStore } from '@/stores/upload'

interface UploadStatus {
  status: 'processing' | 'completed' | 'failed' | 'not_found'
  progress?: number
  processedLines?: number
  fileName?: string
  fileSize?: number
  uploadTime?: string
  error?: string
  completedAt?: string
  resultPath?: string
}

export function useUploadStatus(fileId: string | null) {
  const [status, setStatus] = useState<UploadStatus | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!fileId) return

    let isMounted = true
    let timeoutId: NodeJS.Timeout

    const pollStatus = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/upload-optimized?fileId=${fileId}`)
        const result = await response.json()
        
        if (response.ok && isMounted) {
          setStatus(result)
          // 如果状态是processing，继续轮询
          if (result.status === 'processing') {
            timeoutId = setTimeout(pollStatus, 2000)
          } else if (result.status === 'completed' || result.status === 'failed') {
            // 更新 store 中的文件状态
            const { updateFileProgress } = useUploadStore.getState()
            updateFileProgress(fileId, 100, result.status)
          }
        } else {
          // 404 或其他错误，停止轮询
          console.error('Failed to fetch status:', result.error)
        }
      } catch (error) {
        console.error('Error polling status:', error)
      } finally {
        setLoading(false)
      }
    }

    // 立即查询一次
    pollStatus()

    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [fileId])

  return { status, loading }
}