"use client"

import { useEffect, useMemo, useState } from 'react'
import Flatpickr from 'react-flatpickr'

export type DateRange = { from: string; to: string }

interface Props {
  range: DateRange
  onChange: (next: DateRange) => void
  onCompareChange?: (enabled: boolean) => void
  extraLeft?: React.ReactNode
  showCompare?: boolean
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

export default function DateRangeBar({ range, onChange, onCompareChange, extraLeft, showCompare = false, site }: Props) {
  const [preset, setPreset] = useState<string>('yesterday')
  const [dates, setDates] = useState<[Date, Date] | [Date]>(toDates(range))
  const [compare, setCompare] = useState(false)

  useEffect(()=>{ setDates(toDates(range)) }, [range.from, range.to])

  const fpOptions = useMemo(() => ({
    mode: 'range',
    dateFormat: 'Y-m-d'
  }), [])

  const onPreset = async (key: string) => {
    setPreset(key)
    if (key === 'all') {
      try {
        const res = await fetch(`/api/date-range${site ? `?site=${encodeURIComponent(site)}` : ''}`)
        const data = await res.json()
        const f = data?.data?.from; const t = data?.data?.to
        if (f && t) {
          setDates([new Date(f), new Date(t)])
          onChange({ from: f, to: t })
          syncRangeToUrl(f, t)
          return
        }
      } catch {}
    }
    const { from, to } = calcRange(key)
    setDates([new Date(from), new Date(to)])
    onChange({ from, to })
    syncRangeToUrl(from, to)
  }

  const onPick = (selectedDates: Date[]) => {
    if (selectedDates.length === 2) {
      setDates([selectedDates[0], selectedDates[1]])
      const from = fmtLocal(selectedDates[0])
      const to = fmtLocal(selectedDates[1])
      onChange({ from, to })
      syncRangeToUrl(from, to)
    }
  }

  return (
    <div className="bg-white border rounded-lg p-3 flex flex-wrap items-center gap-3 trk-datebar">
      {extraLeft}
      {showCompare && (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="accent-blue-600" checked={compare} onChange={e=>{ setCompare(e.target.checked); onCompareChange?.(e.target.checked) }} />
          Compare
        </label>
      )}
      <select className="border rounded px-3 py-2" value={preset} onChange={e=>onPreset(e.target.value)}>
        {presets.map(p=> <option key={p.key} value={p.key}>{p.label}</option>)}
      </select>
      <div className="flex items-center gap-2">
        <Flatpickr className="border rounded px-3 py-2 bg-white text-sm" options={fpOptions as any} value={dates as any} onChange={onPick as any} />
        <button className="px-4 py-2 bg-blue-600 text-white rounded shadow-sm" onClick={()=>{
          if (Array.isArray(dates) && dates.length===2) {
            const [f, t] = dates
            const from = fmtLocal(f), to = fmtLocal(t)
            onChange({ from, to })
            syncRangeToUrl(from, to)
          }
        }}>Search</button>
      </div>
    </div>
  )
}

function pad(n: number){ return n<10? '0'+n : String(n) }
function fmtLocal(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
}

function parseLocalDate(s: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y,m,d] = s.split('-').map(Number)
    return new Date(y, (m as number)-1, d)
  }
  return new Date(s)
}

function toDates(r: DateRange): [Date, Date] {
  return [parseLocalDate(r.from), parseLocalDate(r.to)]
}

function calcRange(key: string): DateRange {
  const today = new Date()
  const f = (d: Date) => fmtLocal(d)
  let start: Date, end: Date
  switch (key) {
    case 'all': start = new Date('1970-01-01'); end = new Date('2100-01-01'); break
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
      url.searchParams.set('from', from)
      url.searchParams.set('to', to)
      url.searchParams.delete('range')
      window.history.replaceState({}, '', url)
    }
  } catch {}
}
