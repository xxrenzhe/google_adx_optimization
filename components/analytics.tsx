'use client'

import { useState, useEffect } from 'react'
import { useFileSession } from '@/contexts/file-session'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface AlertData {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  data?: Record<string, unknown>
  timestamp: string
}

interface AnalyticsDataRow {
  date: string
  website: string
  country?: string
  device?: string
  browser?: string
  adFormat?: string
  adUnit?: string
  requests?: number
  impressions?: number
  clicks?: number
  ctr?: number
  ecpm?: number
  revenue?: number
  viewableImpressions?: number
  viewabilityRate?: number
  fillRate?: number
  arpu?: number
}

interface AlertData {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  data?: Record<string, unknown>
  timestamp: string
}

interface AnalyticsData {
  date: string
  revenue: number
  impressions: number
  requests: number
  ctr: number
  ecpm: number
  fillRate: number
}

interface AnalyticsProps {
  fileId: string | null;
  filters?: {
    startDate?: string
    endDate?: string
  }
}

interface AnalyticsData {
  summary: {
    totalRevenue: number
    totalImpressions: number
    totalRequests?: number
    totalClicks?: number
    avgEcpm?: number
    avgCtr?: number
    avgFillRate?: number
    arpu?: number
  }
  charts: {
    revenueByDate: { date: string; revenue: number }[]
    revenueByCountry: { country: string; revenue: number }[]
    revenueByDevice: { device: string; revenue: number }[]
    fillRateDistribution: { range: string; count: number }[]
  }
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function Analytics({ fileId, filters }: AnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    fetchAnalytics()
  }, [filters, fileId])
  
  const fetchAnalytics = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      if (filters?.startDate) params.append('startDate', filters.startDate)
      if (filters?.endDate) params.append('endDate', filters.endDate)
      if (fileId) params.append('fileId', fileId)
      
      const response = await fetch(`/api/analytics?${params}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')
      
      const analyticsData = await response.json()
      setData(analyticsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) return <div className="p-8">加载分析数据中...</div>
  
  // 如果没有选择文件，显示提示
  if (!fileId) {
    return (
      <div className="p-12 text-center">
        <div className="mb-4">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">请先上传数据文件</h3>
        <p className="text-gray-600 mb-6">上传CSV文件后，系统将仅分析该文件的数据</p>
        <button
          onClick={() => {
            const uploadTab = document.querySelector('button[onclick*="upload"]') as HTMLElement;
            if (uploadTab) {
              uploadTab.click();
            } else {
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
  
  if (error) {
    // Check if the error is due to no data uploaded
    if (error.includes('No data uploaded yet')) {
      return (
        <div className="p-12 text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无分析数据</h3>
          <p className="text-gray-600 mb-6">请先上传CSV文件以查看数据分析</p>
          <button
            onClick={() => {
              const uploadTab = document.querySelector('button[onclick*="upload"]') as HTMLElement;
              if (uploadTab) {
                uploadTab.click();
              } else {
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
  if (!data) return null
  
  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">总收入</h3>
          <p className="text-2xl font-bold">
            ${data.summary.totalRevenue.toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">展示数</h3>
          <p className="text-2xl font-bold">
            {data.summary.totalImpressions.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">请求数</h3>
          <p className="text-2xl font-bold">
            {data.summary.totalRequests?.toLocaleString() || 'N/A'}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">填充率</h3>
          <p className="text-2xl font-bold">
            {data.summary.avgFillRate?.toFixed(1) ?? 
             (data.summary.totalRequests && data.summary.totalImpressions ? 
              ((data.summary.totalImpressions / data.summary.totalRequests) * 100).toFixed(1) + '%' : 'N/A')}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">每用户平均收入</h3>
          <p className="text-2xl font-bold">
            {data.summary.arpu?.toFixed(4) ?? 
             (data.summary.totalRequests && data.summary.totalRevenue ? 
              '$' + (data.summary.totalRevenue / data.summary.totalRequests).toFixed(4) : 'N/A')}
          </p>
        </div>
      </div>
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">收入趋势</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.charts.revenueByDate || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value}`, '收入']} />
              <Line type="monotone" dataKey="revenue" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Revenue by Country */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">按国家统计收入</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.charts.revenueByCountry || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ country, revenue }) => `${country}: $${revenue.toFixed(2)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="revenue"
              >
                {(data.charts.revenueByCountry || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`$${value}`, '收入']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Revenue by Device */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">按设备统计收入</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.charts.revenueByDevice || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="device" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value}`, '收入']} />
              <Bar dataKey="revenue" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Fill Rate Distribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">填充率分布</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.charts.fillRateDistribution || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#ffc658" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* 洞察分析 */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">洞察分析</h3>
        <div className="space-y-2">
          {(data.summary.avgFillRate || (data.summary.totalRequests && data.summary.totalImpressions ? 
            (data.summary.totalImpressions / data.summary.totalRequests) * 100 : 100)) < 50 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800">
                ⚠️ 填充率较低 ({
                  (data.summary.avgFillRate || (data.summary.totalRequests && data.summary.totalImpressions ? 
                    (data.summary.totalImpressions / data.summary.totalRequests) * 100 : 0)).toFixed(1)
                }%)。建议优化广告位配置。
              </p>
            </div>
          )}
          
          {data.charts.revenueByCountry && data.charts.revenueByCountry.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800">
                💡 表现最佳国家：{data.charts.revenueByCountry[0].country} 
                (收入 ${data.charts.revenueByCountry[0].revenue.toFixed(2)})
              </p>
            </div>
          )}
          
          {data.charts.revenueByDevice && data.charts.revenueByDevice.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-800">
                📱 最佳设备类型：{data.charts.revenueByDevice[0].device}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}