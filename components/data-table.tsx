'use client'

import { useState, useEffect } from 'react'

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

export default function DataTable({ refreshTrigger }: DataTableProps) {
  const [data, setData] = useState<AdReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
    cursors: [] as string[], // Store cursors for each page
    hasMore: false
  })
  const [sortBy, setSortBy] = useState('dataDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  
  useEffect(() => {
    fetchData()
  }, [pagination.page, pagination.limit, sortBy, sortOrder, search, refreshTrigger])
  
  const fetchData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams({
        limit: pagination.limit.toString(),
        sortBy,
        sortOrder,
        search
      })
      
      // Get cursor for current page
      const currentCursor = pagination.page > 1 ? pagination.cursors[pagination.page - 2] : null
      
      if (currentCursor) {
        params.append('cursor', currentCursor)
      }
      
      const response = await fetch(`/api/data?${params}`)
      if (!response.ok) throw new Error('Failed to fetch data')
      
      const result = await response.json()
      setData(result.data)
      
      // Update cursors array
      const newCursors = [...pagination.cursors]
      if (result.pagination.nextCursor && pagination.page <= newCursors.length) {
        newCursors[pagination.page - 1] = result.pagination.nextCursor
      }
      
      // Update pagination with API response
      setPagination(prev => ({
        ...prev,
        total: result.pagination.totalCount,
        pages: Math.ceil(result.pagination.totalCount / prev.limit),
        cursors: newCursors,
        hasMore: result.pagination.hasMore
      }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }
  
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
    // Reset pagination when sorting
    setPagination(prev => ({ ...prev, page: 1, cursors: [] }))
  }
  
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
  
  if (loading) return <div className="p-8">加载数据中...</div>
  if (error) {
    // Check if the error is due to no data uploaded
    if (error.includes('No data uploaded yet')) {
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
    return <div className="p-8 text-red-500">错误：{error}</div>
  }
  
  return (
    <div className="space-y-4">
      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="搜索网站、国家、域名或设备..."
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              // Reset pagination when searching
              setPagination(prev => ({ ...prev, page: 1, cursors: [] }))
            }}
          />
        </div>
        <select
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={pagination.limit}
          onChange={(e) => {
            setPagination(prev => ({ 
              ...prev, 
              page: 1,
              limit: parseInt(e.target.value),
              cursors: [] // Reset cursors when changing limit
            }))
          }}
        >
          <option value={10}>每页10条</option>
          <option value={50}>每页50条</option>
          <option value={100}>每页100条</option>
        </select>
      </div>
      
      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
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
                    {sortBy === column.key && (
                      <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((row) => (
              <tr key={row.id} className="hover:bg-gray-50">
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
          显示第 {pagination.page === 1 ? 1 : (pagination.page - 1) * pagination.limit + 1} 至{' '}
          {Math.min(pagination.page * pagination.limit, pagination.total)} 条，共{' '}
          {pagination.total} 条记录
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Previous Button */}
          <button
            className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            disabled={pagination.page === 1}
            onClick={() => {
              setPagination(prev => ({ ...prev, page: prev.page - 1 }))
            }}
          >
            上一页
          </button>
          
          {/* Page Numbers */}
          <div className="flex space-x-1">
            {Array.from({ length: Math.min(pagination.pages, 5) }, (_, i) => {
              let pageNum
              if (pagination.pages <= 5) {
                pageNum = i + 1
              } else if (pagination.page <= 3) {
                pageNum = i + 1
              } else if (pagination.page >= pagination.pages - 2) {
                pageNum = pagination.pages - 4 + i
              } else {
                pageNum = pagination.page - 2 + i
              }
              
              return (
                <button
                  key={pageNum}
                  className={`px-3 py-1 border rounded-lg text-sm ${
                    pagination.page === pageNum
                      ? 'bg-primary text-white border-primary'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    setPagination(prev => ({ ...prev, page: pageNum }))
                  }}
                >
                  {pageNum}
                </button>
              )
            })}
            
            {/* Ellipsis for many pages */}
            {pagination.pages > 5 && pagination.page < pagination.pages - 2 && (
              <>
                <span className="px-2 text-gray-500">...</span>
                <button
                  className="px-3 py-1 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
                  onClick={() => {
                    setPagination(prev => ({ ...prev, page: pagination.pages }))
                  }}
                >
                  {pagination.pages}
                </button>
              </>
            )}
          </div>
          
          {/* Next Button */}
          <button
            className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            disabled={pagination.page >= pagination.pages}
            onClick={() => {
              setPagination(prev => ({ ...prev, page: prev.page + 1 }))
            }}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  )
}