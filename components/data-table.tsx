'use client'

import { useState, useEffect, useRef, useCallback, useReducer, useMemo } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

interface DataTableProps {
  refreshTrigger?: number
}

interface AdReport {
  id: string
  dataDate: string
  website: string
  country: string | null
  adFormat: string | null
  adUnit: string | null
  advertiser: string | null
  domain: string | null
  device: string | null
  browser: string | null
  requests: number | null
  impressions: number | null
  clicks: number | null
  ctr: number | null
  ecpm: number | null
  revenue: number | null
  viewableImpressions: number | null
  viewabilityRate: number | null
  measurableImpressions: number | null
  fillRate: number | null
  arpu: number | null
}

// 使用 useReducer 优化状态管理
type TableState = {
  data: AdReport[]
  loading: boolean
  error: string | null
  pagination: {
    cursor: string | null
    limit: number
    total: number
    hasMore: boolean
  }
  sortBy: string
  sortOrder: 'asc' | 'desc'
  search: string
}

type TableAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_DATA'; payload: AdReport[] }
  | { type: 'SET_PAGINATION'; payload: Partial<TableState['pagination']> }
  | { type: 'SET_SORT'; payload: { sortBy: string; sortOrder: 'asc' | 'desc' } }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'RESET_CURSOR' }

const initialState: TableState = {
  data: [],
  loading: true,
  error: null,
  pagination: {
    cursor: null,
    limit: 100,
    total: 0,
    hasMore: true
  },
  sortBy: 'dataDate',
  sortOrder: 'desc',
  search: ''
}

function tableReducer(state: TableState, action: TableAction): TableState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SET_DATA':
      return { ...state, data: action.payload }
    case 'SET_PAGINATION':
      return { ...state, pagination: { ...state.pagination, ...action.payload } }
    case 'SET_SORT':
      return { ...state, sortBy: action.payload.sortBy, sortOrder: action.payload.sortOrder }
    case 'SET_SEARCH':
      return { ...state, search: action.payload }
    case 'RESET_CURSOR':
      return { ...state, pagination: { ...state.pagination, cursor: null } }
    default:
      return state
  }
}

