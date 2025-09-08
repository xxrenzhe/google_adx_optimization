'use client'

import { useState, useEffect } from 'react'
import UploadOptimized from '@/components/upload-optimized'
import Analytics from '@/components/analytics'
import DecisionAlerts from '@/components/decision-alerts'
import EnhancedAnalytics from '@/components/enhanced-analytics'
import PredictiveAnalytics from '@/components/predictive-analytics'
import AutomationDashboard from '@/components/automation-dashboard'

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activeTab, setActiveTab] = useState<'upload' | 'analytics' | 'alerts' | 'enhanced' | 'predictive' | 'automation'>('upload')
  
  // 从URL参数获取fileId
  const [fileId, setFileId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('fileId');
    }
    return null;
  });

  // 处理页面刷新 - 清除fileId
  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const navEntries = performance.getEntriesByType('navigation');
    const isReload = navEntries.length > 0 && 
      (navEntries[0] as PerformanceNavigationTiming).type === 'reload';
    
    if (isReload && fileId) {
      // 清除URL参数
      setFileId(null);
      const url = new URL(window.location);
      url.searchParams.delete('fileId');
      window.history.replaceState({}, '', url);
    }
  }, [fileId]);

  // 处理文件上传完成
  const handleFileUploaded = (newFileId: string) => {
    setFileId(newFileId);
    // 更新URL但不刷新页面
    if (typeof window !== 'undefined') {
      const url = new URL(window.location);
      url.searchParams.set('fileId', newFileId);
      window.history.pushState({}, '', url);
    }
  };

  // 清除文件
  const handleClearFile = () => {
    setFileId(null);
    // 清除URL参数
    if (typeof window !== 'undefined') {
      const url = new URL(window.location);
      url.searchParams.delete('fileId');
      window.history.replaceState({}, '', url);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <header className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Google ADX 优化系统</h1>
                <p className="text-sm text-gray-600">上传CSV数据以优化广告收入</p>
              </div>
            </div>
          </div>
        </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'upload' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('upload')}
            >
              上传数据
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'analytics' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('analytics')}
            >
              数据分析
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'enhanced' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('enhanced')}
            >
              高级分析
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'alerts' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('alerts')}
            >
              决策提醒
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'predictive' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('predictive')}
            >
              预测分析
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'automation' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('automation')}
            >
              自动化
            </button>
            </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {activeTab === 'upload' && (
            <div className="space-y-6">
              {/* Upload Component */}
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">上传CSV文件</h2>
                <UploadOptimized 
                  fileId={fileId}
                  onFileUploaded={handleFileUploaded}
                  onClearFile={handleClearFile}
                />
              </div>
              
                
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">CSV格式要求</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• 文件必须为CSV格式</p>
                  <p>• 最大文件大小：200MB（支持50万行数据）</p>
                  <p>• 必需列：日期(Date)、网站(Website)</p>
                  <p>• 可选列：国家(Country)、设备(Device)、广告格式(Ad Format)、请求数(Requests)、展示数(Impressions)、点击数(Clicks)、收入(Revenue)等</p>
                  <p>• 独立分析每个上传文件，不读取历史数据</p>
                </div>
              </div>
            </div>
          )}
          
          
          {activeTab === 'analytics' && (
            <Analytics fileId={fileId} />
          )}
          
          {activeTab === 'enhanced' && (
            <EnhancedAnalytics fileId={fileId} />
          )}
          
          {activeTab === 'alerts' && (
            <DecisionAlerts refreshTrigger={refreshTrigger} fileId={fileId} />
          )}
          
          {activeTab === 'predictive' && (
            <PredictiveAnalytics refreshTrigger={refreshTrigger} fileId={fileId} />
          )}
          
          {activeTab === 'automation' && (
            <AutomationDashboard refreshTrigger={refreshTrigger} fileId={fileId} />
          )}
        </div>
      </main>
    </div>
  )
}