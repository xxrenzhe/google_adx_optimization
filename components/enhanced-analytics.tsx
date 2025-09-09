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
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  Treemap
} from 'recharts'

interface EnhancedAnalyticsData {
  date: string
  revenue: number
  impressions: number
  requests: number
  ctr: number
  ecpm: number
  fillRate: number
  viewabilityRate: number
  arpu: number
  detailedData?: DetailedDataRow[]
  advertiser?: string
  domain?: string
  clicks?: number
  _count?: number
  _sum?: {
    revenue: number
    impressions: number
    clicks?: number
    ctr?: number
    ecpm?: number
    viewabilityRate?: number
    requests?: number
  }
  _avg?: {
    ecpm?: number
    ctr?: number
    fillRate?: number
    viewabilityRate?: number
  }
  adFormats?: Map<string, number>
  domains?: Set<string>
  occurrences?: number
  websites?: Set<string>
  country?: string
  device?: string
  ad_format?: string
  total_revenue?: number
  avg_ecpm?: number
  hour?: string
  count?: number
  adFormat?: string
  adUnit?: string
  website?: string
  browser?: string
}

interface DetailedDataRow {
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
  advertiser?: string
  domain?: string
}

interface EnhancedAnalyticsProps {
  fileId: string | null;
  filters?: {
    startDate?: string
    endDate?: string
  }
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C']

export default function EnhancedAnalytics({ fileId, filters }: EnhancedAnalyticsProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'advertisers' | 'devices' | 'geography' | 'optimization'>('advertisers')

  useEffect(() => {
    console.log('useEffect triggered with:', { fileId, filters })
    fetchEnhancedAnalytics()
  }, [filters, fileId])

  const fetchEnhancedAnalytics = async () => {
    console.log('fetchEnhancedAnalytics called')
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters?.startDate) params.append('startDate', filters.startDate)
      if (filters?.endDate) params.append('endDate', filters.endDate)
      if (fileId) params.append('fileId', fileId)
      
      console.log('Fetching enhanced analytics with fileId:', fileId)
      console.log('API URL:', `/api/analytics-enhanced?${params}`)
      
      const response = await fetch(`/api/analytics-enhanced?${params}`)
      console.log('Response status:', response.status)
      console.log('Response ok:', response.ok)
      
      if (!response.ok) {
        const errorData = await response.json()
        console.log('Error response:', errorData)
        throw new Error(errorData.error || 'Failed to fetch enhanced analytics')
      }
      
      const analyticsData = await response.json()
      console.log('Enhanced analytics data received:', analyticsData)
      console.log('Data keys:', Object.keys(analyticsData))
      console.log('advertiserAnalysis length:', analyticsData.advertiserAnalysis?.length || 0)
      console.log('geoAnalysis length:', analyticsData.geoAnalysis?.length || 0)
      console.log('deviceBrowserMatrix length:', analyticsData.deviceBrowserMatrix?.length || 0)
      
      setData(analyticsData)
    } catch (error) {
      console.error('Error fetching enhanced analytics:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.log('Error message:', errorMessage)
      setError(errorMessage)
    } finally {
      console.log('Setting loading to false')
      setLoading(false)
    }
  }

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

  if (loading) {
    return <div className="p-8 text-center">加载高级分析数据...</div>
  }

