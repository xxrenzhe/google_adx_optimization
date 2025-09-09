'use client'

import { useState, useEffect } from 'react'
import { useFileSession } from '@/contexts/file-session'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts'

interface PredictiveAnalyticsProps {
  refreshTrigger?: number;
  fileId: string | null;
  cachedData?: any;
}

export default function PredictiveAnalytics({ refreshTrigger, fileId, cachedData }: PredictiveAnalyticsProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDays, setSelectedDays] = useState(30)

  useEffect(() => {
    // 如果有缓存数据，直接使用
    if (cachedData) {
      setData(cachedData)
      setLoading(false)
      return
    }
    
    fetchPredictiveData()
  }, [refreshTrigger, selectedDays, fileId, cachedData])

  const fetchPredictiveData = async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.append('days', selectedDays.toString())
      if (fileId) params.append('fileId', fileId)
      
      const response = await fetch(`/api/predictive-analytics?${params}`)
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch predictive analytics')
      }
      
      const predictiveData = await response.json()
      setData(predictiveData)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unknown error')
      console.error('Error fetching predictive analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  // 如果没有选择文件，显示提示
  if (!fileId) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">预测分析</h2>
        <div className="text-center py-8">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">请先上传数据文件</h3>
          <p className="text-gray-600 mb-6">上传CSV文件后，系统将基于该文件进行预测分析</p>
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
      </div>
    )
  }

  if (loading) {
    return <div className="p-8 text-center">加载预测分析数据...</div>
  }

  if (error) {
    // Check if the error is due to no data uploaded
    if (error.includes('No data uploaded yet')) {
      return (
        <div className="p-12 text-center">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无预测分析数据</h3>
          <p className="text-gray-600 mb-6">请先上传CSV文件以查看预测分析</p>
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
    <div className="space-y-6">
      {/* Controls */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-900">预测分析与自动化</h2>
          <select
            value={selectedDays}
            onChange={(e) => setSelectedDays(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={7}>最近7天</option>
            <option value={30}>最近30天</option>
            <option value={90}>最近90天</option>
          </select>
        </div>
      </div>

      {/* Revenue Prediction */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">收入预测（未来7天）</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-blue-600">预测平均日收入</p>
            <p className="text-2xl font-bold text-blue-900">
              ${(data.predictions.reduce((sum: number, p: any) => sum + p.predicted, 0) / 7).toFixed(2)}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <p className="text-sm text-green-600">模型准确度</p>
            <p className="text-2xl font-bold text-green-900">
              {(data.modelAccuracy * 100).toFixed(1)}%
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <p className="text-sm text-purple-600">预测趋势</p>
            <p className="text-2xl font-bold text-purple-900">
              {data.predictions[data.predictions.length - 1].predicted > data.predictions[0].predicted ? '↗️ 上升' : '↘️ 下降'}
            </p>
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data.predictions}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name === 'predicted' ? '预测收入' : '实际收入']} />
            <Legend />
            <Area type="monotone" dataKey="predicted" stroke="#8884d8" fill="#8884d8" fillOpacity={0.6} name="预测收入" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Anomalies */}
      {data.anomalies && data.anomalies.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">异常检测</h3>
          <div className="space-y-3">
            {data.anomalies.map((anomaly: any, index: number) => (
              <div key={index} className={`border-l-4 p-4 ${
                anomaly.severity === 'HIGH' ? 'border-red-400 bg-red-50' : 'border-yellow-400 bg-yellow-50'
              }`}>
                <div className="flex justify-between">
                  <div>
                    <h4 className="font-medium">{anomaly.date}</h4>
                    <p className="text-sm text-gray-600">
                      实际收入: ${anomaly.actual.toFixed(2)} | 预期: ${anomaly.expected.toFixed(2)}
                    </p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    anomaly.severity === 'HIGH' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {anomaly.severity === 'HIGH' ? '严重异常' : '中度异常'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day of Week Analysis */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">周模式分析</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.dayOfWeekAnalysis.map((d: any, i: number) => ({
            ...d,
            day: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][i]
          }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="avg_revenue" fill="#8884d8" name="平均收入" />
            <Bar dataKey="avg_ecpm" fill="#82ca9d" name="平均eCPM" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Growth Opportunities */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">增长机会</h3>
        <div className="space-y-4">
          {data.opportunities?.slice(0, 5).map((opp: any, index: number) => (
            <div key={index} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-medium text-gray-900">{opp.country} - {opp.device}</h4>
                  <p className="text-sm text-gray-600">
                    当前eCPM: ${opp.current_ecpm.toFixed(2)} | 填充率: {(opp.current_fill_rate * 100).toFixed(1)}%
                  </p>
                </div>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  opp.opportunity_score === 'HIGH' ? 'bg-red-100 text-red-800' :
                  opp.opportunity_score === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-green-100 text-green-800'
                }`}>
                  {opp.opportunity_score === 'HIGH' ? '高机会' : opp.opportunity_score === 'MEDIUM' ? '中机会' : '低机会'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-500">
                  潜在收入增长: <span className="font-medium text-green-600">${opp.potential_revenue_increase.toFixed(2)}</span>
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Competitor Intelligence */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">竞争对手分析</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">广告客户</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">域名</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">市场覆盖</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">出价强度</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">策略类型</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.competitorInsights?.slice(0, 10).map((competitor: any, index: number) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{competitor.advertiser}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{competitor.domain || '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {competitor.market_penetration > 0 ? `${competitor.market_penetration} 个国家` : '无数据'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${competitor.avg_bid_strength.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      competitor.strategy_type === 'AGGRESSIVE' ? 'bg-red-100 text-red-800' :
                      competitor.strategy_type === 'COMPETITIVE' ? 'bg-yellow-100 text-yellow-800' :
                      competitor.strategy_type === 'MODERATE' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {competitor.strategy_type}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}