export default function DataTable({ refreshTrigger }: DataTableProps) {
  const [state, dispatch] = useReducer(tableReducer, initialState)
  const [isDataStale, setIsDataStale] = useState(false)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const initialLoad = useRef(true)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  
  // 虚拟滚动优化
  const { visibleRange, containerHeight, totalHeight } = useMemo(() => {
    const rowHeight = 41 // 每行高度
    const containerHeight = 600 // 容器高度
    const visibleRows = Math.ceil(containerHeight / rowHeight) + 5 // 缓冲5行
    
    return {
      visibleRange: { start: 0, end: visibleRows },
      containerHeight,
      totalHeight: state.data.length * rowHeight
    }
  }, [state.data.length])
  
  // 防抖搜索
  const debouncedSearch = useCallback((value: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      dispatch({ type: 'SET_SEARCH', payload: value })
      dispatch({ type: 'RESET_CURSOR' })
    }, 300)
  }, [])
  
  // 初始加载数据
  useEffect(() => {
    fetchData()
  }, [refreshTrigger])
  
  // 监听搜索和排序变化
  useEffect(() => {
    if (!initialLoad.current) {
      dispatch({ type: 'RESET_CURSOR' })
      fetchData(true)
    }
  }, [state.search, state.sortBy, state.sortOrder])
  
  // 无限滚动加载更多
  useEffect(() => {
    if (observerRef.current) {
      observerRef.current.disconnect()
    }
    
    observerRef.current = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && state.pagination.hasMore && !state.loading) {
        fetchData(false, true)
      }
    }, {
      threshold: 0.1
    })
    
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current)
    }
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
      }
    }
  }, [state.pagination.hasMore, state.loading])
  
  const fetchData = async (reset = false, loadMore = false) => {
    if (reset) {
      dispatch({ type: 'SET_LOADING', payload: true })
      setIsDataStale(false)
    }
    
    dispatch({ type: 'SET_ERROR', payload: null })
    
    try {
      const params = new URLSearchParams({
        limit: state.pagination.limit.toString(),
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        search: state.search
      })
      
      if (state.pagination.cursor && !reset) {
        params.append('cursor', state.pagination.cursor)
      }
      
      const response = await fetch(`/api/data?${params}`)
      if (!response.ok) throw new Error('Failed to fetch data')
      
      const result = await response.json()
      
      if (reset || loadMore) {
        const newData = loadMore ? [...state.data, ...result.data] : result.data
        dispatch({ type: 'SET_DATA', payload: newData })
      } else {
        dispatch({ type: 'SET_DATA', payload: result.data })
      }
      
      initialLoad.current = false
      
      dispatch({ type: 'SET_PAGINATION', payload: {
        cursor: result.pagination.nextCursor,
        total: result.pagination.totalCount,
        hasMore: result.pagination.hasMore
      }})
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }
  
  const handleSort = useCallback((column: string) => {
    const newSortOrder = state.sortBy === column ? 
      (state.sortOrder === 'asc' ? 'desc' : 'asc') : 
      'desc'
    
    dispatch({ type: 'SET_SORT', payload: { sortBy: column, sortOrder: newSortOrder } })
  }, [state.sortBy, state.sortOrder])
  
  const columns: Array<{
    key: keyof AdReport
    label: string
    format?: (value: any) => string
    width?: string
  }> = [
    { key: 'dataDate', label: '日期', format: (value: string) => new Date(value).toLocaleDateString(), width: '120px' },
    { key: 'website', label: '网站', width: '200px' },
    { key: 'country', label: '国家', width: '100px' },
    { key: 'adFormat', label: '广告格式', width: '120px' },
    { key: 'device', label: '设备', width: '100px' },
    { key: 'requests', label: '请求数', format: (value: number) => value?.toLocaleString() || '0', width: '100px' },
    { key: 'impressions', label: '展示数', format: (value: number) => value?.toLocaleString() || '0', width: '100px' },
    { key: 'clicks', label: '点击数', format: (value: number) => value?.toLocaleString() || '0', width: '100px' },
    { key: 'ctr', label: '点击率', format: (value: number) => value ? `${(value * 100).toFixed(2)}%` : '0%', width: '100px' },
    { key: 'ecpm', label: 'eCPM', format: (value: number) => value ? `$${value.toFixed(2)}` : '$0.00', width: '100px' },
    { key: 'revenue', label: '收入', format: (value: number) => value ? `$${value.toFixed(2)}` : '$0.00', width: '100px' }
  ]
  
  // 只渲染可见行
  const visibleData = useMemo(() => {
    return state.data.slice(visibleRange.start, visibleRange.end)
  }, [state.data, visibleRange])
  
  if (state.loading && initialLoad.current) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="rounded-lg border border-gray-200">
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex space-x-4">
                {Array.from({ length: 8 }).map((_, j) => (
                  <Skeleton key={j} className="h-4 flex-1" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
  
  if (state.error) {
    if (state.error.includes('No data uploaded yet')) {
      return (
        <div className="p-12 text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无数据</h3>
          <p className="text-gray-600">请先上传CSV文件以查看数据表格</p>
        </div>
      )
    }
    return <div className="p-8 text-red-500">错误：{state.error}</div>
  }
  
  return (
    <div className="space-y-4">
      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="搜索网站、国家、域名或设备..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
            defaultValue={state.search}
            onChange={(e) => debouncedSearch(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          value={state.pagination.limit}
          onChange={(e) => {
            dispatch({ type: 'SET_PAGINATION', payload: { 
              limit: parseInt(e.target.value),
              cursor: null
            }})
          }}
        >
          <option value={50}>每页50条</option>
          <option value={100}>每页100条</option>
          <option value={200}>每页200条</option>
        </select>
      </div>
      
      {/* Stats Bar */}
      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>显示 {state.data.length} / {state.pagination.total} 条记录</span>
        {state.loading && <span>加载中...</span>}
      </div>
      
      {/* Virtual Scroll Table */}
      <div 
        ref={tableContainerRef} 
        className="overflow-x-auto rounded-lg border border-gray-200"
        style={{ height: containerHeight }}
      >
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  style={{ width: column.width }}
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {state.sortBy === column.key && (
                      <span>{state.sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {visibleData.map((row, index) => (
              <tr 
                key={`${row.id}-${visibleRange.start + index}`}
                className="hover:bg-gray-50 transition-colors"
              >
                {columns.map((column) => (
                  <td 
                    key={column.key} 
                    className="px-6 py-4 whitespace-nowrap text-sm"
                    style={{ width: column.width }}
                  >
                    {column.format ? column.format(row[column.key]) : row[column.key] || '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Load More Trigger */}
        {state.pagination.hasMore && (
          <div 
            ref={loadMoreRef} 
            className="h-10 flex items-center justify-center"
          >
            {state.loading && (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm text-gray-600">加载更多...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}