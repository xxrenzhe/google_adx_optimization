"use client"

import { useEffect } from 'react'

export default function QueryNormalizer() {
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const url = new URL(window.location.href)
      const sp = url.searchParams
      // 仅当存在 range 且缺少 from/to 时才改写
      const r = sp.get('range')
      const hasFromTo = sp.has('from') && sp.has('to')
      if (r && !hasFromTo) {
        const m = r.split(/\s*-\s*/)
        if (m.length === 2 && /^\d{4}-\d{2}-\d{2}$/.test(m[0]) && /^\d{4}-\d{2}-\d{2}$/.test(m[1])) {
          sp.set('from', m[0])
          sp.set('to', m[1])
          sp.delete('range')
          window.history.replaceState({}, '', url)
        }
      }
    } catch {}
  }, [])
  return null
}

