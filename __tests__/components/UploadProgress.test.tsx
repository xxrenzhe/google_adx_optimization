import React from 'react'
import { render, screen, act } from '@testing-library/react'
import UploadProgress from '@/components/UploadProgress'

// Mock the upload store
const mockUseUploadStore = jest.fn()
jest.mock('@/stores/upload', () => ({
  useUploadStore: () => mockUseUploadStore()
}))

// Mock fetch
global.fetch = jest.fn()

describe('UploadProgress Component', () => {
  let mockGetStatus: jest.Mock
  let mockUpdateStatus: jest.Mock

  beforeEach(() => {
    jest.useFakeTimers()
    mockGetStatus = jest.fn().mockReturnValue({
      status: 'processing',
      progress: 50,
      fileName: 'test.csv',
      fileSize: 1024 * 1024,
      uploadTime: new Date().toISOString()
    })
    mockUpdateStatus = jest.fn()
    
    // Update the mock implementation
    mockUseUploadStore.mockReturnValue({
      getFile: jest.fn().mockReturnValue({
        id: 'test-file-id',
        file: new File(['test'], 'test.csv'),
        status: 'processing',
        progress: 50
      }),
      getStatus: mockGetStatus,
      updateStatus: mockUpdateStatus
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('renders processing state', () => {
    render(<UploadProgress fileId="test-file-id" />)
    
    expect(screen.getByText('分析中...')).toBeInTheDocument()
    expect(screen.getByText('test.csv')).toBeInTheDocument()
    expect(screen.getByText('50.00%')).toBeInTheDocument()
  })

  it('renders uploading state', () => {
    // Update the mock to return a file with 'uploading' status
    mockUseUploadStore.mockReturnValue({
      getFile: jest.fn().mockReturnValue({
        id: 'test-file-id',
        file: new File(['test'], 'upload.csv'),
        status: 'uploading',
        progress: 25
      }),
      getStatus: mockGetStatus,
      updateStatus: mockUpdateStatus
    })

    render(<UploadProgress fileId="test-file-id" />)
    
    expect(screen.getByText('上传中...')).toBeInTheDocument()
    expect(screen.getByText('upload.csv')).toBeInTheDocument()
    expect(screen.getByText('25.00%')).toBeInTheDocument()
  })

  it('polls for status updates', async () => {
    mockGetStatus
      .mockReturnValueOnce({
        status: 'processing',
        progress: 50
      })
      .mockReturnValueOnce({
        status: 'completed',
        progress: 100
      })

    render(<UploadProgress fileId="test-file-id" />)
    
    // Fast-forward timers
    act(() => {
      jest.advanceTimersByTime(2000)
    })

    expect(mockGetStatus).toHaveBeenCalledTimes(2)
  })

  it('calculates and displays ETA', () => {
    const startTime = new Date(Date.now() - 30000) // 30 seconds ago
    mockGetStatus.mockReturnValue({
      status: 'processing',
      progress: 30,
      fileName: 'large.csv',
      fileSize: 50 * 1024 * 1024,
      uploadTime: startTime.toISOString()
    })

    render(<UploadProgress fileId="test-file-id" />)
    
    // Should show estimated time remaining
    expect(screen.getByText(/预计剩余:/)).toBeInTheDocument()
  })

  it('handles completed state', () => {
    mockGetStatus.mockReturnValue({
      status: 'completed',
      progress: 100,
      fileName: 'done.csv',
      processedLines: 1000,
      completedAt: new Date().toISOString()
    })

    render(<UploadProgress fileId="test-file-id" />)
    
    expect(screen.getByText('已完成')).toBeInTheDocument()
    expect(screen.getByText('1000 行数据')).toBeInTheDocument()
  })

  it('handles failed state', () => {
    mockGetStatus.mockReturnValue({
      status: 'failed',
      error: 'Processing failed',
      fileName: 'failed.csv'
    })

    render(<UploadProgress fileId="test-file-id" />)
    
    expect(screen.getByText('失败')).toBeInTheDocument()
    expect(screen.getByText('Processing failed')).toBeInTheDocument()
  })
})