  if (error) {
    // Check if the error is due to no data uploaded
    if (error.includes('No data uploaded yet')) {
      return (
        <div className="p-12 text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无高级分析数据</h3>
          <p className="text-gray-600 mb-6">请先上传CSV文件以查看高级分析</p>
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

  console.log('EnhancedAnalytics render state:', { fileId, loading, error, data: !!data, activeTab })
  console.log('Component render - Current time:', new Date().toISOString())
  
  if (!data) {
    console.log('No data available, returning null')
    return null
  }

  console.log('Rendering EnhancedAnalytics with data keys:', Object.keys(data))
  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { key: 'advertisers', label: '广告客户分析' },
            { key: 'devices', label: '设备浏览器' },
            { key: 'geography', label: '地理分布' },
            { key: 'optimization', label: '优化建议' }
          ].map((tab) => (
            <button
              key={tab.key}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab(tab.key as any)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Advertisers Analysis */}
      {activeTab === 'advertisers' && (
        <div className="space-y-6">
          {/* Top Advertisers by Revenue */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">高价值广告客户 Top 10</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">广告客户</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">域名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">总收入</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">平均eCPM</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">点击率</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">记录数</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {(data.advertiserAnalysis || []).slice(0, 10).map((item: any, index: number) => (
                    <tr key={index} className={(item as EnhancedAnalyticsData)._avg.ecpm > 50 ? 'bg-green-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{(item as EnhancedAnalyticsData).advertiser || '未知'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(item as EnhancedAnalyticsData).domain || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${((item as EnhancedAnalyticsData)._sum.revenue || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${((item as EnhancedAnalyticsData)._avg.ecpm || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(((item as EnhancedAnalyticsData)._avg.ctr || 0) * 100).toFixed(2)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(item as EnhancedAnalyticsData)._count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* eCPM Distribution */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">eCPM 分布分析</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.ecmpBuckets || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Device-Browser Analysis */}
      {activeTab === 'devices' && (
        <div className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">设备-浏览器性能矩阵</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {(data.deviceBrowserMatrix || [])
                .filter((item: any) => (item as EnhancedAnalyticsData)._sum.revenue > 1)
                .sort((a: any, b: any) => b._avg.ecpm - a._avg.ecpm)
                .slice(0, 12)
                .map((item: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{(item as EnhancedAnalyticsData).device}</h4>
                        <p className="text-sm text-gray-500">{(item as EnhancedAnalyticsData).browser}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        (item as EnhancedAnalyticsData)._avg.ecpm > 20 ? 'bg-green-100 text-green-800' :
                        (item as EnhancedAnalyticsData)._avg.ecpm > 10 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        ${((item as EnhancedAnalyticsData)._avg.ecpm || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">收入:</span>
                        <span className="font-medium">${((item as EnhancedAnalyticsData)._sum.revenue || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">展示:</span>
                        <span>{((item as EnhancedAnalyticsData)._sum.impressions || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">点击率:</span>
                        <span>{(((item as EnhancedAnalyticsData)._avg.ctr || 0) * 100).toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Hourly Performance Pattern */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">24小时表现模式</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={data.hourlyPattern || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="avg_ecpm" stroke="#8884d8" name="平均eCPM" />
                <Line yAxisId="right" type="monotone" dataKey="total_revenue" stroke="#82ca9d" name="总收入" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Geography Analysis */}
      {activeTab === 'geography' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Country Performance */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">国家/地区表现</h3>
              <ResponsiveContainer width="100%" height={400}>
                <PieChart>
                  <Pie
                    data={data.geoAnalysis?.map((item: any) => ({
                      country: (item as EnhancedAnalyticsData).country,
                      totalRevenue: (item as EnhancedAnalyticsData)._sum.revenue,
                      totalImpressions: (item as EnhancedAnalyticsData)._sum.impressions,
                      avgEcpm: (item as EnhancedAnalyticsData)._avg.ecpm
                    })) || []}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ country, totalRevenue }) => `${country}: $${totalRevenue.toFixed(1)}`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="totalRevenue"
                  >
                    {data.geoAnalysis?.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number) => [`$${value.toFixed(2)}`, '收入']} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Top Combinations */}
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-lg font-medium mb-4">最优组合配置</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {data.topCombinations
                  ?.filter((item: any) => (item as EnhancedAnalyticsData).revenue > 0)
                  .sort((a: any, b: any) => b.ecpm - a.ecpm)
                  .map((item: any, index: number) => (
                  <div key={index} className="border rounded-lg p-3 bg-gradient-to-r from-green-50 to-blue-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{(item as EnhancedAnalyticsData).country}</h4>
                        <p className="text-sm text-gray-600">{(item as EnhancedAnalyticsData).device} · {(item as EnhancedAnalyticsData).adFormat}</p>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        ${((item as EnhancedAnalyticsData).ecpm || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>总收入: ${(item as EnhancedAnalyticsData).revenue.toFixed(2)}</span>
                      <span>出现次数: {(item as EnhancedAnalyticsData).count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Optimization Recommendations */}
      {activeTab === 'optimization' && (
        <div className="space-y-6">
          {/* Ad Unit Performance */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">广告单元优化建议</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">广告格式</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">广告单元</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">平均eCPM</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">填充率</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">建议</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {data.adUnitAnalysis?.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{(item as EnhancedAnalyticsData).adFormat}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(item as EnhancedAnalyticsData).adUnit}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${((item as EnhancedAnalyticsData)._avg.ecpm || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{(((item as EnhancedAnalyticsData)._avg.fillRate || 0) * 100).toFixed(1)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {(item as EnhancedAnalyticsData)._avg.ecpm > 10 ? (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">优先投放</span>
                        ) : (item as EnhancedAnalyticsData)._avg.fillRate < 30 ? (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">需要优化</span>
                        ) : (
                          <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full">保持现状</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Viewability Analysis */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-medium mb-4">可见度分析</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.viewabilityAnalysis || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="adFormat" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="_avg.viewabilityRate" fill="#8884d8" name="可见率%" />
                <Bar dataKey="_avg.ecpm" fill="#82ca9d" name="eCPM" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}