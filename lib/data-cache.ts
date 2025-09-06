import { cache } from 'react'

// Cache data fetching functions to prevent duplicate requests
export const cachedAnalytics = cache(async (startDate?: string, endDate?: string) => {
  const params = new URLSearchParams()
  if (startDate) params.append('startDate', startDate)
  if (endDate) params.append('endDate', endDate)
  
  const response = await fetch(`/api/analytics?${params}`, {
    next: { 
      revalidate: 300, // 5 minutes
      tags: ['analytics'] 
    }
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch analytics')
  }
  
  return response.json()
})

export const cachedAdReports = cache(async (
  page: number = 1,
  limit: number = 10,
  sortBy: string = 'dataDate',
  sortOrder: string = 'desc',
  search: string = ''
) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    sortBy,
    sortOrder,
    search
  })
  
  const response = await fetch(`/api/data?${params}`, {
    next: { 
      revalidate: 60, // 1 minute
      tags: ['ad-reports'] 
    }
  })
  
  if (!response.ok) {
    throw new Error('Failed to fetch ad reports')
  }
  
  return response.json()
})