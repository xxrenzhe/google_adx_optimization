"use client"

import { useEffect } from 'react'

export default function HomeTrkUi() {
  useEffect(() => {
    const nav = document.getElementById('global-navbar')
    const prevDisplay = nav?.style.display
    if (nav) nav.style.display = 'none'
    // Ensure body/background matches legacy page
    const prevBodyBg = document.body.style.background
    document.body.style.background = '#fff'
    return () => {
      if (nav) nav.style.display = prevDisplay || ''
      document.body.style.background = prevBodyBg
    }
  }, [])

  return (
    <iframe
      title="Home"
      src="/trk_ui/index"
      style={{ position: 'fixed', inset: 0, border: '0', width: '100vw', height: '100vh' }}
    />
  )
}
