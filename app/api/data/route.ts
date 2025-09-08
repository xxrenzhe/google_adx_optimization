import { NextRequest, NextResponse } from 'next/server'
import { FileSystemManager } from '@/lib/fs-manager'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cursor = searchParams.get('cursor')
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 1000)
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'dataDate'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    // Get all analysis results
    const allResults = await FileSystemManager.getAllAnalysisResults()
    
    if (allResults.length === 0) {
      return NextResponse.json({ 
        data: [],
        pagination: {
          nextCursor: null,
          totalCount: 0,
          hasMore: false,
          limit
        }
      })
    }
    
    // Combine and transform all data
    let allData: any[] = []
    
    for (const result of allResults) {
      if (result.sampleData && Array.isArray(result.sampleData)) {
        // Transform sample data to match expected format
        const transformed = result.sampleData.map((item: any, index: number) => ({
          id: `${result.fileName}-${index}`,
          dataDate: item.date || item.dataDate || result.uploadTime,
          website: item.website || item.domain || 'Unknown',
          country: item.country || 'Unknown',
          adFormat: item.adFormat || 'Unknown',
          adUnit: item.adUnit || 'Unknown',
          advertiser: item.advertiser || 'Unknown',
          domain: item.domain || item.website || 'Unknown',
          device: item.device || 'Unknown',
          browser: item.browser || 'Unknown',
          requests: item.requests || 0,
          impressions: item.impressions || 0,
          clicks: item.clicks || 0,
          ctr: item.ctr || (item.clicks && item.impressions ? (item.clicks / item.impressions) * 100 : 0),
          ecpm: item.ecpm || (item.revenue && item.impressions ? (item.revenue / item.impressions) * 1000 : 0),
          revenue: item.revenue || 0,
          viewableImpressions: item.viewableImpressions || 0,
          viewabilityRate: item.viewabilityRate || 0,
          measurableImpressions: item.measurableImpressions || 0,
          fillRate: item.fillRate || (item.impressions && item.requests ? (item.impressions / item.requests) * 100 : 0),
          arpu: item.arpu || 0
        }))
        allData = allData.concat(transformed)
      }
    }
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase()
      allData = allData.filter(item => 
        (item.website && item.website.toLowerCase().includes(searchLower)) ||
        (item.country && item.country.toLowerCase().includes(searchLower)) ||
        (item.domain && item.domain.toLowerCase().includes(searchLower)) ||
        (item.device && item.device.toLowerCase().includes(searchLower))
      )
    }
    
    // Sort data
    allData.sort((a, b) => {
      let aVal = a[sortBy]
      let bVal = b[sortBy]
      
      // Handle date sorting
      if (sortBy === 'dataDate') {
        aVal = new Date(aVal).getTime()
        bVal = new Date(bVal).getTime()
      }
      
      if (sortOrder === 'desc') {
        return bVal > aVal ? 1 : bVal < aVal ? -1 : 0
      } else {
        return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
      }
    })
    
    // Apply cursor pagination
    let startIndex = 0
    if (cursor) {
      startIndex = allData.findIndex(item => item.id === cursor) + 1
    }
    
    const paginatedData = allData.slice(startIndex, startIndex + limit)
    
    return NextResponse.json({
      data: paginatedData,
      pagination: {
        nextCursor: paginatedData.length === limit ? paginatedData[paginatedData.length - 1].id : null,
        totalCount: allData.length,
        hasMore: startIndex + limit < allData.length,
        limit
      }
    })
    
  } catch (error) {
    console.error('Data fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch data' },
      { status: 500 }
    )
  }
}