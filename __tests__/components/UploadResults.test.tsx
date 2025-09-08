import React from 'react'
import { render, screen, act } from '@testing-library/react'
import UploadResults from '@/components/UploadResults'

// Mock the upload store
const mockUseUploadStore = jest.fn()
jest.mock('@/stores/upload', () => ({
  useUploadStore: () => mockUseUploadStore()
}))

// Mock fetch
global.fetch = jest.fn()

describe('UploadResults Component', () => {
  const mockResult = {
    summary: {
      totalRows: 1000,
      totalRevenue: 5000,
      totalImpressions: 100000,
      totalClicks: 500,
      totalRequests: 120000,
      avgEcpm: 50,
      avgCtr: 0.5
    },
    topWebsites: [
      { name: 'example.com', revenue: 1000, impressions: 20000, clicks: 100, requests: 24000, avgEcpm: 50, ctr: 0.5 },
      { name: 'test.com', revenue: 800, impressions: 16000, clicks: 80, requests: 19200, avgEcpm: 50, ctr: 0.5 }
    ],
    dailyTrend: [
      { date: '2024-01-01', revenue: 1000, impressions: 20000, clicks: 100, requests: 24000, avgEcpm: 50, ctr: 0.5 },
      { date: '2024-01-02', revenue: 1200, impressions: 24000, clicks: 120, requests: 28800, avgEcpm: 50, ctr: 0.5 }
    ]
  }

  beforeEach(() => {
    jest.useFakeTimers()
    mockUseUploadStore.mockReturnValue({
      getResult: jest.fn().mockReturnValue(mockResult),
      getStatus: jest.fn().mockReturnValue({ status: 'completed' })
    })
  })

  afterEach(() => {
    jest.useRealTimers()
    jest.clearAllMocks()
  })

  it('renders loading state when no result', () => {
    mockUseUploadStore.mockReturnValue({
      getResult: jest.fn().mockReturnValue(null),
      getStatus: jest.fn().mockReturnValue({ status: 'processing' })
    })

    render(<UploadResults fileId="test-file-id" />)
    
    expect(screen.getByText('正在加载结果...')).toBeInTheDocument()
  })

  it('renders analysis results when available', () => {
    render(<UploadResults fileId="test-file-id" />)
    
    // Check summary cards
    expect(screen.getByText('总收入')).toBeInTheDocument()
    expect(screen.getByText('¥5,000.00')).toBeInTheDocument()
    expect(screen.getByText('总展示数')).toBeInTheDocument()
    expect(screen.getByText('100.0K')).toBeInTheDocument()
    expect(screen.getByText('平均eCPM')).toBeInTheDocument()
    expect(screen.getAllByText('¥50.00')[0]).toBeInTheDocument() // First occurrence is in summary card
    expect(screen.getByText('点击率')).toBeInTheDocument()
    expect(screen.getByText('0.50%')).toBeInTheDocument()
    
    // Check top websites section
    expect(screen.getByText('Top网站 (按收入)')).toBeInTheDocument()
    expect(screen.getByText('example.com')).toBeInTheDocument()
    expect(screen.getByText('test.com')).toBeInTheDocument()
    
    // Check daily trend section
    expect(screen.getByText('每日趋势')).toBeInTheDocument()
    expect(screen.getByText('2024-01-01')).toBeInTheDocument()
    expect(screen.getByText('2024-01-02')).toBeInTheDocument()
  })

  it('handles export functionality', () => {
    // Mock URL.createObjectURL and URL.revokeObjectURL
    const mockCreateObjectURL = jest.fn().mockReturnValue('blob:test-url')
    const mockRevokeObjectURL = jest.fn()
    
    // Add to global URL object
    Object.defineProperty(global.URL, 'createObjectURL', {
      value: mockCreateObjectURL,
      configurable: true
    })
    Object.defineProperty(global.URL, 'revokeObjectURL', {
      value: mockRevokeObjectURL,
      configurable: true
    })
    
    // Mock document.createElement
    const mockLink = {
      href: '',
      download: '',
      click: jest.fn()
    }
    const createElementSpy = jest.spyOn(document, 'createElement')
      .mockReturnValue(mockLink as any)
    
    render(<UploadResults fileId="test-file-id" />)
    
    const exportButton = screen.getByText('导出结果')
    exportButton.click()
    
    expect(mockCreateObjectURL).toHaveBeenCalled()
    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(mockLink.download).toBe('adx-analysis-test-file-id.json')
    expect(mockLink.click).toHaveBeenCalled()
    expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:test-url')
    
    // Clean up
    createElementSpy.mockRestore()
  })

  it('calls onClear when clear button is clicked', () => {
    const mockOnClear = jest.fn()
    
    render(<UploadResults fileId="test-file-id" onClear={mockOnClear} />)
    
    const clearButton = screen.getByText('清除结果')
    clearButton.click()
    
    expect(mockOnClear).toHaveBeenCalled()
  })

  it('polls for status when not completed', async () => {
    const mockStatus = { status: 'processing', progress: 50 }
    const mockCompletedStatus = { status: 'completed', resultPath: '/results/test.json' }
    
    mockUseUploadStore.mockReturnValue({
      getResult: jest.fn().mockReturnValue(null),
      getStatus: jest.fn().mockReturnValue(mockStatus)
    })
    
    // Mock fetch responses
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockCompletedStatus)
    }).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockResult)
    })
    
    render(<UploadResults fileId="test-file-id" />)
    
    // Fast-forward timers
    act(() => {
      jest.advanceTimersByTime(2000)
    })
    
    expect(fetch).toHaveBeenCalledWith('/api/upload-optimized?fileId=test-file-id')
  })
})