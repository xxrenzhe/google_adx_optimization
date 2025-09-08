import { useUploadStore } from '@/stores/upload'
import { act } from '@testing-library/react'

// Mock the store without persist middleware for testing
const { getState, setState, subscribe } = useUploadStore

describe('Upload Store', () => {
  beforeEach(() => {
    // Reset store state before each test
    setState({
      currentFileId: null,
      currentFile: null,
      files: new Map(),
      results: new Map(),
      uploadStatus: new Map()
    })
  })

  describe('setCurrentFileId', () => {
    it('sets current file ID', () => {
      act(() => {
        getState().setCurrentFileId('test-file-id')
      })

      expect(getState().currentFileId).toBe('test-file-id')
    })

    it('updates current file when files exist', () => {
      const mockFile = {
        id: 'test-file-id',
        file: new File(['test'], 'test.csv'),
        status: 'completed' as const,
        progress: 100
      }

      act(() => {
        getState().setFile('test-file-id', mockFile)
        getState().setCurrentFileId('test-file-id')
      })

      expect(getState().currentFile).toEqual(mockFile)
    })
  })

  describe('setFile', () => {
    it('adds file to store', () => {
      const mockFile = {
        id: 'test-file-id',
        file: new File(['test'], 'test.csv'),
        status: 'uploading' as const,
        progress: 0
      }

      act(() => {
        getState().setFile('test-file-id', mockFile)
      })

      expect(getState().files.get('test-file-id')).toEqual(mockFile)
      expect(getState().currentFileId).toBe('test-file-id')
      expect(getState().currentFile).toEqual(mockFile)
    })
  })

  describe('updateFileProgress', () => {
    it('updates file progress and status', () => {
      const mockFile = {
        id: 'test-file-id',
        file: new File(['test'], 'test.csv'),
        status: 'uploading' as const,
        progress: 0
      }

      act(() => {
        getState().setFile('test-file-id', mockFile)
        getState().updateFileProgress('test-file-id', 50, 'processing')
      })

      const updatedFile = getState().files.get('test-file-id')
      expect(updatedFile?.progress).toBe(50)
      expect(updatedFile?.status).toBe('processing')
    })
  })

  describe('setResult', () => {
    it('stores analysis result', () => {
      const mockResult = {
        fileId: 'test-file-id',
        summary: {
          totalRows: 100,
          totalRevenue: 1000,
          totalImpressions: 10000,
          totalClicks: 100,
          totalRequests: 12000,
          avgEcpm: 100,
          avgCtr: 1
        },
        topWebsites: [],
        topCountries: [],
        dailyTrend: []
      }

      act(() => {
        getState().setResult('test-file-id', mockResult)
      })

      expect(getState().results.get('test-file-id')).toEqual(mockResult)
    })
  })

  describe('updateStatus', () => {
    it('updates upload status', () => {
      act(() => {
        getState().updateStatus('test-file-id', { status: 'processing', progress: 50 })
      })

      const status = getState().uploadStatus.get('test-file-id')
      expect(status?.status).toBe('processing')
      expect(status?.progress).toBe(50)
    })

    it('merges status updates', () => {
      act(() => {
        getState().updateStatus('test-file-id', { status: 'processing', progress: 50 })
        getState().updateStatus('test-file-id', { progress: 75 })
      })

      const status = getState().uploadStatus.get('test-file-id')
      expect(status?.status).toBe('processing')
      expect(status?.progress).toBe(75)
    })
  })

  describe('clearFile', () => {
    it('clears file and related data', () => {
      const mockFile = {
        id: 'test-file-id',
        file: new File(['test'], 'test.csv'),
        status: 'completed' as const,
        progress: 100
      }
      const mockResult = { fileId: 'test-file-id', summary: {} }

      act(() => {
        getState().setFile('test-file-id', mockFile)
        getState().setResult('test-file-id', mockResult)
        getState().updateStatus('test-file-id', { status: 'completed' })
        getState().setCurrentFileId('test-file-id')
        getState().clearFile('test-file-id')
      })

      expect(getState().files.has('test-file-id')).toBe(false)
      expect(getState().results.has('test-file-id')).toBe(false)
      expect(getState().uploadStatus.has('test-file-id')).toBe(false)
      expect(getState().currentFileId).toBe(null)
      expect(getState().currentFile).toBe(null)
    })
  })

  describe('clearAll', () => {
    it('clears all data from store', () => {
      const mockFile = {
        id: 'test-file-id',
        file: new File(['test'], 'test.csv'),
        status: 'completed' as const,
        progress: 100
      }

      act(() => {
        getState().setFile('test-file-id', mockFile)
        getState().setCurrentFileId('test-file-id')
        getState().clearAll()
      })

      expect(getState().files.size).toBe(0)
      expect(getState().results.size).toBe(0)
      expect(getState().uploadStatus.size).toBe(0)
      expect(getState().currentFileId).toBe(null)
      expect(getState().currentFile).toBe(null)
    })
  })

  describe('helper functions', () => {
    it('getFile returns correct file', () => {
      const mockFile = {
        id: 'test-file-id',
        file: new File(['test'], 'test.csv'),
        status: 'completed' as const,
        progress: 100
      }

      act(() => {
        getState().setFile('test-file-id', mockFile)
      })

      expect(getState().getFile('test-file-id')).toEqual(mockFile)
      expect(getState().getFile('non-existent')).toBeUndefined()
    })

    it('getResult returns correct result', () => {
      const mockResult = { fileId: 'test-file-id', summary: {} }

      act(() => {
        getState().setResult('test-file-id', mockResult)
      })

      expect(getState().getResult('test-file-id')).toEqual(mockResult)
      expect(getState().getResult('non-existent')).toBeUndefined()
    })

    it('getStatus returns correct status', () => {
      act(() => {
        getState().updateStatus('test-file-id', { status: 'processing' })
      })

      expect(getState().getStatus('test-file-id')?.status).toBe('processing')
      expect(getState().getStatus('non-existent')).toBeUndefined()
    })
  })
})