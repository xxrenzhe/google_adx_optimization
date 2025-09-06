'use client'

import { useState, useEffect } from 'react'

interface Alert {
  id: string
  type: 'warning' | 'success' | 'error'
  title: string
  message: string
  data?: any
}

interface Recommendation {
  id: string
  type: 'website' | 'country' | 'device' | 'format'
  title: string
  message: string
  impact: 'high' | 'medium' | 'low'
  data: any
}

interface DecisionAlertsProps {
  refreshTrigger?: number
}

export default function DecisionAlerts({ refreshTrigger }: DecisionAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAlertsAndRecommendations()
  }, [refreshTrigger])

  const fetchAlertsAndRecommendations = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/alerts')
      if (!response.ok) throw new Error('Failed to fetch alerts')
      
      const data = await response.json()
      setAlerts(data.alerts || [])
      setRecommendations(data.recommendations || [])
    } catch (error) {
      console.error('Error fetching alerts:', error)
    } finally {
      setLoading(false)
    }
  }

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'warning':
        return '⚠️'
      case 'error':
        return '❌'
      case 'success':
        return '✅'
      default:
        return 'ℹ️'
    }
  }

  const getAlertColor = (type: Alert['type']) => {
    switch (type) {
      case 'warning':
        return 'border-yellow-400 bg-yellow-50'
      case 'error':
        return 'border-red-400 bg-red-50'
      case 'success':
        return 'border-green-400 bg-green-50'
      default:
        return 'border-blue-400 bg-blue-50'
    }
  }

  const getImpactColor = (impact: Recommendation['impact']) => {
    switch (impact) {
      case 'high':
        return 'bg-red-100 text-red-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'low':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">决策提醒</h2>
        <div className="text-center py-8">加载中...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Alerts Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">⚡ 实时提醒</h2>
        
        {alerts.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无异常提醒，系统运行正常
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className={`border-l-4 p-4 ${getAlertColor(alert.type)}`}
              >
                <div className="flex items-start">
                  <span className="text-xl mr-3">{getAlertIcon(alert.type)}</span>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{alert.title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{alert.message}</p>
                    {alert.data && (
                      <div className="mt-2 text-xs text-gray-500">
                        详情: {JSON.stringify(alert.data)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recommendations Section */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">💡 优化建议</h2>
        
        {recommendations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            暂无优化建议，继续保持当前策略
          </div>
        ) : (
          <div className="space-y-4">
            {recommendations.map((rec) => (
              <div key={rec.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-medium text-gray-900">{rec.title}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getImpactColor(rec.impact)}`}>
                        {rec.impact === 'high' ? '高影响' : rec.impact === 'medium' ? '中影响' : '低影响'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{rec.message}</p>
                    {rec.data && (
                      <div className="mt-3 bg-gray-50 rounded p-3 text-sm">
                        <pre className="text-gray-700">{JSON.stringify(rec.data, null, 2)}</pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}