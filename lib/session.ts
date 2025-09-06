// Session management for tracking current upload data
export type UploadSession = {
  id: string
  filename: string
  uploadDate: string
  recordCount: number
}

// Global store for current session (in production, this could be Redis or database)
let currentSession: UploadSession | null = null

export function setCurrentSession(session: UploadSession) {
  currentSession = session
}

export function getCurrentSession(): UploadSession | null {
  return currentSession
}

export function clearCurrentSession() {
  currentSession = null
}

// Generate a unique session ID
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}