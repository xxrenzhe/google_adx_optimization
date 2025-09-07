import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createClient } from 'redis'

// Redis client
const redis = createClient({
  url: process.env.REDIS_URL || '',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500)
  }
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 })
    }
    
    // Get progress from Redis
    const progress = await redis.get(`upload_progress:${sessionId}`)
    
    if (!progress) {
      return NextResponse.json({ 
        progress: 0,
        message: 'No progress data found'
      })
    }
    
    const processed = parseInt(progress)
    
    // Get session info for total count
    const session = await prisma.uploadSession.findUnique({
      where: { id: sessionId },
      select: { recordCount: true, status: true }
    })
    
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }
    
    const percentage = session.recordCount ? Math.round((processed / session.recordCount) * 100) : 0
    
    return NextResponse.json({
      processed,
      total: session.recordCount,
      percentage,
      status: session.status,
      message: session.status === 'completed' ? 'Upload completed' : 'Processing...'
    })
    
  } catch (error) {
    console.error('Progress fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch progress' },
      { status: 500 }
    )
  }
}