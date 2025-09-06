'use client'

import { useState, useEffect } from 'react'
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
  refreshTrigger?: number
}

export default function PredictiveAnalytics({ refreshTrigger }: PredictiveAnalyticsProps) {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDays, setSelectedDays] = useState(30)

  useEffect(() => {
    fetchPredictiveData()
  }, [refreshTrigger, selectedDays])

  const fetchPredictiveData = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/predictive-analytics?days=${selectedDays}`)
      if (!response.ok) throw new Error('Failed to fetch predictive analytics')
      
      const predictiveData = await response.json()
      setData(predictiveData)
    } catch (error) {
      console.error('Error fetching predictive analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">加载预测分析数据...</div>
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{competitor.market_penetration} 个国家</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${competitor.avg_bid_strength.toFixed(2)}</td>
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