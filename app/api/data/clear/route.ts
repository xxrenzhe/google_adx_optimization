import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionId } from '@/lib/session'

export async function DELETE(request: NextRequest) {
  try {
    // Get session ID from cookie
    const sessionId = getSessionId(request)
    
    if (!sessionId) {
      return NextResponse.json({ error: 'No session found' }, { status: 400 })
    }
    
    // Delete only records for this session
    const result = await prisma.adReport.deleteMany({
      where: { sessionId }
    })
    
    // Clear the session cookie
    const response = NextResponse.json({ 
      message: 'Session data cleared successfully',
      recordsDeleted: result.count
    })
    
    response.cookies.delete('adx_session_id')
    
    return response
  } catch (error) {
    console.error('Clear data error:', error)
    return NextResponse.json(
      { error: 'Failed to clear data' },
      { status: 500 }
    )
  }
}