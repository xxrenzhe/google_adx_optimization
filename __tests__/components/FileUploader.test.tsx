import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import FileUploader from '@/components/FileUploader'

// Mock the upload store
const mockUseUploadStore = jest.fn()
jest.mock('@/stores/upload', () => ({
  useUploadStore: () => mockUseUploadStore()
}))

describe('FileUploader Component', () => {
  beforeEach(() => {
    // Default mock implementation
    mockUseUploadStore.mockReturnValue({
      setFile: jest.fn(),
      setCurrentFileId: jest.fn(),
      updateFileProgress: jest.fn()
    })
  })

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('renders upload area', () => {
    render(<FileUploader onUploadStart={jest.fn()} onUploadComplete={jest.fn()} />)
    
    expect(screen.getByText('拖拽CSV文件到此处，或')).toBeInTheDocument()
    expect(screen.getByText('点击选择')).toBeInTheDocument()
    expect(screen.getByText('最大文件大小：200MB')).toBeInTheDocument()
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
    
    const dropzone = screen.getByTestId('dropzone')
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
    
    const dropzone = screen.getByTestId('dropzone')
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [invalidFile] }
    })

    await waitFor(() => {
      expect(screen.getByText('只支持CSV文件')).toBeInTheDocument()
    })
  })

  it('validates file size', async () => {
    // Create a mock large file (over 200MB)
    const largeFile = new File(['test'], 'large.csv', { type: 'text/csv' })
    Object.defineProperty(largeFile, 'size', { value: 201 * 1024 * 1024 })
    
    render(<FileUploader onUploadStart={jest.fn()} onUploadComplete={jest.fn()} />)
    
    const dropzone = screen.getByTestId('dropzone')
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [largeFile] }
    })

    await waitFor(() => {
      expect(screen.getByText('文件过大，请上传小于200MB的文件')).toBeInTheDocument()
    })
  })

  it('handles upload error', async () => {
    const mockFile = new File(['test,content'], 'test.csv', { type: 'text/csv' })
    const mockSetFile = jest.fn()
    const mockUpdateFileProgress = jest.fn()
    
    // Mock the store to capture the setFile call
    mockUseUploadStore.mockReturnValue({
      setFile: mockSetFile,
      updateFileProgress: mockUpdateFileProgress,
      setCurrentFileId: jest.fn()
    })
    
    // Mock fetch to return error
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Upload failed' })
    })

    render(<FileUploader onUploadStart={jest.fn()} onUploadComplete={jest.fn()} />)
    
    const dropzone = screen.getByTestId('dropzone')
    fireEvent.drop(dropzone, {
      dataTransfer: { files: [mockFile] }
    })

    await waitFor(() => {
      // Check that setFile was called with uploading status first
      expect(mockSetFile).toHaveBeenCalled()
      const firstCall = mockSetFile.mock.calls[0]
      expect(firstCall[1].status).toBe('uploading')
      
      // Check that updateFileProgress was not called (since upload failed)
      expect(mockUpdateFileProgress).not.toHaveBeenCalled()
    })
  })
})