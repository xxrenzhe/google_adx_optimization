'use client'

import { useState, useEffect } from 'react'

interface AutomationRule {
  id: string
  name: string
  description: string
  enabled: boolean
  lastTriggered?: string
  triggered: boolean
  recommendation?: string
}

interface AutomationDashboardProps {
  refreshTrigger?: number
}

export default function AutomationDashboard({ refreshTrigger }: AutomationDashboardProps) {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [actions, setActions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)

  useEffect(() => {
    fetchAutomationStatus()
  }, [refreshTrigger])

  const fetchAutomationStatus = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/automation-engine')
      if (!response.ok) throw new Error('Failed to fetch automation status')
      
      const data = await response.json()
      setRules(data.rules.map((r: any) => ({
        id: r.rule.id,
        name: r.rule.name,
        description: r.rule.condition,
        enabled: r.rule.enabled,
        triggered: r.triggered,
        recommendation: r.recommendation,
        lastTriggered: r.rule.lastTriggered
      })))
      setActions(data.actions)
    } catch (error) {
      console.error('Error fetching automation status:', error)
    } finally {
      setLoading(false)
    }
  }

  const executeAction = async (ruleId: string, action: string) => {
    setExecuting(ruleId)
    try {
      const response = await fetch('/api/automation-engine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ruleId,
          action,
          parameters: {}
        })
      })
      
      if (response.ok) {
        await fetchAutomationStatus()
      }
    } catch (error) {
      console.error('Error executing action:', error)
    } finally {
      setExecuting(null)
    }
  }

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      // This would update the rule in the database
      console.log(`Toggling rule ${ruleId} to ${enabled}`)
      await fetchAutomationStatus()
    } catch (error) {
      console.error('Error toggling rule:', error)
    }
  }

  if (loading) {
    return <div className="p-8 text-center">加载自动化状态...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gray-900">自动化规则引擎</h2>
            <p className="text-sm text-gray-600">智能优化和自动执行</p>
          </div>
          <button
            onClick={fetchAutomationStatus}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            刷新状态
          </button>
        </div>
      </div>

      {/* Active Actions */}
      {actions.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-lg font-medium mb-4">待执行操作</h3>
          <div className="space-y-3">
            {actions.map((action, index) => (
              <div key={index} className="border rounded-lg p-4 bg-yellow-50 border-yellow-200">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium text-gray-900">{action.ruleName}</h4>
                    <p className="text-sm text-gray-600 mt-1">{action.recommendation}</p>
                    <p className="text-xs text-gray-500 mt-2">预计影响: {action.estimatedImpact}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      action.priority === 'HIGH' ? 'bg-red-100 text-red-800' :
                      action.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {action.priority === 'HIGH' ? '高优先级' : action.priority === 'MEDIUM' ? '中优先级' : '低优先级'}
                    </span>
                    <button
                      onClick={() => executeAction(action.ruleId, action.action)}
                      disabled={executing === action.ruleId}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {executing === action.ruleId ? '执行中...' : '立即执行'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Automation Rules */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">自动化规则</h3>
        <div className="space-y-4">
          {rules.map((rule) => (
            <div key={rule.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-medium text-gray-900">{rule.name}</h4>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rule.enabled ? '已启用' : '已禁用'}
                    </span>
                    {rule.triggered && (
                      <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded-full animate-pulse">
                        已触发
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{rule.description}</p>
                  {rule.triggered && rule.recommendation && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-md">
                      <p className="text-sm text-blue-800">
                        <strong>建议:</strong> {rule.recommendation}
                      </p>
                    </div>
                  )}
                  {rule.lastTriggered && (
                    <p className="text-xs text-gray-500 mt-2">
                      上次触发: {new Date(rule.lastTriggered).toLocaleString('zh-CN')}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => toggleRule(rule.id, !rule.enabled)}
                    className={`px-3 py-1 text-sm rounded ${
                      rule.enabled 
                        ? 'bg-gray-200 text-gray-800 hover:bg-gray-300' 
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    {rule.enabled ? '禁用' : '启用'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">活跃规则</p>
              <p className="text-2xl font-bold text-gray-900">
                {rules.filter(r => r.enabled).length}
              </p>
            </div>
            <div className="p-3 bg-green-100 rounded-full">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">待执行操作</p>
              <p className="text-2xl font-bold text-gray-900">{actions.length}</p>
            </div>
            <div className="p-3 bg-yellow-100 rounded-full">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">已触发规则</p>
              <p className="text-2xl font-bold text-gray-900">
                {rules.filter(r => r.triggered).length}
              </p>
            </div>
            <div className="p-3 bg-red-100 rounded-full">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Automation Log */}
      <div className="bg-white shadow rounded-lg p-6">
        <h3 className="text-lg font-medium mb-4">自动化日志</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {actions.length > 0 ? (
            actions.map((action, index) => (
              <div key={index} className="text-sm text-gray-600 p-3 bg-gray-50 rounded">
                <p>{new Date().toLocaleString('zh-CN')} - 规则"{action.ruleName}"触发，建议执行操作：{action.action}</p>
              </div>
            ))
          ) : (
            <div className="text-sm text-gray-500 p-3 bg-gray-50 rounded text-center">
              <p>暂无自动化活动记录</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}