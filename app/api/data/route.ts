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
    const cursor = searchParams.get('cursor') || '' // 使用ID作为cursor
    const limit = Math.min(Number(searchParams.get('limit')) || 100, 1000) // 限制最大1000条
    const search = searchParams.get('search') || ''
    
    // 构建where条件
    const where = {
      sessionId: session.id,
      ...(cursor ? { id: { lt: cursor } } : {}), // 向后分页
      ...(search ? {
        OR: [
          { website: { contains: search, mode: 'insensitive' as const } },
          { country: { contains: search, mode: 'insensitive' as const } },
          { domain: { contains: search, mode: 'insensitive' as const } },
          { device: { contains: search, mode: 'insensitive' as const } }
        ]
      } : {})
    }
    
    // 并行获取数据和总数（仅第一次请求）
    const [data, totalCount] = await Promise.all([
      prisma.adReport.findMany({
        where,
        take: limit,
        orderBy: { id: 'desc' } // 按ID排序，比OFFSET快
      }),
      cursor ? Promise.resolve(null) : prisma.adReport.count({ where: { sessionId: session.id } })
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