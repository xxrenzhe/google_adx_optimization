// Session management for tracking current upload data
export type UploadSession = {
  id: string
  filename: string
  uploadDate: string
  recordCount: number
}

// Global store for current session (fallback for server-side)
let currentSession: UploadSession | null = null

export function setCurrentSession(session: UploadSession) {
  currentSession = session
}

export function getCurrentSession(request?: Request): UploadSession | null {
  // First try to get from in-memory store (server-side)
  if (currentSession) {
    return currentSession
  }
  
  // If request is provided, try to get session ID from cookie
  if (request) {
    // Note: In Next.js API routes, we need to parse cookies manually
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=')
        acc[key] = value
        return acc
      }, {} as Record<string, string>)
      
      const sessionId = cookies['adx_session_id']
      if (sessionId) {
        // For now, create a minimal session object from the ID
        // In production, you might want to fetch full session data from a database
        return {
          id: sessionId,
          filename: 'Uploaded file',
          uploadDate: new Date().toISOString(),
          recordCount: 0
        }
      }
    }
  }
  
  return null
}

export function clearCurrentSession() {
  currentSession = null
}

// Generate a unique session ID
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Get session ID from request cookies
export function getSessionId(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie')
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=')
      acc[key] = value
      return acc
    }, {} as Record<string, string>)
    
    return cookies['adx_session_id'] || null
  }
  return null
}