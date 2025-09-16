'use client'

import { useEffect, useMemo, useState } from 'react'

export type DateRange = { from: string; to: string }

interface TopFilterBarProps {
  range: DateRange
  onChange: (next: DateRange) => void
  showCompare?: boolean
  extraLeft?: React.ReactNode
  onCompareChange?: (enabled: boolean) => void
}

const presets = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7days', label: 'Last 7 Days' },
  { key: 'last14days', label: 'Last 14 Days' },
  { key: 'thismonth', label: 'This Month' },
  { key: 'lastmonth', label: 'Last Month' },
]

export default function TopFilterBar({ range, onChange, showCompare = true, extraLeft, onCompareChange }: TopFilterBarProps) {
  const [preset, setPreset] = useState<string>('yesterday')
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const [compare, setCompare] = useState(false)

  useEffect(() => {
    setFrom(range.from)
    setTo(range.to)
  }, [range.from, range.to])

  const onPreset = (key: string) => {
    setPreset(key)
    const r = calcRange(key)
    setFrom(r.from)
    setTo(r.to)
  }

  const onSearch = () => {
    onChange({ from, to })
    try {
      // 同步 URL 中的 range 参数（若在浏览器环境）
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.set('range', `${from} - ${to}`)
        window.history.replaceState({}, '', url)
      }
    } catch {}
  }

  return (
    <div className="bg-white border rounded-lg p-3 flex flex-wrap items-center gap-3 trk-datebar">
      {extraLeft}
      {showCompare && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="accent-blue-600" checked={compare} onChange={e=>{setCompare(e.target.checked); onCompareChange?.(e.target.checked)}} />
          Compare
        </label>
      )}
      <select className="border rounded px-3 py-2" value={preset} onChange={e=>onPreset(e.target.value)}>
        {presets.map(p=>(<option key={p.key} value={p.key}>{p.label}</option>))}
      </select>
      <input type="date" className="border rounded px-3 py-2" value={from} onChange={e=>setFrom(e.target.value)} />
      <span className="text-gray-400">-</span>
      <input type="date" className="border rounded px-3 py-2" value={to} onChange={e=>setTo(e.target.value)} />
      <button onClick={onSearch} className="px-4 py-2 bg-blue-600 text-white rounded">Search</button>
      <span className="trk-subtle">{from} - {to}</span>
    </div>
  )
}

function calcRange(key: string): DateRange {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().slice(0,10)
  let start: Date, end: Date
  switch (key) {
    case 'today':
      start = new Date(today)
      end = new Date(today)
      break
    case 'yesterday': {
      const y = new Date(today); y.setDate(y.getDate()-1)
      start = y; end = y
      break }
    case 'last7days': {
      const s = new Date(today); s.setDate(s.getDate()-6)
      start = s; end = today
      break }
    case 'last14days': {
      const s = new Date(today); s.setDate(s.getDate()-13)
      start = s; end = today
      break }
    case 'thismonth': {
      start = new Date(today.getFullYear(), today.getMonth(), 1)
      end = today
      break }
    case 'lastmonth': {
      const m = new Date(today.getFullYear(), today.getMonth()-1, 1)
      start = new Date(m.getFullYear(), m.getMonth(), 1)
      end = new Date(m.getFullYear(), m.getMonth()+1, 0)
      break }
    default:
      start = today; end = today
  }
  return { from: fmt(start), to: fmt(end) }
}
