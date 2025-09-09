'use client'

import { useState, useEffect } from 'react'
import EnhancedAnalytics from '@/components/enhanced-analytics'

export default function TestEnhancedAnalytics() {
  const [fileId, setFileId] = useState<string | null>('3111174a-1310-4145-b0e5-a892ff3ec686')
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <h1 className="text-2xl font-bold mb-4">Test Enhanced Analytics</h1>
      <div className="mb-4">
        <button 
          onClick={() => setFileId('3111174a-1310-4145-b0e5-a892ff3ec686')}
          className="mr-2 px-4 py-2 bg-blue-500 text-white rounded"
        >
          Set Test File ID
        </button>
        <button 
          onClick={() => setFileId(null)}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Clear File ID
        </button>
      </div>
      <div className="mb-4">
        <p>Current File ID: {fileId || 'None'}</p>
      </div>
      <div className="bg-white rounded-lg shadow p-6">
        <EnhancedAnalytics fileId={fileId} />
      </div>
    </div>
  )
}