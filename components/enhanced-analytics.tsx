'use client'

import { useState, useEffect } from 'react'
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

interface EnhancedAnalyticsProps {
  filters?: {
    startDate?: string
    endDate?: string
  }
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#FF7C7C']

export default function EnhancedAnalytics({ filters }: EnhancedAnalyticsProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'advertisers' | 'devices' | 'geography' | 'optimization'>('advertisers')

  useEffect(() => {
    fetchEnhancedAnalytics()
  }, [filters])

  const fetchEnhancedAnalytics = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filters?.startDate) params.append('startDate', filters.startDate)
      if (filters?.endDate) params.append('endDate', filters.endDate)
      
      const response = await fetch(`/api/analytics-enhanced?${params}`)
      if (!response.ok) throw new Error('Failed to fetch enhanced analytics')
      
      const analyticsData = await response.json()
      setData(analyticsData)
    } catch (error) {
      console.error('Error fetching enhanced analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">加载高级分析数据...</div>
  }

  if (!data) return null

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
                  {data.advertiserAnalysis.slice(0, 10).map((item: any, index: number) => (
                    <tr key={index} className={item._avg.ecpm > 50 ? 'bg-green-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.advertiser || '未知'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.domain || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(item._sum.revenue || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(item._avg.ecpm || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{((item._avg.ctr || 0) * 100).toFixed(2)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item._count}</td>
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
              <BarChart data={data.ecpmBuckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="ecpm_range" />
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
              {data.deviceBrowserMatrix
                .filter((item: any) => item._sum.revenue > 1)
                .sort((a: any, b: any) => b._avg.ecpm - a._avg.ecpm)
                .slice(0, 12)
                .map((item: any, index: number) => (
                  <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{item.device}</h4>
                        <p className="text-sm text-gray-500">{item.browser}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        item._avg.ecpm > 20 ? 'bg-green-100 text-green-800' :
                        item._avg.ecpm > 10 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        ${(item._avg.ecpm || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">收入:</span>
                        <span className="font-medium">${(item._sum.revenue || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">展示:</span>
                        <span>{(item._sum.impressions || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">点击率:</span>
                        <span>{((item._avg.ctr || 0) * 100).toFixed(2)}%</span>
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
              <LineChart data={data.hourlyPattern}>
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
                    data={data.geoAnalysis.reduce((acc: any[], item: any) => {
                      const existing = acc.find(a => a.country === item.country)
                      if (existing) {
                        existing.totalRevenue += (item._sum.revenue || 0)
                        existing.totalImpressions += (item._sum.impressions || 0)
                      } else {
                        acc.push({
                          country: item.country,
                          totalRevenue: (item._sum.revenue || 0),
                          totalImpressions: (item._sum.impressions || 0),
                          avgEcpm: (item._avg.ecpm || 0)
                        })
                      }
                      return acc
                    }, [])}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ country, totalRevenue }) => `${country}: $${totalRevenue.toFixed(1)}`}
                    outerRadius={120}
                    fill="#8884d8"
                    dataKey="totalRevenue"
                  >
                    {data.geoAnalysis.map((entry: any, index: number) => (
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
                {data.topCombinations.map((item: any, index: number) => (
                  <div key={index} className="border rounded-lg p-3 bg-gradient-to-r from-green-50 to-blue-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{item.country}</h4>
                        <p className="text-sm text-gray-600">{item.device} · {item.ad_format}</p>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                        ${item.avg_ecpm.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-500">
                      <span>总收入: ${item.total_revenue.toFixed(2)}</span>
                      <span>出现次数: {item.occurrences}</span>
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
                  {data.adUnitAnalysis.map((item: any, index: number) => (
                    <tr key={index}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.adFormat}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{item.adUnit}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${(item._avg.ecpm || 0).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{((item._avg.fillRate || 0) * 100).toFixed(1)}%</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {item._avg.ecpm > 10 ? (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">优先投放</span>
                        ) : item._avg.fillRate < 30 ? (
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
              <BarChart data={data.viewabilityAnalysis}>
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