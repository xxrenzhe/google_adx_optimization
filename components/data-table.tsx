'use client'

import { useState, useEffect, useRef, useCallback, useReducer } from 'react'
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

// 使用 useReducer 优化状态管理 - 减少不必要的重新渲染
type TableState = {
  data: AdReport[]
  loading: boolean
  error: string | null
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
    cursors: string[]
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
  | { type: 'RESET_PAGINATION' }

const initialState: TableState = {
  data: [],
  loading: true,
  error: null,
  pagination: {
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
    cursors: [],
    hasMore: false
  },
  sortBy: 'revenue',
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
    case 'RESET_PAGINATION':
      return { ...state, pagination: { ...state.pagination, page: 1, cursors: [] } }
    default:
      return state
  }
}

export default function DataTable({ refreshTrigger }: DataTableProps) {
  const [state, dispatch] = useReducer(tableReducer, initialState)
  const [isDataStale, setIsDataStale] = useState(false) // 标记数据是否过期
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const savedScrollPosition = useRef(0)
  const initialLoad = useRef(true) // 标记是否首次加载
  
  useEffect(() => {
    fetchData()
  }, [state.pagination.page, state.pagination.limit, state.sortBy, state.sortOrder, state.search, refreshTrigger])
  
  // 只在数据变化且不在加载状态时恢复滚动位置
  useEffect(() => {
    if (!state.loading && savedScrollPosition.current > 0 && tableContainerRef.current) {
      tableContainerRef.current.scrollLeft = savedScrollPosition.current
      savedScrollPosition.current = 0
    }
  }, [state.data, state.loading])
  
  const fetchData = async () => {
    // 首次加载才显示加载状态，后续操作保持视觉连续性
    if (initialLoad.current) {
      dispatch({ type: 'SET_LOADING', payload: true })
    } else {
      // 标记数据为过期，但不清空显示
      setIsDataStale(true)
    }
    
    dispatch({ type: 'SET_ERROR', payload: null })
    
    try {
      const params = new URLSearchParams({
        limit: state.pagination.limit.toString(),
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
        search: state.search
      })
      
      // Get cursor for current page
      const currentCursor = state.pagination.page > 1 ? state.pagination.cursors[state.pagination.page - 2] : null
      
      if (currentCursor) {
        params.append('cursor', currentCursor)
      }
      
      const response = await fetch(`/api/data?${params}`)
      if (!response.ok) throw new Error('Failed to fetch data')
      
      const result = await response.json()
      
      // 批量更新所有状态，避免多次渲染
      dispatch({ type: 'SET_DATA', payload: result.data })
      setIsDataStale(false)
      initialLoad.current = false
      
      // Update cursors array
      const newCursors = [...state.pagination.cursors]
      if (result.pagination.nextCursor && state.pagination.page <= newCursors.length) {
        newCursors[state.pagination.page - 1] = result.pagination.nextCursor
      }
      
      // Update pagination with API response
      dispatch({ type: 'SET_PAGINATION', payload: {
        total: result.pagination.totalCount,
        pages: Math.ceil(result.pagination.totalCount / state.pagination.limit),
        cursors: newCursors,
        hasMore: result.pagination.hasMore
      }})
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: err instanceof Error ? err.message : 'Unknown error' })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }
  
  const handleSort = useCallback((column: string) => {
    // Save current scroll position before data changes
    savedScrollPosition.current = tableContainerRef.current?.scrollLeft || 0
    
    // 计算新的排序状态，避免多次渲染
    const newSortOrder = state.sortBy === column ? 
      (state.sortOrder === 'asc' ? 'desc' : 'asc') : 
      'desc'
    
    // 批量更新排序状态
    dispatch({ type: 'SET_SORT', payload: { sortBy: column, sortOrder: newSortOrder } })
    dispatch({ type: 'RESET_PAGINATION' })
  }, [state.sortBy, state.sortOrder])
  
  const columns: Array<{
    key: keyof AdReport
    label: string
    format?: (value: any) => string
  }> = [
    { key: 'dataDate', label: '日期', format: (value: string | null) => value ? new Date(value).toLocaleDateString() : '无' },
    { key: 'website', label: '网站' },
    { key: 'country', label: '国家' },
    { key: 'adFormat', label: '广告格式' },
    { key: 'adUnit', label: '广告单元' },
    { key: 'advertiser', label: '广告客户' },
    { key: 'domain', label: '网域' },
    { key: 'device', label: '设备' },
    { key: 'browser', label: '浏览器' },
    { key: 'requests', label: '请求数', format: (value: number | null) => value ? value.toLocaleString() : '0' },
    { key: 'impressions', label: '展示数', format: (value: number | null) => value ? value.toLocaleString() : '0' },
    { key: 'clicks', label: '点击数', format: (value: number | null) => value ? value.toLocaleString() : '0' },
    { key: 'ctr', label: '点击率', format: (value: number | null) => value ? `${(value * 100).toFixed(2)}%` : '0%' },
    { key: 'ecpm', label: '平均eCPM', format: (value: number | null) => value ? `$${value.toFixed(2)}` : '$0.00' },
    { key: 'revenue', label: '收入', format: (value: number | null) => value ? `$${value.toFixed(2)}` : '$0.00' },
    { key: 'viewableImpressions', label: '可见展示数', format: (value: number | null) => value ? value.toLocaleString() : '0' },
    { key: 'viewabilityRate', label: '可见率', format: (value: number | null) => value ? `${(value * 100).toFixed(2)}%` : '0%' },
    { key: 'measurableImpressions', label: '可衡量展示数', format: (value: number | null) => value ? value.toLocaleString() : '0' },
    { key: 'fillRate', label: '填充率', format: (value: number | null) => value ? `${value.toFixed(1)}%` : '0%' },
    { key: 'arpu', label: '每用户收入', format: (value: number | null) => value ? `$${value.toFixed(4)}` : '$0.0000' }
  ]
  
  // 只在首次加载时显示骨架屏，后续操作保持数据可见
  if (state.loading && initialLoad.current) {
    return (
      <div className="space-y-4">
        {/* 搜索框骨架屏 */}
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        
        {/* 表格骨架屏 */}
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
    // Check if the error is due to no data uploaded
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
            value={state.search}
            onChange={(e) => {
              // Save scroll position before search
              savedScrollPosition.current = tableContainerRef.current?.scrollLeft || 0
              dispatch({ type: 'SET_SEARCH', payload: e.target.value })
              dispatch({ type: 'RESET_PAGINATION' })
            }}
          />
        </div>
        <select
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          value={state.pagination.limit}
          onChange={(e) => {
            // Save scroll position before changing limit
            savedScrollPosition.current = tableContainerRef.current?.scrollLeft || 0
            dispatch({ type: 'SET_PAGINATION', payload: { 
              page: 1,
              limit: parseInt(e.target.value),
              cursors: []
            }})
          }}
        >
          <option value={10}>每页10条</option>
          <option value={50}>每页50条</option>
          <option value={100}>每页100条</option>
        </select>
      </div>
      
      {/* Table with transition effect */}
      <div 
        ref={tableContainerRef} 
        className={`overflow-x-auto rounded-lg border border-gray-200 transition-opacity duration-200 ${isDataStale ? 'opacity-60' : 'opacity-100'}`}
      >
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort(column.key)}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.label}</span>
                    {state.sortBy === column.key && (
                      <span className="transition-transform duration-200">{state.sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {state.data.map((row) => (
              <tr 
                key={row.id} 
                className={`hover:bg-gray-50 transition-colors duration-150 ${isDataStale ? 'animate-pulse' : ''}`}
              >
                {columns.map((column) => (
                  <td key={column.key} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {column.format
                      ? column.format(row[column.key])
                      : row[column.key] || ''
                    }
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="text-sm text-gray-700">
          显示第 {state.pagination.page === 1 ? 1 : (state.pagination.page - 1) * state.pagination.limit + 1} 至{' '}
          {Math.min(state.pagination.page * state.pagination.limit, state.pagination.total)} 条，共{' '}
          {state.pagination.total} 条记录
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Previous Button */}
          <button
            className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            disabled={state.pagination.page === 1}
            onClick={() => {
              // Save scroll position before changing page
              savedScrollPosition.current = tableContainerRef.current?.scrollLeft || 0
              dispatch({ type: 'SET_PAGINATION', payload: { page: state.pagination.page - 1 } })
            }}
          >
            上一页
          </button>
          
          {/* Page Numbers */}
          <div className="flex space-x-1">
            {Array.from({ length: Math.min(state.pagination.pages, 5) }, (_, i) => {
              let pageNum
              if (state.pagination.pages <= 5) {
                pageNum = i + 1
              } else if (state.pagination.page <= 3) {
                pageNum = i + 1
              } else if (state.pagination.page >= state.pagination.pages - 2) {
                pageNum = state.pagination.pages - 4 + i
              } else {
                pageNum = state.pagination.page - 2 + i
              }
              
              return (
                <button
                  key={pageNum}
                  className={`px-3 py-1 border rounded-lg text-sm transition-colors ${
                    state.pagination.page === pageNum
                      ? 'bg-primary text-white border-primary'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    // Save scroll position before changing page
                    savedScrollPosition.current = tableContainerRef.current?.scrollLeft || 0
                    dispatch({ type: 'SET_PAGINATION', payload: { page: pageNum } })
                  }}
                >
                  {pageNum}
                </button>
              )
            })}
            
            {/* Ellipsis for many pages */}
            {state.pagination.pages > 5 && state.pagination.page < state.pagination.pages - 2 && (
              <>
                <span className="px-2 text-gray-500">...</span>
                <button
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    // Save scroll position before changing page
                    savedScrollPosition.current = tableContainerRef.current?.scrollLeft || 0
                    dispatch({ type: 'SET_PAGINATION', payload: { page: state.pagination.pages } })
                  }}
                >
                  {state.pagination.pages}
                </button>
              </>
            )}
          </div>
          
          {/* Next Button */}
          <button
            className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            disabled={state.pagination.page >= state.pagination.pages}
            onClick={() => {
              // Save scroll position before changing page
              savedScrollPosition.current = tableContainerRef.current?.scrollLeft || 0
              dispatch({ type: 'SET_PAGINATION', payload: { page: state.pagination.page + 1 } })
            }}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  )
}