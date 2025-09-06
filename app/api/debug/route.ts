import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    // Get sample of raw data to debug column mapping
    const sample = await prisma.adReport.findFirst({
      orderBy: {
        dataDate: 'desc'
      }
    })
    
    return NextResponse.json({ sample })
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json(
      { error: 'Debug failed' },
      { status: 500 }
    )
  }
}