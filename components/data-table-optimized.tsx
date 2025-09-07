'use client'

import { useState, useEffect, useRef, useCallback, useMemo, useReducer } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { cacheManager } from '@/lib/cache-manager'

interface DataTableOptimizedProps {
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

// 优化的状态管理
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
  visibleRange: { start: number; end: number }
  scrollPosition: number
}

type TableAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_DATA'; payload: { data: AdReport[]; append?: boolean } }
  | { type: 'SET_PAGINATION'; payload: Partial<TableState['pagination']> }
  | { type: 'SET_SORT'; payload: { sortBy: string; sortOrder: 'asc' | 'desc' } }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_VISIBLE_RANGE'; payload: { start: number; end: number } }
  | { type: 'SET_SCROLL_POSITION'; payload: number }
  | { type: 'RESET_STATE' }

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
  search: '',
  visibleRange: { start: 0, end: 50 }, // 初始显示50行
  scrollPosition: 0
}

function tableReducer(state: TableState, action: TableAction): TableState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    case 'SET_DATA':
      const newData = action.payload.append 
        ? [...state.data, ...action.payload.data]
        : action.payload.data
      return { ...state, data: newData }
    case 'SET_PAGINATION':
      return { ...state, pagination: { ...state.pagination, ...action.payload } }
    case 'SET_SORT':
      return { ...state, sortBy: action.payload.sortBy, sortOrder: action.payload.sortOrder }
    case 'SET_SEARCH':
      return { ...state, search: action.payload }
    case 'SET_VISIBLE_RANGE':
      return { ...state, visibleRange: action.payload }
    case 'SET_SCROLL_POSITION':
      return { ...state, scrollPosition: action.payload }
    case 'RESET_STATE':
      return { ...initialState, data: [] }
    default:
      return state
  }
}

