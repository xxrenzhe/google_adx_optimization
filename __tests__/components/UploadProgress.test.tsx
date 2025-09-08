import React from 'react'
import { render, screen, act } from '@testing-library/react'
import UploadProgress from '@/components/UploadProgress'
import { useUploadStore } from '@/stores/upload'

// Mock the upload store
jest.mock('@/stores/upload')
const mockUseUploadStore = useUploadStore as jest.MockedFunction<typeof useUploadStore>

// Mock fetch
global.fetch = jest.fn()

describe('UploadProgress Component', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    mockUseUploadStore.mockReturnValue({
      getStatus: jest.fn().mockReturnValue({
        status: 'processing',
        progress: 50,
        fileName: 'test.csv',
        fileSize: 1024 * 1024,
        uploadTime: new Date().toISOString()
      })
    } as any)
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('renders processing state', () => {
    render(<UploadProgress fileId="test-file-id" />)
    
    expect(screen.getByText('正在处理文件')).toBeInTheDocument()
    expect(screen.getByText('test.csv')).toBeInTheDocument()
    expect(screen.getByText('50%')).toBeInTheDocument()
  })

  it('renders uploading state', () => {
    mockUseUploadStore.mockReturnValue({
      getStatus: jest.fn().mockReturnValue({
        status: 'uploading',
        progress: 25,
        fileName: 'upload.csv',
        fileSize: 2048 * 1024,
        uploadTime: new Date().toISOString()
      })
    } as any)

    render(<UploadProgress fileId="test-file-id" />)
    
    expect(screen.getByText('正在上传文件')).toBeInTheDocument()
    expect(screen.getByText('upload.csv')).toBeInTheDocument()
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('polls for status updates', async () => {
    const mockGetStatus = jest.fn()
      .mockReturnValueOnce({
        status: 'processing',
        progress: 50
      })
      .mockReturnValueOnce({
        status: 'completed',
        progress: 100
      })
    
    mockUseUploadStore.mockReturnValue({
      getStatus: mockGetStatus,
      updateStatus: jest.fn()
    } as any)

    render(<UploadProgress fileId="test-file-id" />)
    
    // Fast-forward timers
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(mockGetStatus).toHaveBeenCalledTimes(2)
  })

  it('calculates and displays ETA', () => {
    const startTime = new Date(Date.now() - 30000) // 30 seconds ago
    mockUseUploadStore.mockReturnValue({
      getStatus: jest.fn().mockReturnValue({
        status: 'processing',
        progress: 30,
        fileName: 'large.csv',
        fileSize: 50 * 1024 * 1024,
        uploadTime: startTime.toISOString()
      })
    } as any)

    render(<UploadProgress fileId="test-file-id" />)
    
    // Should show estimated time remaining
    expect(screen.getByText(/预计剩余时间/)).toBeInTheDocument()
  })

  it('handles completed state', () => {
    mockUseUploadStore.mockReturnValue({
      getStatus: jest.fn().mockReturnValue({
        status: 'completed',
        progress: 100,
        fileName: 'done.csv',
        processedLines: 1000,
        completedAt: new Date().toISOString()
      })
    } as any)

    render(<UploadProgress fileId="test-file-id" />)
    
    expect(screen.getByText('处理完成！')).toBeInTheDocument()
    expect(screen.getByText('1000 行数据')).toBeInTheDocument()
  })

  it('handles failed state', () => {
    mockUseUploadStore.mockReturnValue({
      getStatus: jest.fn().mockReturnValue({
        status: 'failed',
        error: 'Processing failed',
        fileName: 'failed.csv'
      })
    } as any)

    render(<UploadProgress fileId="test-file-id" />)
    
    expect(screen.getByText('处理失败')).toBeInTheDocument()
    expect(screen.getByText('Processing failed')).toBeInTheDocument()
  })
})