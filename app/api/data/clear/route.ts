import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST() {
  try {
    // Delete all records
    const result = await prisma.adReport.deleteMany({})
    
    return NextResponse.json({ 
      message: 'Data cleared successfully',
      recordsDeleted: result.count
    })
  } catch (error) {
    console.error('Clear data error:', error)
    return NextResponse.json(
      { error: 'Failed to clear data' },
      { status: 500 }
    )
  }
}