export default function DataTableOptimized({ refreshTrigger }: DataTableOptimizedProps) {
  const [state, dispatch] = useReducer(tableReducer, initialState)
  const tableContainerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const initialLoad = useRef(true)
  const searchTimeoutRef = useRef<NodeJS.Timeout>()
  
  // 虚拟滚动配置
  const ROW_HEIGHT = 41
  const BUFFER_ROWS = 10
  const OVERSCAN_ROWS = 5
  
  // 计算虚拟滚动参数
  const virtualScrollConfig = useMemo(() => {
    const containerHeight = tableContainerRef.current?.clientHeight || 600
    const totalHeight = state.pagination.total * ROW_HEIGHT
    const visibleRows = Math.ceil(containerHeight / ROW_HEIGHT)
    
    return {
      containerHeight,
      totalHeight,
      visibleRows,
      bufferSize: BUFFER_ROWS * ROW_HEIGHT,
      overscanRows: OVERSCAN_ROWS
    }
  }, [state.pagination.total])
  
  // 计算可见数据范围
  const calculateVisibleRange = useCallback((scrollTop: number) => {
    const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - virtualScrollConfig.overscanRows)
    const endIndex = Math.min(
      state.data.length,
      startIndex + virtualScrollConfig.visibleRows + virtualScrollConfig.overscanRows * 2
    )
    
    return { start: startIndex, end: endIndex }
  }, [virtualScrollConfig, state.data.length])
  
  // 防抖搜索
  const debouncedSearch = useCallback((value: string) => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    searchTimeoutRef.current = setTimeout(() => {
      dispatch({ type: 'SET_SEARCH', payload: value })
    }, 500) // 增加防抖时间
  }, [])
  
  // 获取数据 - 带缓存
  const fetchData = useCallback(async (reset = false, loadMore = false) => {
    if (reset) {
      dispatch({ type: 'SET_LOADING', payload: true })
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
      
      // 生成缓存键
      const cacheKey = `data:${params.toString()}`
      
      // 尝试从缓存获取
      const cached = await cacheManager.getCachedQuery(cacheKey)
      let result
      
      if (cached) {
        result = cached
      } else {
        const response = await fetch(`/api/data?${params}`)
        if (!response.ok) throw new Error('Failed to fetch data')
        result = await response.json()
        
        // 缓存结果
        await cacheManager.cacheQueryResult(cacheKey, result, 300) // 5分钟缓存
      }
      
      dispatch({ 
        type: 'SET_DATA', 
        payload: { data: result.data, append: loadMore }
      })
      
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
  }, [state.pagination.limit, state.pagination.cursor, state.sortBy, state.sortOrder, state.search])
  
  // 滚动事件处理
  const handleScroll = useCallback(() => {
    if (!tableContainerRef.current) return
    
    const scrollTop = tableContainerRef.current.scrollTop
    dispatch({ type: 'SET_SCROLL_POSITION', payload: scrollTop })
    
    // 计算新的可见范围
    const newRange = calculateVisibleRange(scrollTop)
    
    // 只在必要时更新
    if (
      newRange.start !== state.visibleRange.start || 
      newRange.end !== state.visibleRange.end
    ) {
      dispatch({ type: 'SET_VISIBLE_RANGE', payload: newRange })
    }
  }, [calculateVisibleRange, state.visibleRange])
  
  // 预加载数据
  const preloadData = useCallback(async () => {
    if (state.loading || !state.pagination.hasMore) return
    
    const { scrollTop, scrollHeight, clientHeight } = tableContainerRef.current!
    const scrollPercentage = (scrollTop + clientHeight) / scrollHeight
    
    // 当滚动到80%时预加载下一页
    if (scrollPercentage > 0.8) {
      fetchData(false, true)
    }
  }, [fetchData, state.loading, state.pagination.hasMore])
  
  // 初始化
  useEffect(() => {
    fetchData()
  }, [refreshTrigger])
  
  // 监听搜索和排序变化
  useEffect(() => {
    if (!initialLoad.current) {
      dispatch({ type: 'RESET_STATE' })
      setTimeout(() => fetchData(true), 100) // 小延迟避免竞争
    }
  }, [state.search, state.sortBy, state.sortOrder])
  
  // 滚动事件监听
  useEffect(() => {
    const container = tableContainerRef.current
    if (!container) return
    
    container.addEventListener('scroll', handleScroll)
    
    return () => {
      container.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])
  
  // 预加载逻辑
  useEffect(() => {
    const interval = setInterval(() => {
      if (tableContainerRef.current) {
        preloadData()
      }
    }, 200) // 每200ms检查一次
    
    return () => clearInterval(interval)
  }, [preloadData])
  
  // 排序处理
  const handleSort = useCallback((column: string) => {
    const newSortOrder = state.sortBy === column ? 
      (state.sortOrder === 'asc' ? 'desc' : 'asc') : 
      'desc'
    
    dispatch({ type: 'SET_SORT', payload: { sortBy: column, sortOrder: newSortOrder } })
  }, [state.sortBy, state.sortOrder])
  
  // 列定义
  const columns = useMemo(() => [
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
  ], [])
  
  // 计算渲染的行
  const visibleData = useMemo(() => {
    return state.data.slice(state.visibleRange.start, state.visibleRange.end)
  }, [state.data, state.visibleRange])
  
  // 计算滚动偏移
  const offsetY = state.visibleRange.start * ROW_HEIGHT
  
  // Loading state
  if (state.loading && initialLoad.current) {
    return (
      <div className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="rounded-lg border border-gray-200">
          <div className="space-y-2 p-4">
            {Array.from({ length: 10 }).map((_, i) => (
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
  
  // Error state
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
          <option value={500}>每页500条</option>
        </select>
      </div>
      
      {/* Stats Bar */}
      <div className="flex justify-between items-center text-sm text-gray-600">
        <span>
          显示 {Math.min(state.visibleRange.end, state.data.length)} / {state.pagination.total} 条记录
          {state.data.length < state.pagination.total && (
            <span className="ml-2 text-blue-600">
              (已加载 {Math.round((state.data.length / state.pagination.total) * 100)}%)
            </span>
          )}
        </span>
        {state.loading && <span>加载中...</span>}
      </div>
      
      {/* Virtual Scroll Table */}
      <div 
        ref={tableContainerRef} 
        className="overflow-x-auto rounded-lg border border-gray-200 relative"
        style={{ height: virtualScrollConfig.containerHeight }}
      >
        <div 
          className="relative"
          style={{ height: virtualScrollConfig.totalHeight }}
        >
          <table className="min-w-full divide-y divide-gray-200 absolute top-0 left-0" 
                 style={{ transform: `translateY(${offsetY}px)` }}>
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
              {visibleData.map((row, index) => {
                const actualIndex = state.visibleRange.start + index
                return (
                  <tr 
                    key={`${row.id}-${actualIndex}`}
                    className="hover:bg-gray-50 transition-colors"
                    style={{ height: ROW_HEIGHT }}
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
                )
              })}
            </tbody>
          </table>
          
          {/* Loading indicator */}
          {state.loading && state.data.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-10 bg-white bg-opacity-90 flex items-center justify-center">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <span className="text-sm text-gray-600">加载更多...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}