import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const start = Date.now()
  
  // Log request details
  console.log(`[ACCESS] ${request.method} ${request.url} - ${request.headers.get('user-agent') || 'Unknown'}`)
  
  // Add custom header to track request start time
  const response = NextResponse.next()
  response.headers.set('X-Request-Start', start.toString())
  
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}