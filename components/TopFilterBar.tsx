'use client'

import { useEffect, useMemo, useState } from 'react'

export type DateRange = { from: string; to: string }

interface TopFilterBarProps {
  range: DateRange
  onChange: (next: DateRange) => void
  showCompare?: boolean
  extraLeft?: React.ReactNode
  onCompareChange?: (enabled: boolean) => void
  site?: string
}

const presets = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7days', label: 'Last 7 Days' },
  { key: 'last14days', label: 'Last 14 Days' },
  { key: 'thismonth', label: 'This Month' },
  { key: 'lastmonth', label: 'Last Month' },
  { key: 'all', label: '全部数据' },
]

export default function TopFilterBar({ range, onChange, showCompare = true, extraLeft, onCompareChange, site }: TopFilterBarProps) {
  const [preset, setPreset] = useState<string>('yesterday')
  const [from, setFrom] = useState(range.from)
  const [to, setTo] = useState(range.to)
  const [compare, setCompare] = useState(false)

  useEffect(() => {
    setFrom(range.from)
    setTo(range.to)
  }, [range.from, range.to])

  const syncUrl = (f: string, t: string) => {
    try {
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href)
        url.searchParams.set('from', f)
        url.searchParams.set('to', t)
        url.searchParams.delete('range')
        window.history.replaceState({}, '', url)
      }
    } catch {}
  }

  const onPreset = async (key: string) => {
    setPreset(key)
    if (key === 'all') {
      try {
        const res = await fetch(`/api/date-range${site ? `?site=${encodeURIComponent(site)}` : ''}`)
        const data = await res.json()
        const r = data?.data || {}
        setFrom(r.from || range.from)
        setTo(r.to || range.to)
        if (r.from && r.to) {
          onChange({ from: r.from, to: r.to })
          syncUrl(r.from, r.to)
        }
        return
      } catch {}
    }
    const r = calcRange(key)
    setFrom(r.from)
    setTo(r.to)
    onChange({ from: r.from, to: r.to })
    syncUrl(r.from, r.to)
  }

  const onSearch = () => {
    onChange({ from, to }); syncUrl(from, to)
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
    </div>
  )
}

function pad(n:number){ return n<10? '0'+n : String(n) }
function fmtLocal(d: Date){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

function calcRange(key: string): DateRange {
  const today = new Date()
  let start: Date, end: Date
  switch (key) {
    case 'all':
      start = new Date('1970-01-01')
      end = new Date('2100-01-01')
      break
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
  return { from: fmtLocal(start), to: fmtLocal(end) }
}
