"use client"

import { useEffect, useMemo, useState } from 'react'
import Flatpickr from 'react-flatpickr'

export type DateRange = { from: string; to: string }

interface Props {
  range: DateRange
  onChange: (next: DateRange) => void
  onCompareChange?: (enabled: boolean) => void
  extraLeft?: React.ReactNode
}

const presets = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7days', label: 'Last 7 Days' },
  { key: 'last14days', label: 'Last 14 Days' },
  { key: 'thismonth', label: 'This Month' },
  { key: 'lastmonth', label: 'Last Month' },
]

export default function DateRangeBar({ range, onChange, onCompareChange, extraLeft }: Props) {
  const [preset, setPreset] = useState<string>('yesterday')
  const [dates, setDates] = useState<[Date, Date] | [Date]>(toDates(range))
  const [compare, setCompare] = useState(false)

  useEffect(()=>{ setDates(toDates(range)) }, [range.from, range.to])

  const fpOptions = useMemo(() => ({
    mode: 'range',
    dateFormat: 'Y-m-d',
    defaultDate: dates,
  }), [dates])

  const onPreset = (key: string) => {
    setPreset(key)
    const { from, to } = calcRange(key)
    setDates([new Date(from), new Date(to)])
    onChange({ from, to })
    syncRangeToUrl(from, to)
  }

  const onPick = (selectedDates: Date[]) => {
    if (selectedDates.length === 2) {
      const from = fmt(selectedDates[0])
      const to = fmt(selectedDates[1])
      onChange({ from, to })
      syncRangeToUrl(from, to)
    }
  }

  return (
    <div className="bg-white border rounded-lg p-3 flex flex-wrap items-center gap-3 trk-datebar">
      {extraLeft}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" className="accent-blue-600" checked={compare} onChange={e=>{ setCompare(e.target.checked); onCompareChange?.(e.target.checked) }} />
        Compare
      </label>
      <select className="border rounded px-3 py-2" value={preset} onChange={e=>onPreset(e.target.value)}>
        {presets.map(p=> <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      <div className="flex items-center gap-2">
        <Flatpickr className="border rounded px-3 py-2 bg-white text-sm" options={fpOptions as any} onChange={onPick as any} />
        <button className="px-4 py-2 bg-blue-600 text-white rounded shadow-sm" onClick={()=>{
          if (Array.isArray(dates) && dates.length===2) {
            const [f, t] = dates
            const from = fmt(f), to = fmt(t)
            onChange({ from, to })
            syncRangeToUrl(from, to)
          }
        }}>Search</button>
      </div>
      <span className="trk-subtle">{range.from} - {range.to}</span>
    </div>
  )
}

function fmt(d: Date) { return d.toISOString().slice(0,10) }

function toDates(r: DateRange): [Date, Date] {
  return [new Date(r.from), new Date(r.to)]
}

function calcRange(key: string): DateRange {
  const today = new Date()
  const f = (d: Date) => d.toISOString().slice(0,10)
  let start: Date, end: Date
  switch (key) {
    case 'today': start = new Date(today); end = new Date(today); break
    case 'yesterday': { const y = new Date(today); y.setDate(y.getDate()-1); start = y; end = y; break }
    case 'last7days': { const s = new Date(today); s.setDate(s.getDate()-6); start = s; end = today; break }
    case 'last14days': { const s = new Date(today); s.setDate(s.getDate()-13); start = s; end = today; break }
    case 'thismonth': start = new Date(today.getFullYear(), today.getMonth(), 1); end = today; break
    case 'lastmonth': {
      const m = new Date(today.getFullYear(), today.getMonth()-1, 1)
      start = new Date(m.getFullYear(), m.getMonth(), 1)
      end = new Date(m.getFullYear(), m.getMonth()+1, 0)
      break
    }
    default: start = today; end = today
  }
  return { from: f(start), to: f(end) }
}

function syncRangeToUrl(from: string, to: string) {
  try {
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('range', `${from} - ${to}`)
      window.history.replaceState({}, '', url)
    }
  } catch {}
}
