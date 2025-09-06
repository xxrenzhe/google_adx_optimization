import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getCurrentSession } from '@/lib/session'

export async function GET(request: NextRequest) {
  try {
    const session = getCurrentSession(request)
    if (!session) {
      return NextResponse.json({ error: 'No data uploaded yet' }, { status: 404 })
    }
    
    const { searchParams } = new URL(request.url)
    const page = Math.max(Number(searchParams.get('page')) || 1, 1) // 页码从1开始
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 1000) // 限制最大1000条
    const search = searchParams.get('search') || ''
    const sortBy = searchParams.get('sortBy') || 'dataDate'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    
    // 计算跳过的记录数
    const skip = (page - 1) * limit
    
    // 构建where条件
    const where = {
      sessionId: session.id,
      ...(search ? {
        OR: [
          { website: { contains: search, mode: 'insensitive' as const } },
          { country: { contains: search, mode: 'insensitive' as const } },
          { domain: { contains: search, mode: 'insensitive' as const } },
          { device: { contains: search, mode: 'insensitive' as const } }
        ]
      } : {})
    }
    
    // 构建排序条件
    const orderBy = { [sortBy]: sortOrder }
    
    // 并行获取数据和总数
    const [data, totalCount] = await Promise.all([
      prisma.adReport.findMany({
        where,
        skip,
        take: limit,
        orderBy
      }),
      prisma.adReport.count({ where: { sessionId: session.id } })
    ])
    
    // Transform BigInt values to regular numbers for JSON serialization
    const transformedData = data.map(record => ({
      ...record,
      requests: record.requests ? Number(record.requests) : null,
      impressions: record.impressions ? Number(record.impressions) : null,
      clicks: record.clicks ? Number(record.clicks) : null,
      viewableImpressions: record.viewableImpressions ? Number(record.viewableImpressions) : null,
      measurableImpressions: record.measurableImpressions ? Number(record.measurableImpressions) : null
    }))
    
    return NextResponse.json({
      data: transformedData,
      pagination: {
        nextCursor: data.length === limit ? data[data.length - 1].id : null,
        totalCount: totalCount || await prisma.adReport.count({ where: { sessionId: session.id } }),
        hasMore: data.length === limit,
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