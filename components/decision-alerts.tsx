'use client'

import { useState, useEffect } from 'react'
import { useFileSession } from '@/contexts/file-session'

interface AlertData {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  data?: Record<string, unknown>
  timestamp: string
}

interface AlertData {
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message: string
  data?: Record<string, unknown>
  timestamp: string
}

interface Alert {
  id: string
  type: 'warning' | 'success' | 'error' | 'info'
  title: string
  message: string
  data?: any
}

interface Recommendation {
  id: string
  type: 'website' | 'country' | 'device' | 'format' | 'combination' | 'competitive' | 'predictive' | 'timing' | 'pricing'
  title: string
  message: string
  impact: 'high' | 'medium' | 'low'
  data: any
}

interface DecisionAlertsProps {
  refreshTrigger?: number;
  fileId: string | null;
}

export default function DecisionAlerts({ refreshTrigger, fileId }: DecisionAlertsProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [recommendations, setRecommendations] = useState<Recommendation[]>([])
  const [enhancedRecommendations, setEnhancedRecommendations] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAlertsAndRecommendations()
  }, [refreshTrigger, fileId])

  const fetchAlertsAndRecommendations = async () => {
    setLoading(true)
    try {
      // Fetch alerts and recommendations
      const alertsParams = new URLSearchParams()
      if (fileId) alertsParams.append('fileId', fileId)
      
      const alertsResponse = await fetch(`/api/alerts?${alertsParams}`)
      if (!alertsResponse.ok) throw new Error('Failed to fetch alerts')
      
      const alertsData = await alertsResponse.json()
      setAlerts(alertsData.alerts || [])
      setRecommendations(alertsData.recommendations || [])
      
      // Fetch enhanced analytics and integrate its recommendations
      const enhancedParams = new URLSearchParams()
      if (fileId) enhancedParams.append('fileId', fileId)
      
      const enhancedResponse = await fetch(`/api/analytics-enhanced?${enhancedParams}`)
      if (enhancedResponse.ok) {
        const enhancedData = await enhancedResponse.json()
        setEnhancedRecommendations(enhancedData)
        
        // Convert only important enhanced analytics recommendations to the same format
        const enhancedRecs: Recommendation[] = []
        
        // Add only important ad unit analysis recommendations (high impact only)
        if (enhancedData.adUnitAnalysis) {
          enhancedData.adUnitAnalysis.forEach((item: any, index: number) => {
            // Only include high impact recommendations
            if (item._avg.ecpm > 15 || item._avg.fillRate < 20) {
              let impact: 'high' | 'medium' | 'low' = 'high'
              let message = ''
              
              if (item._avg.ecpm > 15) {
                message = `高价值广告单元：${item.adUnit}（eCPM: $${item._avg.ecpm.toFixed(2)}），强烈建议优先投放`
              } else if (item._avg.fillRate < 20) {
                message = `低填充率警告：${item.adUnit}填充率仅${((item._avg.fillRate || 0) * 100).toFixed(1)}%，急需优化`
              }
              
              enhancedRecs.push({
                id: `adunit-${index}`,
                type: 'format',
                title: `${item.adFormat} - ${item.adUnit}`,
                message,
                impact,
                data: {
                  adFormat: item.adFormat,
                  adUnit: item.adUnit,
                  avgEcpm: item._avg.ecpm || 0,
                  fillRate: item._avg.fillRate || 0,
                  recommendation: item._avg.ecpm > 15 ? '优先投放' : '需要优化'
                }
              })
            }
          })
        }
        
        // Add only critical viewability issues
        if (enhancedData.viewabilityAnalysis) {
          enhancedData.viewabilityAnalysis.forEach((item: any, index: number) => {
            const viewabilityRate = (item._avg.viewabilityRate || 0) * 100
            // Only include severe viewability issues
            if (viewabilityRate < 25 && item._avg.ecpm > 5) {
              enhancedRecs.push({
                id: `viewability-${index}`,
                type: 'format',
                title: `${item.adFormat} 可见度异常`,
                message: `${item.adFormat}可见度过低（${viewabilityRate.toFixed(1)}%）但eCPM较高（$${item._avg.ecpm.toFixed(2)}），建议优化广告位置`,
                impact: 'high',
                data: {
                  adFormat: item.adFormat,
                  viewabilityRate: viewabilityRate,
                  ecpm: item._avg.ecpm || 0,
                  recommendation: '优化位置'
                }
              })
            }
          })
        }
        
        // Combine original recommendations with enhanced ones
        setRecommendations(prev => [...prev, ...enhancedRecs])
      }
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
      case 'info':
        return '📊'
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
      case 'info':
        return 'border-blue-400 bg-blue-50'
      default:
        return 'border-gray-400 bg-gray-50'
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

  const getRecommendationIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'website':
        return '🌐'
      case 'country':
        return '🌍'
      case 'device':
        return '📱'
      case 'format':
        return '📊'
      case 'combination':
        return '🔗'
      case 'competitive':
        return '🎯'
      case 'predictive':
        return '🔮'
      case 'timing':
        return '⏰'
      case 'pricing':
        return '💰'
      default:
        return '💡'
    }
  }

  // 如果没有选择文件，显示提示
  if (!fileId) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">决策提醒</h2>
        <div className="text-center py-8">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">请先上传数据文件</h3>
          <p className="text-gray-600 mb-6">上传CSV文件后，系统将基于该文件提供决策提醒</p>
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
            {(alerts as AlertData[]).map((alert) => (
              <div
                key={(alert as AlertData).id}
                className={`border-l-4 p-4 ${getAlertColor((alert as AlertData).type)}`}
              >
                <div className="flex items-start">
                  <span className="text-xl mr-3">{getAlertIcon((alert as AlertData).type)}</span>
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{(alert as AlertData).title}</h3>
                    <p className="text-sm text-gray-600 mt-1">{(alert as AlertData).message}</p>
                    {(alert as AlertData).data && (
                      <div className="mt-2 text-xs text-gray-500">
                        详情: {JSON.stringify((alert as AlertData).data)}
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
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">{getRecommendationIcon(rec.type)}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-gray-900">{rec.title}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getImpactColor(rec.impact)}`}>
                            {rec.impact === 'high' ? '高影响' : rec.impact === 'medium' ? '中影响' : '低影响'}
                          </span>
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                            {rec.type === 'combination' ? '组合分析' :
                             rec.type === 'competitive' ? '竞争情报' :
                             rec.type === 'predictive' ? '预测分析' :
                             rec.type === 'timing' ? '时段分析' :
                             rec.type === 'pricing' ? '定价策略' :
                             rec.type === 'website' ? '网站' :
                             rec.type === 'country' ? '国家' :
                             rec.type === 'device' ? '设备' :
                             rec.type === 'format' ? '格式' : '其他'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 ml-9">{rec.message}</p>
                    {rec.data && (
                      <div className="mt-3 bg-gray-50 rounded p-3 text-sm ml-9">
                        <div className="space-y-2">
                          {(() => {
                            // 特殊处理不同类型的数据
                            if (rec.type === 'website' && rec.data.best && rec.data.worst) {
                              return (
                                <>
                                  <div className="flex items-start">
                                    <span className="text-gray-600 mr-2 min-w-[80px]">最佳网站:</span>
                                    <span className="font-medium text-gray-900">
                                      {rec.data.best.name} (eCPM: ¥{rec.data.best.ecpm?.toFixed(2)})
                                    </span>
                                  </div>
                                  <div className="flex items-start">
                                    <span className="text-gray-600 mr-2 min-w-[80px]">待优化网站:</span>
                                    <span className="font-medium text-gray-900">
                                      {rec.data.worst.name} (eCPM: ¥{rec.data.worst.ecpm?.toFixed(2)})
                                    </span>
                                  </div>
                                </>
                              )
                            }
                            
                            // 默认处理方式
                            return Object.entries(rec.data)
                              .filter(([key, value]) => 
                                // 过滤掉嵌套对象，避免重复显示
                                !['best', 'worst'].includes(key) && 
                                typeof value !== 'object' || value === null
                              )
                              .map(([key, value]) => (
                                <div key={key} className="flex items-start">
                                  <span className="text-gray-600 mr-2 min-w-[80px]">
                                    {key === 'adFormat' ? '广告格式' :
                                     key === 'adUnit' ? '广告单元' :
                                     key === 'avgEcpm' ? '平均eCPM' :
                                     key === 'fillRate' ? '填充率' :
                                     key === 'viewabilityRate' ? '可见率' :
                                     key === 'ctr' ? '点击率' :
                                     key === 'revenue' ? '收入' :
                                     key === 'impressions' ? '展示数' :
                                     key === 'clicks' ? '点击数' :
                                     key === 'requests' ? '请求数' :
                                     key === 'recommendation' ? '建议' :
                                     key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}:
                                  </span>
                                  <span className="font-medium text-gray-900">
                                    {typeof value === 'number' ? 
                                      (key.includes('revenue') || key.includes('ecpm') || key === 'avgEcpm' ? `$${value.toFixed(2)}` :
                                       key === 'ctr' ? `${(value * 100).toFixed(2)}%` :
                                       key.includes('rate') || key.includes('ratio') || key === 'fillRate' || key === 'viewabilityRate' ? `${(value * 100).toFixed(1)}%` :
                                       key.includes('percentage') ? `${value.toFixed(1)}%` :
                                       value.toLocaleString()) :
                                      Array.isArray(value) ? value.join(', ') :
                                      String(value)}
                                  </span>
                                </div>
                              ))
                          })()}
                        </div>
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