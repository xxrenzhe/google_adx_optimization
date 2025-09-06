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
    nextCursor: null as string | null,
    hasMore: false
  })
  const [sortBy, setSortBy] = useState('dataDate')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [search, setSearch] = useState('')
  
  useEffect(() => {
    fetchData()
  }, [pagination.limit, sortBy, sortOrder, search, refreshTrigger])
  
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
      
      // Add cursor if we have one (for pagination)
      if (pagination.nextCursor) {
        params.append('cursor', pagination.nextCursor)
      }
      
      const response = await fetch(`/api/data?${params}`)
      if (!response.ok) throw new Error('Failed to fetch data')
      
      const result = await response.json()
      setData(result.data)
      
      // Update pagination with API response
      setPagination(prev => ({
        ...prev,
        total: result.pagination.totalCount,
        pages: Math.ceil(result.pagination.totalCount / prev.limit),
        nextCursor: result.pagination.nextCursor,
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
  }
  
  const columns: Array<{
    key: keyof AdReport
    label: string
    format?: (value: any) => string
  }> = [
    { key: 'dataDate', label: '日期', format: (value: string | null) => value ? new Date(value).toLocaleDateString() : '无' },
    { key: 'website', label: '网站' },
    { key: 'country', label: '国家' },
    { key: 'device', label: '设备' },
    { key: 'requests', label: '请求数', format: (value: number | null) => value ? value.toLocaleString() : '0' },
    { key: 'impressions', label: '展示数', format: (value: number | null) => value ? value.toLocaleString() : '0' },
    { key: 'clicks', label: '点击数', format: (value: number | null) => value ? value.toLocaleString() : '0' },
    { key: 'ctr', label: '点击率', format: (value: number | null) => value ? `${(value * 100).toFixed(2)}%` : '0%' },
    { key: 'ecpm', label: '千次展示收入', format: (value: number | null) => value ? `$${value.toFixed(2)}` : '$0.00' },
    { key: 'revenue', label: '收入', format: (value: number | null) => value ? `$${value.toFixed(2)}` : '$0.00' },
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
          <p className="text-gray-600 mb-6">请先上传CSV文件以查看数据表格</p>
          <button
            onClick={() => {
              // Find the upload tab button and click it
              const uploadTab = document.querySelector('button[onclick*="upload"]') as HTMLElement;
              if (uploadTab) {
                uploadTab.click();
              } else {
                // Fallback: change URL hash
                window.location.hash = 'upload';
                window.location.reload();
              }
            }}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          >
            前往上传
          </button>
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
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
          value={pagination.limit}
          onChange={(e) => {
            setPagination(prev => ({ 
              ...prev, 
              limit: parseInt(e.target.value),
              nextCursor: null // Reset cursor when changing limit
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
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-700">
          显示第 {data.length > 0 ? 1 : 0} 至{' '}
          {data.length} 条，共{' '}
          {pagination.total} 条记录
        </div>
        <div className="flex space-x-2">
          <button
            className="px-3 py-1 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!pagination.nextCursor}
            onClick={() => {
              // Load more data using cursor
              fetchData()
            }}
          >
            加载更多
          </button>
        </div>
      </div>
    </div>
  )
}