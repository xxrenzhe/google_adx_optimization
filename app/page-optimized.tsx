'use client';

import { useState } from 'react';
import UploadOptimized from '@/components/upload-optimized';
import DataTable from '@/components/data-table';
import Analytics from '@/components/analytics';
import DecisionAlerts from '@/components/decision-alerts';
import EnhancedAnalytics from '@/components/enhanced-analytics';
import PredictiveAnalytics from '@/components/predictive-analytics';
import AutomationDashboard from '@/components/automation-dashboard';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'upload' | 'analytics' | 'alerts' | 'enhanced' | 'predictive' | 'automation'>('upload');

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleDataCleared = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Google ADX 优化系统</h1>
              <p className="text-sm text-gray-600">上传CSV数据以优化广告收入 (支持50万行数据)</p>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'upload' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('upload')}
            >
              上传数据
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'analytics' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('analytics')}
            >
              数据分析
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'enhanced' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('enhanced')}
            >
              高级分析
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'alerts' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('alerts')}
            >
              决策提醒
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'predictive' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('predictive')}
            >
              预测分析
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'automation' ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
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
              <UploadOptimized />
            </div>
          )}
          
          {activeTab === 'analytics' && (
            <Analytics />
          )}
          
          {activeTab === 'enhanced' && (
            <EnhancedAnalytics />
          )}
          
          {activeTab === 'alerts' && (
            <DecisionAlerts refreshTrigger={refreshTrigger} />
          )}
          
          {activeTab === 'predictive' && (
            <PredictiveAnalytics refreshTrigger={refreshTrigger} />
          )}
          
          {activeTab === 'automation' && (
            <AutomationDashboard refreshTrigger={refreshTrigger} />
          )}
        </div>
      </main>
    </div>
  );
}