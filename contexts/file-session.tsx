'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface FileSession {
  fileId: string | null
  fileName: string | null
  setFile: (fileId: string, fileName: string) => void
  clearFile: () => void
}

const FileSessionContext = createContext<FileSession | undefined>(undefined)

export function FileSessionProvider({ children }: { children: ReactNode }) {
  const [fileId, setFileId] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  // 从localStorage恢复状态
  useEffect(() => {
    const savedFileId = localStorage.getItem('file-session-fileId')
    const savedFileName = localStorage.getItem('file-session-fileName')
    
    if (savedFileId && savedFileName) {
      setFileId(savedFileId)
      setFileName(savedFileName)
    }
  }, [])

  const setFile = (newFileId: string, newFileName: string) => {
    setFileId(newFileId)
    setFileName(newFileName)
    // 保存到localStorage
    localStorage.setItem('file-session-fileId', newFileId)
    localStorage.setItem('file-session-fileName', newFileName)
  }

  const clearFile = () => {
    setFileId(null)
    setFileName(null)
    // 从localStorage清除
    localStorage.removeItem('file-session-fileId')
    localStorage.removeItem('file-session-fileName')
  }

  return (
    <FileSessionContext.Provider value={{ fileId, fileName, setFile, clearFile }}>
      {children}
    </FileSessionContext.Provider>
  )
}

export function useFileSession() {
  const context = useContext(FileSessionContext)
  if (context === undefined) {
    throw new Error('useFileSession must be used within a FileSessionProvider')
  }
  return context
}