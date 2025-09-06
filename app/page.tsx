'use client'

import { useState } from 'react'
import Upload from '@/components/upload-native'
import DataTable from '@/components/data-table'
import Analytics from '@/components/analytics'
import DecisionAlerts from '@/components/decision-alerts'

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [activeTab, setActiveTab] = useState<'upload' | 'data' | 'analytics' | 'alerts'>('upload')

  const handleUploadComplete = () => {
    setRefreshTrigger(prev => prev + 1)
    setActiveTab('data')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Google ADX Optimization</h1>
              <p className="text-sm text-gray-600">Upload your CSV data to optimize ad revenue</p>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'upload' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('upload')}
            >
              Upload Data
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'data' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('data')}
            >
              Data Table
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'analytics' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('analytics')}
            >
              Analytics
            </button>
            <button
              className={`py-4 px-1 border-b-2 font-medium text-sm ${activeTab === 'alerts' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
              onClick={() => setActiveTab('alerts')}
            >
              决策提醒
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div className="bg-white shadow rounded-lg p-6">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Upload CSV File</h2>
                <Upload onUploadComplete={handleUploadComplete} />
              </div>
              
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">CSV Format Requirements</h3>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>• File must be in CSV format</p>
                  <p>• Maximum file size: 50MB</p>
                  <p>• Required columns: Date, Website</p>
                  <p>• Optional columns: Country, Device, Ad Format, Requests, Impressions, Clicks, Revenue, etc.</p>
                </div>
              </div>
            </div>
          )}
          
          {activeTab === 'data' && (
            <div className="bg-white shadow rounded-lg p-6">
              <DataTable refreshTrigger={refreshTrigger} />
            </div>
          )}
          
          {activeTab === 'analytics' && (
            <Analytics />
          )}
          
          {activeTab === 'alerts' && (
            <DecisionAlerts refreshTrigger={refreshTrigger} />
          )}
        </div>
      </main>
    </div>
  )
}