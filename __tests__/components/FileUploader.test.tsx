import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FileUploader from '@/components/FileUploader'
import { useUploadStore } from '@/stores/upload'

// Mock the upload store
jest.mock('@/stores/upload')
const mockUseUploadStore = useUploadStore as jest.MockedFunction<typeof useUploadStore>

describe('FileUploader Component', () => {
  const mockSetFile = jest.fn()
  const mockSetCurrentFileId = jest.fn()
  const mockUpdateFileProgress = jest.fn()

  beforeEach(() => {
    mockUseUploadStore.mockReturnValue({
      setFile: mockSetFile,
      setCurrentFileId: mockSetCurrentFileId,
      updateFileProgress: mockUpdateFileProgress
    } as any)
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders upload area', () => {
    render(<FileUploader onUploadStart={jest.fn()} onUploadComplete={jest.fn()} />)
    
    expect(screen.getByText('拖放CSV文件到这里，或点击选择文件')).toBeInTheDocument()
    expect(screen.getByText('支持最大200MB的CSV文件')).toBeInTheDocument()
  })

  it('handles file drop', async () => {
    const mockFile = new File(['test,content'], 'test.csv', { type: 'text/csv' })
    const mockOnUploadStart = jest.fn()
    const mockOnUploadComplete = jest.fn()
    
    // Mock fetch for upload
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ fileId: 'test-file-id' })
    })

    render(<FileUploader onUploadStart={mockOnUploadStart} onUploadComplete={mockOnUploadComplete} />)
    
    const dropzone = screen.getByText('拖放CSV文件到这里，或点击选择文件').parentElement
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [mockFile] }
    })

    await waitFor(() => {
      expect(mockOnUploadStart).toHaveBeenCalled()
    })
  })

  it('validates file type', async () => {
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' })
    
    render(<FileUploader onUploadStart={jest.fn()} onUploadComplete={jest.fn()} />)
    
    const dropzone = screen.getByText('拖放CSV文件到这里，或点击选择文件').parentElement
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [invalidFile] }
    })

    await waitFor(() => {
      expect(screen.getByText('只支持CSV文件')).toBeInTheDocument()
    })
  })

  it('validates file size', async () => {
    // Create a large file (over 200MB)
    const largeFile = new File(['x'.repeat(201 * 1024 * 1024)], 'large.csv', { type: 'text/csv' })
    
    render(<FileUploader onUploadStart={jest.fn()} onUploadComplete={jest.fn()} />)
    
    const dropzone = screen.getByText('拖放CSV文件到这里，或点击选择文件').parentElement
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [largeFile] }
    })

    await waitFor(() => {
      expect(screen.getByText('文件大小不能超过200MB')).toBeInTheDocument()
    })
  })

  it('handles upload error', async () => {
    const mockFile = new File(['test,content'], 'test.csv', { type: 'text/csv' })
    
    // Mock fetch to return error
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Upload failed' })
    })

    render(<FileUploader onUploadStart={jest.fn()} onUploadComplete={jest.fn()} />)
    
    const dropzone = screen.getByText('拖放CSV文件到这里，或点击选择文件').parentElement
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [mockFile] }
    })

    await waitFor(() => {
      expect(screen.getByText('Upload failed')).toBeInTheDocument()
    })
  })
})