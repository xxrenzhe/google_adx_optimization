'use client'

import { useState, useEffect } from 'react'

export default function TestApiPage() {
  const [fileId, setFileId] = useState('')
  const [result, setResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const testApi = async () => {
    console.log('[TEST-API] ===== testApi called =====')
    console.log('[TEST-API] fileId:', fileId)
    console.log('[TEST-API] fileId type:', typeof fileId)
    console.log('[TEST-API] fileId length:', fileId?.length)
    
    if (!fileId || fileId.trim() === '') {
      console.log('[TEST-API] No fileId provided or empty')
      setError('请输入 File ID')
      return
    }
    
    setLoading(true)
    setError('')
    try {
      const url = `/api/result/${fileId.trim()}`
      console.log('[TEST-API] Fetching from:', url)
      
      const response = await fetch(url)
      console.log('[TEST-API] Response status:', response.status)
      console.log('[TEST-API] Response ok:', response.ok)
      
      if (!response.ok) {
        const errorText = await response.text()
        console.log('[TEST-API] Error response:', errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }
      
      const data = await response.json()
      console.log('[TEST-API] Response data:', data)
      setResult(data)
    } catch (err) {
      console.error('[TEST-API] Error:', err)
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  // 清理 localStorage 的函数
  const clearLocalStorage = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('upload-optimized-files')
      localStorage.removeItem('upload-optimized-active-file')
      localStorage.removeItem('upload-optimized-analysis')
      alert('LocalStorage 已清理')
    }
  }

  // 测试基本连接
  const testConnection = async () => {
    try {
      console.log('[TEST-API] Testing basic connection...')
      const response = await fetch('/api/analytics')
      console.log('[TEST-API] Analytics endpoint status:', response.status)
      
      if (response.ok) {
        const data = await response.json()
        console.log('[TEST-API] Analytics response:', data)
        alert('API 连接正常！')
      } else {
        alert(`API 返回错误: ${response.status}`)
      }
    } catch (err) {
      console.error('[TEST-API] Connection test failed:', err)
      alert(`连接失败: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">API 测试页面</h1>
        
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4 mb-4">
            <input
              type="text"
              value={fileId}
              onChange={(e) => {
                const value = e.target.value
                setFileId(value)
                console.log('[TEST-API] Input changed:', value)
              }}
              placeholder="输入 File ID (例如: 413dc324-4eda-4b3f-8115-eb65988ae0f9)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={(e) => {
                e.preventDefault()
                console.log('[TEST-API] ===== Button clicked =====')
                console.log('[TEST-API] Event type:', e.type)
                console.log('[TEST-API] Button disabled:', loading || !fileId)
                console.log('[TEST-API] Loading state:', loading)
                console.log('[TEST-API] FileId value:', fileId)
                console.log('[TEST-API] FileId truthy:', !!fileId)
                console.log('[TEST-API] FileId trimmed:', fileId?.trim())
                console.log('[TEST-API] Should be disabled:', loading || !fileId?.trim())
                
                // 检查是否有 JavaScript 错误
                try {
                  testApi()
                } catch (err) {
                  console.error('[TEST-API] Error calling testApi:', err)
                }
              }}
              disabled={loading || !fileId?.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {loading ? '测试中...' : '测试 API'}
            </button>
            <button
              onClick={clearLocalStorage}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              清理 LocalStorage
            </button>
            <button
              onClick={testConnection}
              className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              测试连接
            </button>
          </div>
          
          {error && (
            <div className="text-red-600 mb-4 p-3 bg-red-50 rounded-md">
              错误: {error}
            </div>
          )}
          
          {result && (
            <div className="mt-4">
              <h3 className="text-lg font-medium mb-2">API 响应:</h3>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm max-h-96">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
        
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium mb-2">使用说明:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600">
            <li>上传一个 CSV 文件</li>
            <li>从浏览器控制台中复制 File ID（查找 "[DEBUG] Starting polling for fileId:"）</li>
            <li>将 File ID 粘贴到输入框中</li>
            <li>点击"测试 API"查看响应</li>
            <li>如果遇到状态问题，可以点击"清理 LocalStorage"</li>
          </ol>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mt-6">
          <h3 className="text-lg font-medium mb-2">调试信息:</h3>
          <div className="space-y-2 text-sm">
            <p>当前 File ID: {fileId || '无'}</p>
            <p>加载状态: {loading ? '是' : '否'}</p>
            <p>错误信息: {error || '无'}</p>
          </div>
        </div>
      </div>
    </div>
  )
}