'use client'

import { useState, useEffect } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'

interface AnalyticsProps {
  filters?: {
    startDate?: string
    endDate?: string
  }
}

interface AnalyticsData {
  summary: {
    totalRevenue: number
    totalImpressions: number
    totalRequests: number
    avgFillRate: number
    arpu: number
  }
  charts: {
    revenueByDate: { date: string; revenue: number }[]
    revenueByCountry: { country: string; revenue: number }[]
    revenueByDevice: { device: string; revenue: number }[]
    fillRateDistribution: { range: string; count: number }[]
  }
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export default function Analytics({ filters }: AnalyticsProps) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    fetchAnalytics()
  }, [filters])
  
  const fetchAnalytics = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const params = new URLSearchParams()
      if (filters?.startDate) params.append('startDate', filters.startDate)
      if (filters?.endDate) params.append('endDate', filters.endDate)
      
      const response = await fetch(`/api/analytics?${params}`)
      if (!response.ok) throw new Error('Failed to fetch analytics')
      
      const analyticsData = await response.json()
      setData(analyticsData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }
  
  if (loading) return <div className="p-8">Loading analytics...</div>
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>
  if (!data) return null
  
  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
          <p className="text-2xl font-bold">
            ${data.summary.totalRevenue.toFixed(2)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Impressions</h3>
          <p className="text-2xl font-bold">
            {data.summary.totalImpressions.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Requests</h3>
          <p className="text-2xl font-bold">
            {data.summary.totalRequests.toLocaleString()}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">Fill Rate</h3>
          <p className="text-2xl font-bold">
            {data.summary.avgFillRate.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-sm font-medium text-gray-500">ARPU</h3>
          <p className="text-2xl font-bold">
            ${data.summary.arpu.toFixed(4)}
          </p>
        </div>
      </div>
      
      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Revenue Trend */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Revenue Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.charts.revenueByDate}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
              <Line type="monotone" dataKey="revenue" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        
        {/* Revenue by Country */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Revenue by Country</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.charts.revenueByCountry}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ country, revenue }) => `${country}: $${revenue.toFixed(2)}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="revenue"
              >
                {data.charts.revenueByCountry.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        {/* Revenue by Device */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Revenue by Device</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.charts.revenueByDevice}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="device" />
              <YAxis />
              <Tooltip formatter={(value) => [`$${value}`, 'Revenue']} />
              <Bar dataKey="revenue" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Fill Rate Distribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Fill Rate Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.charts.fillRateDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="range" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#ffc658" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Insights */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Insights</h3>
        <div className="space-y-2">
          {data.summary.avgFillRate < 50 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800">
                ⚠️ Low fill rate detected ({data.summary.avgFillRate.toFixed(1)}%). 
                Consider optimizing ad placements.
              </p>
            </div>
          )}
          
          {data.charts.revenueByCountry.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded">
              <p className="text-green-800">
                💡 Top performing country: {data.charts.revenueByCountry[0].country} 
                (${data.charts.revenueByCountry[0].revenue.toFixed(2)})
              </p>
            </div>
          )}
          
          {data.charts.revenueByDevice.length > 0 && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <p className="text-blue-800">
                📱 Best device type: {data.charts.revenueByDevice[0].device}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}