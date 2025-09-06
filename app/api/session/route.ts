import { NextRequest, NextResponse } from 'next/server'
import { getCurrentSession } from '@/lib/session'

export async function GET() {
  try {
    const session = getCurrentSession()
    return NextResponse.json({ session })
  } catch (error) {
    console.error('Error getting session:', error)
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    )
  }
}

export async function DELETE() {
  try {
    // Clear current session
    const { clearCurrentSession } = await import('@/lib/session')
    clearCurrentSession()
    return NextResponse.json({ message: 'Session cleared' })
  } catch (error) {
    console.error('Error clearing session:', error)
    return NextResponse.json(
      { error: 'Failed to clear session' },
      { status: 500 }
    )
  }
}