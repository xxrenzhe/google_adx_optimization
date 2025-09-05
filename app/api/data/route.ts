import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '10')
    const sortBy = searchParams.get('sortBy') || 'dataDate'
    const sortOrder = searchParams.get('sortOrder') || 'desc'
    const search = searchParams.get('search') || ''
    
    const skip = (page - 1) * limit
    
    const where = search ? {
      OR: [
        { website: { contains: search, mode: 'insensitive' as const } },
        { country: { contains: search, mode: 'insensitive' as const } },
        { domain: { contains: search, mode: 'insensitive' as const } },
        { device: { contains: search, mode: 'insensitive' as const } }
      ]
    } : {}
    
    const [data, total] = await Promise.all([
      prisma.adReport.findMany({
        where,
        skip,
        take: limit,
        orderBy: {
          [sortBy]: sortOrder
        }
      }),
      prisma.adReport.count({ where })
    ])
    
    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
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