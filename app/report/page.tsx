'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef, useState } from 'react'
import DateRangeBar, { DateRange } from '@/components/DateRangeBar'
import ChartQueryEditorModal from '@/components/ChartQueryEditorModal'
import { baseOptions, donutOptions, donutOptionsRight, intYAxis, intYAxisWithTitle } from '@/lib/chart-theme'
import { formatCurrency } from '@/lib/utils'

const ApexChart: any = dynamic(() => import('react-apexcharts') as any, { ssr: false }) as any

type Site = { id: number; domain: string }

export default function ReportPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [site, setSite] = useState<string>('')
  const [sitesLoading, setSitesLoading] = useState<boolean>(true)
  const [range, setRange] = useState<DateRange>(() => defaultLast30())
  const [timeseries, setTimeseries] = useState<any[]>([])
  const [devBrowser, setDevBrowser] = useState<any[]>([])
  const [browserAgg, setBrowserAgg] = useState<{labels:string[]; series:number[]}>({ labels: [], series: [] })
  const [countries, setCountries] = useState<any[]>([])
  const [kpiSeries, setKpiSeries] = useState<any[]>([])
  const [cpcSeries, setCpcSeries] = useState<any[]>([])
  const [ecpmSeries, setEcpmSeries] = useState<any[]>([])
  const [devicesKpi, setDevicesKpi] = useState<any[]>([])
  const [browsersKpi, setBrowsersKpi] = useState<any[]>([])
  const [adunitsKpi, setAdunitsKpi] = useState<any[]>([])
  const [advertisersKpi, setAdvertisersKpi] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  // Compare 已移除
  const [editorKey, setEditorKey] = useState<string|null>(null)
  const [summaryCards, setSummaryCards] = useState<any>({ revenue:0, cost:0, profit:0, roi:null, cpc:null, adx:0, offer:0, yahoo:0 })
  const [costs, setCosts] = useState<{ total:number; google:number; bing:number; other:number }|null>(null)
  const [noData, setNoData] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // 缺少成本维度（ad_costs）等提示标记
  const [missingKpiCosts, setMissingKpiCosts] = useState(false)
  const [missingCpcCosts, setMissingCpcCosts] = useState(false)
  const [missingCountryCosts, setMissingCountryCosts] = useState(false)
  const [missingDeviceCosts, setMissingDeviceCosts] = useState(false)
  const [missingBrowserCosts, setMissingBrowserCosts] = useState(false)
  const [missingAdunitCosts, setMissingAdunitCosts] = useState(false)
  const [missingAdvertiserCosts, setMissingAdvertiserCosts] = useState(false)
  // 排序状态
  type Sort = { key: string; dir: 'asc'|'desc' }
  const [sortCountry, setSortCountry] = useState<Sort>({ key: 'revenue', dir: 'desc' })
  const [sortBrowser, setSortBrowser] = useState<Sort>({ key: 'revenue', dir: 'desc' })
  const [sortAdunit, setSortAdunit] = useState<Sort>({ key: 'revenue', dir: 'desc' })
  const [sortDevice, setSortDevice] = useState<Sort>({ key: 'revenue', dir: 'desc' })
  const [siteKpi, setSiteKpi] = useState<{today:number; last7:number; yesterday:number}>({today:0,last7:0,yesterday:0})
  // Profit 卡自适应高度的环形大小
  const profitCardRef = useRef<HTMLDivElement|null>(null)
  const [ringSize, setRingSize] = useState<number>(180)
  // 分页状态（每表独立）
  const pageSize = 15
  const [pageCountry, setPageCountry] = useState(1)
  const [pageBrowser, setPageBrowser] = useState(1)
  const [pageAdunit, setPageAdunit] = useState(1)
  const [pageDevice, setPageDevice] = useState(1)
  // 筛选（表格）
  const [filterCountry, setFilterCountry] = useState('')
  const [filterBrowser, setFilterBrowser] = useState('')
  const [filterAdunit, setFilterAdunit] = useState('')
  const [filterDevice, setFilterDevice] = useState('')
  const [filterAdvertiser, setFilterAdvertiser] = useState('')
  // 调试开关：在 URL 添加 ?debug=1 可显示调试信息与备用简化图表
  const isDebug = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === '1'

  useEffect(() => {
    fetch('/api/sites')
      .then(r => r.json())
      .then(d => {
        if (d.items) {
          setSites(d.items)
          const sp = new URLSearchParams(window.location.search)
          const fromUrl = sp.get('sites')
          const fromParam = sp.get('from')
          const toParam = sp.get('to')
          const rangeParam = sp.get('range')
          const pick = fromUrl || d.items[0]?.domain || ''
          setSite(pick)
          if (fromParam && toParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam) && /^\d{4}-\d{2}-\d{2}$/.test(toParam)) {
            setRange({ from: fromParam, to: toParam })
          } else if (rangeParam) {
            const parts = rangeParam.split(/\s*-\s*/)
            if (parts.length === 2) {
              const [from, to] = parts
              if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
                setRange({ from, to })
              }
            }
          }
        }
      })
      .finally(() => setSitesLoading(false))
  }, [])

  useEffect(()=>{
    if (!site) return
    fetch(`/api/report/kpi?site=${encodeURIComponent(site)}`).then(r=>r.json()).then(d=>{
      if (d.data) setSiteKpi(d.data)
    }).catch(()=>{})
  },[site])

  useEffect(() => {
    if (!site) return
    setLoading(true)
    let hadError = false
    const mk = (key: string, f=range.from, t=range.to) => new URLSearchParams({ key, site, from: f, to: t })
    const safe = (p: Promise<Response>) => p.then(r=>{ if(!r.ok) throw new Error(String(r.status)); return r.json() }).catch(()=>{ hadError = true; return { data: [] } })
    const safeObj = (p: Promise<Response>) => p.then(r=>{ if(!r.ok) throw new Error(String(r.status)); return r.json() }).catch(()=>{ hadError = true; return { data: {} } })
    Promise.all([
      safe(fetch('/api/charts?' + mk('report.timeseries'))),
      safe(fetch('/api/charts?' + mk('report.device_browser'))),
      safe(fetch('/api/charts?' + mk('report.ecpm_series'))),
      safe(fetch('/api/charts?' + mk('report.cpc_series'))),
      safe(fetch('/api/charts?' + mk('report.country_table_kpi'))),
      safe(fetch('/api/charts?' + mk('report.device_table_kpi'))),
      safe(fetch('/api/charts?' + mk('report.browser_table_kpi'))),
      safe(fetch('/api/charts?' + mk('report.adunit_table_kpi'))),
      safe(fetch('/api/charts?' + mk('report.advertiser_table_kpi'))),
      safe(fetch('/api/charts?' + mk('report.kpi_series'))),
      safeObj(fetch(`/api/report/summary?site=${encodeURIComponent(site)}&from=${range.from}&to=${range.to}`)),
      safeObj(fetch(`/api/report/costs?site=${encodeURIComponent(site)}&from=${range.from}&to=${range.to}`)),
    ]).then(([ts, db, ec, cpc, ct, dk, bk, ak, rk, ks, sm, cb]) => {
      const a=ts.data||[], b=db.data||[], ecpm=ec.data||[], cpcS=cpc.data||[], c=ct.data||[], d=dk.data||[], e=bk.data||[], f=ak.data||[], g=rk.data||[], h=ks.data||[], s=sm.data||{}, costb=cb.data||null
      setTimeseries(a)
      setDevBrowser(b)
      // 设备/浏览器 饼图聚合
      try {
        const mapBro = new Map<string, number>()
        b.forEach((r: any) => {
          const k = r.browser || 'Unknown'
          mapBro.set(k, (mapBro.get(k)||0) + Number(r.revenue||0))
        })
        const labels = Array.from(mapBro.keys())
        const series = labels.map(l => Number(mapBro.get(l)||0))
        setBrowserAgg({ labels, series })
      } catch {}
      setCountries(c)
      setEcpmSeries(ecpm)
      setCpcSeries(cpcS)
      setDevicesKpi(d)
      setBrowsersKpi(e)
      setAdunitsKpi(f)
      setAdvertisersKpi(g)
      setKpiSeries(h)
      setSummaryCards(s)
      setCosts(costb)
      setLoadError(hadError)
      // 标记缺表（/api/charts 在 42P01 时返回 missing: 'relation'）
      setMissingCountryCosts(Boolean(ct?.missing === 'relation'))
      setMissingDeviceCosts(Boolean(dk?.missing === 'relation'))
      setMissingBrowserCosts(Boolean(bk?.missing === 'relation'))
      setMissingAdunitCosts(Boolean(ak?.missing === 'relation'))
      setMissingAdvertiserCosts(Boolean(rk?.missing === 'relation'))
      setMissingKpiCosts(Boolean(ks?.missing === 'relation'))
      setMissingCpcCosts(Boolean(cpc?.missing === 'relation'))
      const hasAny = (a.length>0 || b.length>0 || c.length>0 || d.length>0 || e.length>0 || f.length>0 || g.length>0 || h.length>0 || Number(s?.revenue||0)>0)
      setNoData(!hasAny)
      // 重置分页（切站点或范围时回到第一页）
      setPageCountry(1); setPageBrowser(1); setPageAdunit(1); setPageDevice(1)
    }).finally(() => setLoading(false))
  }, [site, range.from, range.to])

  // 监听 Profit 卡高度变化，动态设置环形尺寸
  useEffect(() => {
    if (typeof window === 'undefined') return
    const el = profitCardRef.current
    if (!el) return
    const measure = () => {
      const h = el.getBoundingClientRect().height || 0
      const size = Math.max(140, Math.min(280, Math.floor(h * 0.5)))
      setRingSize(size)
    }
    measure()
    let ro: ResizeObserver | null = null
    try { ro = new ResizeObserver(() => measure()); ro.observe(el) } catch {}
    window.addEventListener('resize', measure)
    return () => { window.removeEventListener('resize', measure); if (ro) ro.disconnect() }
  }, [])

  const tsOptions = useMemo(() => {
    // 使用 categories + 纯数值序列，避免 {x,y} 在 category 轴上的兼容问题导致空白图
    const days = timeseries.map((x: any) => (x.day ? String(x.day).slice(0, 10) : ''))
    const revenue = timeseries.map((x: any) => Number(x.revenue || 0))
    const ecpm = timeseries.map((x: any) => Number(x.ecpm || 0))
    const clicks = timeseries.map((x: any) => Number(x.clicks || 0))
    const impressions = timeseries.map((x: any) => Number(x.impressions || 0))
    const series: any[] = [
      { name: 'Total Revenue', type: 'line', data: revenue },
      { name: 'eCPM', type: 'line', data: ecpm },
      { name: 'Clicks', type: 'line', data: clicks },
      { name: 'Impressions', type: 'line', data: impressions },
    ]
    const showLabels = timeseries.length <= 100
    return {
      chart: { type: 'line', height: 280, toolbar: { show: false }, animations: { enabled: false } },
      xaxis: { type: 'category', categories: days },
      stroke: { curve: 'smooth', width: [3, 2, 2, 2] },
      series,
      yaxis: intYAxisWithTitle('Amount'),
      grid: { borderColor: '#E5E7EB', strokeDashArray: 2 },
      colors: ['#8B7EFF','#35BDAA','#FFB748','#4240A0'],
      tooltip: { shared: true, intersect: false },
      dataLabels: showLabels ? { enabled: true, enabledOnSeries: [3] } : { enabled: false },
      legend: { position: 'top', horizontalAlign: 'right' }
    }
  }, [timeseries])

  const deviceAgg = useMemo(() => {
    const map = new Map<string, number>()
    devBrowser.forEach((r: any) => {
      const k = r.device || 'Unknown'
      map.set(k, (map.get(k)||0) + Number(r.revenue||0))
    })
    const labels = Array.from(map.keys())
    const series = labels.map(l => Number(map.get(l)||0))
    return { labels, series }
  }, [devBrowser])

  const broDonut = useMemo(() => browserAgg, [browserAgg])

  const cpcOptions = useMemo(() => {
    // 标准化数据
    const toDay = (d:any) => {
      try { return typeof d === 'string' ? d.slice(0,10) : new Date(d).toISOString().slice(0,10) } catch { return '' }
    }
    const norm = (s:string) => (s||'').toLowerCase()
    const rows = (cpcSeries||[]).map((x:any)=> ({ day: toDay(x.day), src: norm(x.source||x.platform||x.src||''), cpc: x.cpc==null? null:Number(x.cpc) }))
    const days = Array.from(new Set(rows.map(r=>r.day))).filter(Boolean).sort()
    // 找出有值的来源，优先展示 google / bing，其次其它来源（最多 3 个）
    const countBy: Record<string, number> = {}
    for (const r of rows) if (r.cpc!=null && r.src) countBy[r.src] = (countBy[r.src]||0) + 1
    const sourcesAll = Object.keys(countBy)
    const isGoogle = (s:string) => /google|adwords|ads/.test(s)
    const isBing   = (s:string) => /bing|microsoft/.test(s)
    const others = sourcesAll.filter(s=>!isGoogle(s) && !isBing(s)).sort((a,b)=> (countBy[b]-countBy[a]))
    const sourcesOrdered = [
      ...sourcesAll.filter(isGoogle),
      ...sourcesAll.filter(isBing),
      ...others
    ].slice(0,3)
    const labelFor = (s:string) => isGoogle(s) ? 'Ads Average CPC' : isBing(s) ? 'Bing CPC' : `${s.toUpperCase()} CPC`
    const colorFor = (s:string, idx:number) => isGoogle(s) ? '#FF7043' : isBing(s) ? '#35BDAA' : ['#67C5E8','#BCB4FA','#8B7EFF'][idx%3]
    const series:any[] = []
    const colors:string[] = []
    for (let i=0;i<sourcesOrdered.length;i++) {
      const s = sourcesOrdered[i]
      const map = new Map<string, number|null>()
      for (const r of rows) if (r.src===s) map.set(r.day, r.cpc)
      const data = days.map(d => map.has(d) ? (map.get(d) as (number|null)) : null)
      if (data.some(v=>v!=null)) {
        series.push({ name: labelFor(s), type:'area', data })
        colors.push(colorFor(s, i))
      }
    }
    return {
      chart:{ type:'area', height: 140, toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: true } },
      xaxis:{ categories: days, labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
      stroke:{ curve:'smooth', width: 2, dashArray: 0 },
      fill: { type:'gradient', gradient:{ shadeIntensity: 0.6, opacityFrom: 0.45, opacityTo: 0.12, stops: [0, 100] } },
      dataLabels: { enabled: false },
      markers: { size: 2, strokeWidth: 2, strokeColors: '#fff', colors: ['#fff'] },
      grid: { borderColor: '#E5E7EB', strokeDashArray: 0, yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } } },
      legend: { show: series.length>1, position: 'top', horizontalAlign: 'left', markers: { radius: 12 } },
      tooltip: { shared: series.length>1, intersect: false, y: { formatter: (v:number)=> v==null? '—' : `$${Number(v).toFixed(2)}` } },
      yaxis: { labels: { show: false, formatter: (v:number)=> `$${Number(v||0).toFixed(2)}` } },
      colors,
      series
    }
  }, [cpcSeries])

  const cpcSummaryList = useMemo(() => {
    // 信息卡：根据实际来源动态展示最近一天有值的 CPC，优先 Google/Bing，其次其它来源（最多 3 条）
    const toDay = (d:any) => { try { return typeof d==='string'? d.slice(0,10) : new Date(d).toISOString().slice(0,10) } catch { return '' } }
    const norm = (s:string) => (s||'').toLowerCase()
    const rows = (cpcSeries||[]).map((x:any)=> ({ day: toDay(x.day), src: norm(x.source||x.platform||x.src||''), cpc: x.cpc==null? null:Number(x.cpc) }))
    const isGoogle = (s:string) => /google|adwords|ads/.test(s)
    const isBing   = (s:string) => /bing|microsoft/.test(s)
    const days = Array.from(new Set(rows.map(r=>r.day))).filter(Boolean).sort((a,b)=> a<b? -1: 1)
    const daysDesc = [...days].reverse()
    const pickLatest = (src:string): number|null => {
      for (const d of daysDesc) {
        const r = rows.find(x => x.src===src && x.day===d && x.cpc!=null)
        if (r) return Number(r.cpc)
      }
      return null
    }
    const sourcesAll = Array.from(new Set(rows.filter(r=>r.cpc!=null && r.src).map(r=>r.src)))
    const ordered = [
      ...sourcesAll.filter(isGoogle),
      ...sourcesAll.filter(isBing),
      ...sourcesAll.filter(s=>!isGoogle(s) && !isBing(s))
    ].slice(0,3)
    const list = ordered.map(s => ({ src: s, value: pickLatest(s) }))
    return list.filter(x => x.value!=null)
  }, [cpcSeries])

  const ecmpOptions = useMemo(() => ({
    chart: { type: 'area', height: 140, toolbar: { show: false }, zoom: { enabled: false }, animations: { enabled: true } },
    xaxis: { categories: ecpmSeries.map((x:any)=>x.day?.slice(0,10)), labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
    stroke: { curve: 'smooth', width: 2, dashArray: 0 },
    // 提高填充透明度，确保可见
    fill: { type:'gradient', gradient:{ shadeIntensity: 0.6, opacityFrom: 0.45, opacityTo: 0.12, stops: [0, 100] } },
    dataLabels: { enabled: false },
    markers: { size: 2, strokeWidth: 2, strokeColors: '#fff', colors: ['#fff'] },
    grid: { borderColor: '#E5E7EB', strokeDashArray: 0, yaxis: { lines: { show: true } }, xaxis: { lines: { show: false } } },
    legend: { show: false },
    tooltip: { shared: false, intersect: false, y: { formatter: (v:number)=> v==null? '—' : `$${Number(v).toFixed(2)}` } },
    yaxis: { labels: { show: false, formatter: (v:number)=> `$${Number(v||0).toFixed(2)}` } },
    colors: ['#FF7043'],
    series: [ { name: 'eCPM', type:'area', data: ecpmSeries.map((x:any)=> x.ecpm!=null ? Number(x.ecpm) : null) } ]
  }), [ecpmSeries])

  const smallEcpmOpt = useMemo(()=>({
    chart: { type:'area', height: 140, sparkline: { enabled: true } },
    stroke: { curve: 'smooth', width: 2 },
    colors: ['#FF7043'],
    series: [{ name:'eCPM', data: ecpmSeries.map((x:any)=> Number(x.ecpm||0)) }],
  }), [ecpmSeries])

  const ecpmSummary = useMemo(() => {
    let sum = 0, cnt = 0
    for (const x of ecpmSeries) {
      const v = x?.ecpm
      if (v==null) continue
      sum += Number(v); cnt++
    }
    return cnt? (sum/cnt) : null
  }, [ecpmSeries])

  

  function paginate<T>(rows: T[], page: number) {
    const total = rows.length
    const pages = Math.max(1, Math.ceil(total / pageSize))
    const p = Math.min(Math.max(1, page), pages)
    const start = (p-1)*pageSize
    const end = Math.min(start + pageSize, total)
    return { slice: rows.slice(start, end), total, pages, p, start: start+1, end }
  }

  function filterRows<T extends Record<string, any>>(rows: T[], term: string, key: string) {
    const q = (term||'').trim().toLowerCase()
    if (!q) return rows
    return rows.filter(r => String(r[key]||'unknown').toLowerCase().includes(q))
  }

  function PageNav({ p, pages, onChange, total, start, end }: {p:number; pages:number; onChange:(n:number)=>void; total:number; start:number; end:number}){
    const nums: number[] = []
    if (pages <= 10) {
      for (let i=1;i<=pages;i++) nums.push(i)
    } else {
      nums.push(1,2,3)
      nums.push(-1) // dots
      nums.push(pages-2, pages-1, pages)
    }
    return (
      <div className="pagination-container">
        <div className="pagination-info"><span className="page-info">Showing {start} to {end} of {total} entries</span></div>
        <nav className="pagination-nav">
          <ul className="pagination-list">
            <li className="page-item"><button className="page-link prev-btn" onClick={()=>onChange(Math.max(1, p-1))} disabled={p===1}>
              <svg className="page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,18 9,12 15,6"></polyline></svg>
              Previous
            </button></li>
            {nums.map((n,i)=> n===-1 ? (
              <li key={i} className="page-item dots"><span className="page-dots">...</span></li>
            ) : (
              <li key={i} className="page-item"><button className={`page-link page-number ${n===p?'active':''}`} onClick={()=>onChange(n)}>{n}</button></li>
            ))}
            <li className="page-item"><button className="page-link next-btn" onClick={()=>onChange(Math.min(pages, p+1))} disabled={p===pages}>
              Next
              <svg className="page-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9,18 15,12 9,6"></polyline></svg>
            </button></li>
          </ul>
        </nav>
      </div>
    )
  }

  function exportCsv(rows: any[], filename: string) {
    try {
      if (!rows || rows.length===0) return
      const cols = Object.keys(rows[0])
      const header = cols.join(',')
      const body = rows.map(r => cols.map(c => {
        const v = r[c]
        if (v==null) return ''
        const s = String(v)
        if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s.replace(/"/g,'""') + '"'
        return s
      }).join(',')).join('\n')
      const csv = header + '\n' + body
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  function sortRows<T extends Record<string, any>>(rows: T[], s: Sort) {
    const data = rows.slice()
    const { key, dir } = s
    data.sort((a,b) => {
      const va = a[key]; const vb = b[key]
      const na = typeof va === 'string' ? va.toLowerCase() : Number(va||0)
      const nb = typeof vb === 'string' ? vb.toLowerCase() : Number(vb||0)
      if (typeof na === 'string' && typeof nb === 'string') {
        return dir==='asc' ? (na<nb?-1:na>nb?1:0) : (na<nb?1:na>nb?-1:0)
      } else {
        return dir==='asc' ? (na as number) - (nb as number) : (nb as number) - (na as number)
      }
    })
    return data
  }

  function header(key: string, s: Sort, set: (n:Sort)=>void, label: string) {
    const active = s.key === key
    const dir = s.dir
    return (
      <div className={`table_h ${active?'active':''}`} onClick={()=> set({ key, dir: active && dir==='desc' ? 'asc' : active && dir==='asc' ? 'desc' : 'desc' })}>
        {label} <span className={`trk-sort ${active ? (dir==='asc'?'asc':'desc') : ''}`}/>
      </div>
    )
  }

  const kpiOptions = useMemo(() => ({
    chart: { type: 'line', height: 280 },
    xaxis: { categories: kpiSeries.map((x: any) => x.day?.slice(0,10)) },
    stroke: { curve: 'smooth' },
    yaxis: intYAxis(),
    series: [
      { name: 'Profit', type: 'line', data: kpiSeries.map((x: any) => Number(x.profit ?? 0)) },
      { name: 'ROI %', type: 'line', data: kpiSeries.map((x: any) => x.roi != null ? Number(x.roi) : null) },
      { name: 'CPC', type: 'line', data: kpiSeries.map((x: any) => x.cpc != null ? Number(x.cpc) : null) },
    ],
  }), [kpiSeries])

  const totals = useMemo(()=>{
    const impr = timeseries.reduce((s:any,x:any)=> s + Number(x.impressions||0), 0)
    const clicks = timeseries.reduce((s:any,x:any)=> s + Number(x.clicks||0), 0)
    const revenue = timeseries.reduce((s:any,x:any)=> s + Number(x.revenue||0), 0)
    const avgCtr = impr>0 ? (clicks/impr*100) : 0
    const avgEcpm = impr>0 ? (revenue/impr*1000) : 0
    return { impressions: impr, clicks, avgEcpm }
  }, [timeseries])

  return (
    <div className="min-h-screen bg-gray-50 pt-2 md:pt-3 px-4 md:px-5 pb-4 md:pb-5">
      <div className="max-w-7xl mx-auto space-y-6">
        {!sitesLoading && sites.length === 0 ? (
          <>
            <header className="space-y-3">
              <div className="trk-toolbar">
                <h1 className="trk-page-title">Report</h1>
              </div>
            </header>
            <div className="border-l-4 p-3 rounded bg-blue-50 border-blue-400 flex items-center justify-between">
              <div className="text-sm text-gray-800">暂无站点数据。请先上传 CSV（支持 ADX/Offer/Yahoo/成本）写入数据库。</div>
              <a href="/upload" className="px-3 py-1 bg-blue-600 text-white rounded">前往上传</a>
            </div>
          </>
        ) : (
          <>
        <header className="space-y-2">
          <div className="trk-toolbar">
            <h1 className="trk-page-title">Report</h1>
            <div className="ml-auto">
              <DateRangeBar
                range={range}
                onChange={setRange}
                showCompare={false}
                site={site}
                extraLeft={
                  <div className="flex items-center gap-2">
                    <span className="mm_title">Website:</span>
                    <select className="border rounded px-3 py-2" value={site} onChange={e => {
                      const val = e.target.value
                      setSite(val)
                      const url = new URL(window.location.href)
                      url.searchParams.set('sites', val)
                      url.searchParams.set('range', `${range.from} - ${range.to}`)
                      window.history.replaceState({}, '', url)
                    }}>
                      {sites.map(s => <option key={s.id} value={s.domain}>{s.domain}</option>)}
                    </select>
                  </div>
                }
              />
            </div>
          </div>
        </header>
        {/* KPI 三卡（移动到左侧列顶部） — 放在左右布局里 */}
        {!sitesLoading && sites.length>0 && !loading && (noData || loadError) && (
          <div className={`border-l-4 p-3 rounded ${loadError ? 'bg-red-50 border-red-400' : 'bg-blue-50 border-blue-400'}`} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div className="text-sm text-gray-800">
              {loadError ? '部分数据接口加载失败，已为你显示可用数据。' : '所选时间范围内未检测到任何数据，请调整时间范围或上传数据。'}
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 border rounded" onClick={()=>setRange(defaultLast30())}>重置为最近30天</button>
              <a href="/upload" className="px-3 py-1 bg-blue-600 text-white rounded">前往上传</a>
            </div>
          </div>
        )}

        {loading && (
          <div className="space-y-4">
            <div className="trk-kpi-row">
              <div className="trk-kpi-tile"><div className="skeleton skeleton-line w-24"></div><div className="skeleton skeleton-line w-32 mt-2"></div></div>
              <div className="trk-kpi-tile"><div className="skeleton skeleton-line w-24"></div><div className="skeleton skeleton-line w-32 mt-2"></div></div>
              <div className="trk-kpi-tile"><div className="skeleton skeleton-line w-24"></div><div className="skeleton skeleton-line w-32 mt-2"></div></div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="trk-card skeleton skeleton-lg"></div>
              <div className="trk-card skeleton skeleton-lg"></div>
            </div>
            <div className="trk-card skeleton skeleton-lg"></div>
          </div>
        )}

        {/* 注意：报告页不展示顶部四张汇总卡（Total Revenue/Cost/Profit/ROI）。 */}

        {/* 左右布局 */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
          {/* 左侧两列：三卡 + 指标条 + 时序（合并于一个卡片中，贴近截图） */}
          <div className="xl:col-span-2 space-y-6">
            {/* KPI 三卡（Today/Last 7 Day/Yesterday）置于左侧 */}
            <div className="trk-kpi-row">
              <div className="trk-kpi-tile primary">
                <div className="mm_title">Today</div>
                <div className="cart_i_d flex items-center gap-2">
                  <div className="kpi-icon kpi-blue"><svg viewBox="0 0 1024 1024" width="16" height="16"><path d="M534.08 448C404.8 416 363.2 384 363.2 327.04s57.6-104.96 153.6-104.96 138.88 48.64 142.08 119.68h128a226.56 226.56 0 0 0-184.32-216.96V0H431.68v122.88C321.6 146.56 232.64 218.24 232.64 328.32c0 131.2 108.8 197.12 267.52 234.88C642.24 597.12 670.4 647.68 670.4 700.16c0 39.04-28.16 101.76-153.6 101.76s-163.2-51.84-166.4-119.04H222.4a238.08 238.08 0 0 0 209.28 217.6V1024h170.88v-122.24C713.28 880.64 798.4 816.64 798.4 699.52 798.4 538.24 663.36 483.2 534.08 448z" fill="#86BEEE"></path></svg></div>
                  <span>${Number(siteKpi.today||0).toFixed(2)}</span>
                </div>
              </div>
              <div className="trk-kpi-tile primary">
                <div className="mm_title">Last 7 Day</div>
                <div className="cart_i_d flex items-center gap-2">
                  <div className="kpi-icon kpi-teal"><svg viewBox="0 0 1024 1024" width="16" height="16"><path d="M710.8 534.9c-19.1 0-34.6 15.5-34.6 34.6s15.5 34.6 34.6 34.6 34.6-15.5 34.6-34.6-15.5-34.6-34.6-34.6z" fill="#35BDAA"></path><path d="M512 96c229.76 0 416 186.24 416 416S741.76 928 512 928 96 741.76 96 512 282.24 96 512 96z m0 64C317.589333 160 160 317.589333 160 512S317.589333 864 512 864 864 706.410667 864 512 706.410667 160 512 160z m32 97.216l0.021333 75.477333c73.706667 9.152 126.101333 48.853333 128.64 105.6l0.106667 4.373334h-64c0-24.661333-36.266667-48-98.133333-48-62.912 0-98.133333 19.712-98.133334 48 0 25.386667 30.741333 46.592 91.946667 47.914666l6.186667 0.085334c96.469333 0 162.133333 43.541333 162.133333 112 0 64.512-52.693333 101.994667-128.746667 110.250666l-0.021333 76.544h-64V712.96c-75.114667-8.533333-128.810667-48.533333-131.392-105.962667l-0.085333-4.373333h64c0 24.661333 36.309333 48.021333 98.133333 48.021333 62.890667 0 98.133333-19.733333 98.133333-48 0-25.386667-30.72-46.592-91.925333-47.936l-12.458667-0.128c-93.056-1.856-155.882667-44.992-155.882666-111.936 0-65.301333 53.973333-102.890667 131.498666-110.549333l-0.021333-74.901333h64z" fill="#35BDAA"></path></svg></div>
                  <span>${Number(siteKpi.last7||0).toFixed(2)}</span>
                </div>
              </div>
              <div className="trk-kpi-tile primary">
                <div className="mm_title">Yesterday</div>
                <div className="cart_i_d flex items-center gap-2">
                  <div className="kpi-icon kpi-amber"><svg viewBox="0 0 1024 1024" width="16" height="16"><path d="M534.08 448C404.8 416 363.2 384 363.2 327.04s57.6-104.96 153.6-104.96 138.88 48.64 142.08 119.68h128a226.56 226.56 0 0 0-184.32-216.96V0H431.68v122.88C321.6 146.56 232.64 218.24 232.64 328.32c0 131.2 108.8 197.12 267.52 234.88C642.24 597.12 670.4 647.68 670.4 700.16c0 39.04-28.16 101.76-153.6 101.76s-163.2-51.84-166.4-119.04H222.4a238.08 238.08 0 0 0 209.28 217.6V1024h170.88v-122.24C713.28 880.64 798.4 816.64 798.4 699.52 798.4 538.24 663.36 483.2 534.08 448z" fill="#FFB748"></path></svg></div>
                  <span>${Number(siteKpi.yesterday||0).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <div className="trk-card">
              {/* 指标条 */}
              <div className="trk-metrics-bar">
                <div><div className="label">Impressions</div><div className="value">{Number(totals.impressions||0).toLocaleString()}</div></div>
                <div><div className="label">Clicks</div><div className="value">{Number(totals.clicks||0).toLocaleString()}</div></div>
                <div><div className="label">eCPM</div><div className="value">${Number(totals.avgEcpm||0).toFixed(2)}</div></div>
              </div>
              {/* 时序 */}
              <div className="trk-card-head mt-2"><div className="trk-card-title">Total Revenue, eCPM, Clicks, and Impressions Over Time</div><button className="trk-card-action" onClick={()=>setEditorKey('report.timeseries')}>编辑查询</button></div>
              {typeof window !== 'undefined' && (
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                <ApexChart
                  key={`ts-${site}-${range.from}-${range.to}-${timeseries.length}`}
                  options={tsOptions}
                  series={tsOptions.series}
                  type="line"
                  height={280}
                />
              )}
              {isDebug && (
                <div className="text-xs text-gray-500 mt-2">
                  调试：points={timeseries.length} · days=[{timeseries.slice(0,3).map((x:any)=>String(x.day).slice(0,10)).join(', ')}...] · first={JSON.stringify({ revenue: Number(timeseries[0]?.revenue||0), clicks: Number(timeseries[0]?.clicks||0), impressions: Number(timeseries[0]?.impressions||0) })}
                </div>
              )}
            </div>
          </div>
          {/* 右侧：Profit/Revenue/Cost */}
          <div className="xl:col-span-1 flex flex-col gap-4 h-full">
            <div ref={profitCardRef} className="trk-card trk-profit-card flex flex-col flex-1 relative">
              {(() => {
                const profit = Number(summaryCards.profit||0)
                const sign = profit>=0 ? '+' : ''
                const roiVal = (summaryCards.roi!=null)
                  ? Number(summaryCards.roi)
                  : (Number(summaryCards.cost||0)>0 ? (Number(summaryCards.revenue||0)/Number(summaryCards.cost||0)*100) : 0)
                const p = Math.max(0, Math.min(100, roiVal))
                return (
                  <>
                    <div className="trk-card-head"><div className="trk-card-title">Profit</div><button className="trk-card-action absolute top-2 right-2" onClick={()=>setEditorKey('report.summary')}>编辑查询</button></div>
                    <div className="flex flex-col items-center justify-center gap-3 flex-1">
                      <div className="text-2xl font-bold">{sign}{formatCurrency(Math.abs(profit))}</div>
                      <div className="trk-ring" style={{ ['--p' as any]: p, width: ringSize, height: ringSize }}>
                        <div className="trk-ring-text">{roiVal.toFixed(2)}%</div>
                        <div className="trk-ring-label">ROI</div>
                      </div>
                    </div>
                  </>
                )
              })()}
            </div>
            <div className="trk-mini-tile success">
              <div className="ti_left revenue" />
              <div className="ti_right">
                <div className="fontw">{formatCurrency(Number(summaryCards.revenue||0))}</div>
                <div className="m_fontw">ADX Revenue {`+${Number(summaryCards.adx||0).toFixed(2)}$`} · Offer {`+${Number(summaryCards.offer||0).toFixed(2)}$`}</div>
              </div>
              <button className="trk-card-action ml-auto" onClick={()=>setEditorKey('report.summary')}>编辑查询</button>
            </div>
            <div className="trk-mini-tile warning">
              <div className="ti_left cost" />
              <div className="ti_right">
                <div className="fontw">{formatCurrency(Number(summaryCards.cost||0))}</div>
                <div className="m_fontw">Google Ads Cost {costs? `- $${Number(costs.google||0).toFixed(2)}`:'—'} · Bing Ads Cost {costs? `- $${Number(costs.bing||0).toFixed(2)}`:'—'}</div>
              </div>
              <button className="trk-card-action ml-auto" onClick={()=>setEditorKey('report.summary')}>编辑查询</button>
            </div>
          </div>
        </div>

        {/* 设备与浏览器分布（并排饼图） */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="trk-card">
            <div className="trk-card-head"><div className="trk-card-title">Device Type（Only ADX）</div><button className="trk-card-action" onClick={()=>setEditorKey('report.device_browser')}>编辑查询</button></div>
            {typeof window !== 'undefined' && deviceAgg.labels.length>0 ? (
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              <ApexChart options={donutOptionsRight(deviceAgg.labels, deviceAgg.series)} series={deviceAgg.series} type="donut" height={280} />
            ) : (
              <div className="text-sm text-gray-500">暂无设备维度数据（Only ADX），可点击右上角编辑查询。</div>
            )}
          </div>
          <div className="trk-card">
            <div className="trk-card-head"><div className="trk-card-title">Browser Type（Only ADX）</div><button className="trk-card-action" onClick={()=>setEditorKey('report.device_browser')}>编辑查询</button></div>
            {typeof window !== 'undefined' && broDonut.labels.length>0 ? (
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              <ApexChart options={donutOptionsRight(broDonut.labels, broDonut.series)} series={broDonut.series} type="donut" height={280} />
            ) : (
              <div className="text-sm text-gray-500">暂无浏览器维度数据（Only ADX），可点击右上角编辑查询。</div>
            )}
          </div>
        </div>

        <div className="trk-card">
          <div className="trk-card-head"><div className="trk-card-title">Profit / ROI / CPC（按日）</div><div className="flex items-center gap-3"><button className="trk-card-action" onClick={()=>exportCsv(kpiSeries, 'report_kpi_series.csv')}>导出 CSV</button><button className="trk-card-action" onClick={()=>setEditorKey('report.kpi_series')}>编辑查询</button></div></div>
          {missingKpiCosts && <div className="trk-note mb-2">未检测到成本维度（例如 ad_costs），ROI/CPC 指标可能为空。</div>}
          {typeof window !== 'undefined' && (kpiSeries.length>0 ? (
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            <ApexChart options={kpiOptions} series={kpiOptions.series} type="line" height={280} />
          ) : (
            <div className="text-sm text-gray-500">暂无 Profit/ROI/CPC 时序数据（可点击右上角编辑查询）。</div>
          ))}
        </div>

        {/* CPC / eCPM 单独折线图（贴合参考 UI） */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="trk-card relative">
            <button className="trk-card-action absolute top-2 right-2" onClick={()=>setEditorKey('report.cpc_series')}>编辑查询</button>
            {missingCpcCosts && <div className="trk-note mb-2">未检测到成本维度（ad_costs），CPC 指标无法计算。</div>}
            <div className="flex flex-col md:flex-row items-stretch gap-4 h-[140px]">
              <div className="trk-cpc-card w-full md:w-1/3 h-[140px]">
                <div className="trk-cpc-label">CPC</div>
                <div className="space-y-3 mt-3">
                  {cpcSummaryList.length>0 ? (
                    cpcSummaryList.map((it,idx) => (
                      <div key={idx} className="trk-cpc-item">
                        {(/google|adwords|ads/.test(it.src)) && (<span className="cpc-icon google" />)}
                        {(/bing|microsoft/.test(it.src)) && (<span className="cpc-icon bing" />)}
                        {(!/google|adwords|ads|bing|microsoft/.test(it.src)) && (<span className="cpc-badge">{it.src.toUpperCase()}</span>)}
                        <span>{`$${Number(it.value).toFixed(2)}`}</span>
                      </div>
                    ))
                  ) : (
                    <div className="text-white/80 text-sm">—</div>
                  )}
                </div>
              </div>
              <div className="flex-1 min-w-0 w-full md:w-2/3">
                {typeof window !== 'undefined' && (
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  <ApexChart options={cpcOptions} series={cpcOptions.series} type="area" height={140} />
                )}
              </div>
            </div>
            {(cpcSummaryList.length===0) && (
              <div className="text-xs text-gray-500 mt-2">暂无 CPC 数据。请确认所选站点/时间范围内存在 ad_costs 数据，并包含 Google 或 Bing 渠道。</div>
            )}
          </div>
          <div className="trk-card relative">
            <button className="trk-card-action absolute top-2 right-2" onClick={()=>setEditorKey('report.ecpm_series')}>编辑查询</button>
            <div className="flex flex-col md:flex-row items-stretch gap-4 h-[140px]">
              <div className="trk-ecpm-card w-full md:w-1/3 h-[140px]">
                <div className="trk-ecpm-label"><span className="ecpm-icon adx" /> eCPM</div>
                <div className="trk-ecpm-value">{ecpmSummary!=null? `$${ecpmSummary.toFixed(2)}`:'—'}</div>
              </div>
              <div className="flex-1 min-w-0 w-full md:w-2/3">
                {typeof window !== 'undefined' && (
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  <ApexChart options={ecmpOptions} series={ecmpOptions.series} type="area" height={140} />
                )}
              </div>
            </div>
          </div>
          
        </div>

        <div className="trk-card">
          <div className="trk-card-head"><div className="trk-card-title">Top Countries（含分摊成本）</div><div className="flex items-center gap-3"><button className="trk-card-action" onClick={()=>{ const p=paginate(sortRows(countries, sortCountry), pageCountry); exportCsv(p.slice, 'report_countries.csv') }}>导出 CSV</button><button className="trk-card-action" onClick={()=>setEditorKey('report.country_table_kpi')}>编辑查询</button></div></div>
          {(() => { try { const allNoCost = (countries||[]).length>0 && countries.every((r:any)=> r==null || (r.cost==null && r.cpc==null && r.roi==null)); if (missingCountryCosts || allNoCost) return <div className="trk-note mb-2">未检测到成本维度（例如 ad_costs），Cost/ROI/CPC 列为空或未启用 KPI 查询。</div>; } catch {} return null })()}
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between mb-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="筛选 Country" value={filterCountry} onChange={e=>{ setFilterCountry(e.target.value); setPageCountry(1) }} />
              <div />
            </div>
            <table className="trk-table min-w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-4">{header('country', sortCountry, setSortCountry, 'Country')}</th>
                  <th className="py-2 pr-4">{header('impressions', sortCountry, setSortCountry, 'Impr')}</th>
                  <th className="py-2 pr-4">{header('clicks', sortCountry, setSortCountry, 'Clicks')}</th>
                  <th className="py-2 pr-4">{header('ctr', sortCountry, setSortCountry, 'CTR')}</th>
                  <th className="py-2 pr-4">{header('ecpm', sortCountry, setSortCountry, 'eCPM')}</th>
                  <th className="py-2 pr-4">{header('revenue', sortCountry, setSortCountry, 'Revenue')}</th>
                  <th className="py-2 pr-4">{header('cost', sortCountry, setSortCountry, 'Cost')}</th>
                  <th className="py-2 pr-4">{header('cpc', sortCountry, setSortCountry, 'CPC')}</th>
                  <th className="py-2 pr-4">{header('roi', sortCountry, setSortCountry, 'ROI')}</th>
                </tr>
              </thead>
              <tbody>
                {paginate(sortRows(filterRows(countries, filterCountry, 'country'), sortCountry), pageCountry).slice.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 pr-4"><a className="text-blue-600 hover:underline" href={`/analytics?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`}>{r.country || 'Unknown'}</a></td>
                    <td className="py-2 pr-4">{Number(r.impressions).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Number(r.clicks).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Number(r.ctr).toFixed(2)}%</td>
                    <td className="py-2 pr-4">${Number(r.ecpm).toFixed(2)}</td>
                    <td className="py-2 pr-4">${Number(r.revenue).toFixed(2)}</td>
                    <td className="py-2 pr-4">{r.cost!=null? `$${Number(r.cost).toFixed(2)}`:'—'}</td>
                    <td className="py-2 pr-4">{r.cpc!=null? `$${Number(r.cpc).toFixed(4)}`:'—'}</td>
                    <td className="py-2 pr-4">{r.roi!=null? `${Number(r.roi).toFixed(2)}%`:'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="trk-subtle mt-2">注：成本按日按收入占比分摊，作为近似指标。</div>
          {(() => { const p=paginate(filterRows(countries, filterCountry, 'country'),pageCountry); return <PageNav p={p.p} pages={p.pages} onChange={setPageCountry} total={p.total} start={p.start} end={p.end} /> })()}
        </div>

        <div className="trk-card">
          <div className="trk-card-head"><div className="trk-card-title">Top Browsers（含分摊成本）</div><div className="flex items-center gap-3"><button className="trk-card-action" onClick={()=>{ const p=paginate(sortRows(browsersKpi, sortBrowser), pageBrowser); exportCsv(p.slice, 'report_browsers.csv') }}>导出 CSV</button><button className="trk-card-action" onClick={()=>setEditorKey('report.browser_table_kpi')}>编辑查询</button></div></div>
          {(() => { try { const allNoCost = (browsersKpi||[]).length>0 && browsersKpi.every((r:any)=> r==null || (r.cost==null && r.cpc==null && r.roi==null)); if (missingBrowserCosts || allNoCost) return <div className="trk-note mb-2">未检测到成本维度（例如 ad_costs），Cost/ROI/CPC 列为空或未启用 KPI 查询。</div>; } catch {} return null })()}
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between mb-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="筛选 Browser" value={filterBrowser} onChange={e=>{ setFilterBrowser(e.target.value); setPageBrowser(1) }} />
              <div />
            </div>
            <table className="trk-table min-w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-4">{header('browser', sortBrowser, setSortBrowser, 'Browser')}</th>
                  <th className="py-2 pr-4">{header('impressions', sortBrowser, setSortBrowser, 'Impr')}</th>
                  <th className="py-2 pr-4">{header('clicks', sortBrowser, setSortBrowser, 'Clicks')}</th>
                  <th className="py-2 pr-4">{header('ctr', sortBrowser, setSortBrowser, 'CTR')}</th>
                  <th className="py-2 pr-4">{header('ecpm', sortBrowser, setSortBrowser, 'eCPM')}</th>
                  <th className="py-2 pr-4">{header('revenue', sortBrowser, setSortBrowser, 'Revenue')}</th>
                  <th className="py-2 pr-4">{header('cost', sortBrowser, setSortBrowser, 'Cost')}</th>
                  <th className="py-2 pr-4">{header('cpc', sortBrowser, setSortBrowser, 'CPC')}</th>
                  <th className="py-2 pr-4">{header('roi', sortBrowser, setSortBrowser, 'ROI')}</th>
                </tr>
              </thead>
              <tbody>
                {paginate(sortRows(filterRows(browsersKpi, filterBrowser, 'browser'), sortBrowser), pageBrowser).slice.map((r:any, i:number) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 pr-4"><a className="text-blue-600 hover:underline" href={`/analytics-enhanced?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`}>{r.browser || 'Unknown'}</a></td>
                    <td className="py-2 pr-4">{Number(r.impressions).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Number(r.clicks).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Number(r.ctr).toFixed(2)}%</td>
                    <td className="py-2 pr-4">${Number(r.ecpm).toFixed(2)}</td>
                    <td className="py-2 pr-4">${Number(r.revenue).toFixed(2)}</td>
                    <td className="py-2 pr-4">{r.cost!=null? `$${Number(r.cost).toFixed(2)}`:'—'}</td>
                    <td className="py-2 pr-4">{r.cpc!=null? `$${Number(r.cpc).toFixed(4)}`:'—'}</td>
                    <td className="py-2 pr-4">{r.roi!=null? `${Number(r.roi).toFixed(2)}%`:'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="trk-subtle mt-2">注：成本按日按收入占比分摊，作为近似指标。</div>
          {(() => { const p=paginate(filterRows(browsersKpi, filterBrowser, 'browser'),pageBrowser); return <PageNav p={p.p} pages={p.pages} onChange={setPageBrowser} total={p.total} start={p.start} end={p.end} /> })()}
        </div>

        <div className="trk-card">
          <div className="trk-card-head"><div className="trk-card-title">Top Ad Units（含分摊成本）</div><div className="flex items-center gap-3"><button className="trk-card-action" onClick={()=>{ const p=paginate(sortRows(adunitsKpi, sortAdunit), pageAdunit); exportCsv(p.slice, 'report_adunits.csv') }}>导出 CSV</button><button className="trk-card-action" onClick={()=>setEditorKey('report.adunit_table_kpi')}>编辑查询</button></div></div>
          {(() => { try { const allNoCost = (adunitsKpi||[]).length>0 && adunitsKpi.every((r:any)=> r==null || (r.cost==null && r.cpc==null && r.roi==null)); if (missingAdunitCosts || allNoCost) return <div className="trk-note mb-2">未检测到成本维度（例如 ad_costs），Cost/ROI/CPC 列为空或未启用 KPI 查询。</div>; } catch {} return null })()}
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between mb-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="筛选 AdUnit" value={filterAdunit} onChange={e=>{ setFilterAdunit(e.target.value); setPageAdunit(1) }} />
              <div />
            </div>
            <table className="trk-table min-w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-4">{header('adunit', sortAdunit, setSortAdunit, 'AdUnit')}</th>
                  <th className="py-2 pr-4">{header('impressions', sortAdunit, setSortAdunit, 'Impr')}</th>
                  <th className="py-2 pr-4">{header('clicks', sortAdunit, setSortAdunit, 'Clicks')}</th>
                  <th className="py-2 pr-4">{header('ctr', sortAdunit, setSortAdunit, 'CTR')}</th>
                  <th className="py-2 pr-4">{header('ecpm', sortAdunit, setSortAdunit, 'eCPM')}</th>
                  <th className="py-2 pr-4">{header('revenue', sortAdunit, setSortAdunit, 'Revenue')}</th>
                  <th className="py-2 pr-4">{header('cost', sortAdunit, setSortAdunit, 'Cost')}</th>
                  <th className="py-2 pr-4">{header('cpc', sortAdunit, setSortAdunit, 'CPC')}</th>
                  <th className="py-2 pr-4">{header('roi', sortAdunit, setSortAdunit, 'ROI')}</th>
                </tr>
              </thead>
              <tbody>
                {paginate(sortRows(filterRows(adunitsKpi, filterAdunit, 'adunit'), sortAdunit), pageAdunit).slice.map((r:any, i:number) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 pr-4"><a className="text-blue-600 hover:underline" href={`/analytics-enhanced?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`}>{r.adunit || r.adUnit || 'Unknown'}</a></td>
                    <td className="py-2 pr-4">{Number(r.impressions).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Number(r.clicks).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Number(r.ctr).toFixed(2)}%</td>
                    <td className="py-2 pr-4">${Number(r.ecpm).toFixed(2)}</td>
                    <td className="py-2 pr-4">${Number(r.revenue).toFixed(2)}</td>
                    <td className="py-2 pr-4">{r.cost!=null? `$${Number(r.cost).toFixed(2)}`:'—'}</td>
                    <td className="py-2 pr-4">{r.cpc!=null? `$${Number(r.cpc).toFixed(4)}`:'—'}</td>
                    <td className="py-2 pr-4">{r.roi!=null? `${Number(r.roi).toFixed(2)}%`:'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="trk-subtle mt-2">注：成本按日按收入占比分摊，作为近似指标。</div>
          {(() => { const p=paginate(filterRows(adunitsKpi, filterAdunit, 'adunit'),pageAdunit); return <PageNav p={p.p} pages={p.pages} onChange={setPageAdunit} total={p.total} start={p.start} end={p.end} /> })()}
        </div>

        

        <div className="trk-card">
          <div className="trk-card-head"><div className="trk-card-title">Top Devices（含分摊成本）</div><div className="flex items-center gap-3"><button className="trk-card-action" onClick={()=>{ const p=paginate(sortRows(devicesKpi, sortDevice), pageDevice); exportCsv(p.slice, 'report_devices.csv') }}>导出 CSV</button><button className="trk-card-action" onClick={()=>setEditorKey('report.device_table_kpi')}>编辑查询</button></div></div>
          {(() => { try { const allNoCost = (devicesKpi||[]).length>0 && devicesKpi.every((r:any)=> r==null || (r.cost==null && r.cpc==null && r.roi==null)); if (missingDeviceCosts || allNoCost) return <div className="trk-note mb-2">未检测到成本维度（例如 ad_costs），Cost/ROI/CPC 列为空或未启用 KPI 查询。</div>; } catch {} return null })()}
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between mb-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="筛选 Device" value={filterDevice} onChange={e=>{ setFilterDevice(e.target.value); setPageDevice(1) }} />
              <div />
            </div>
            <table className="min-w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-4">{header('device', sortDevice, setSortDevice, 'Device')}</th>
                  <th className="py-2 pr-4">{header('impressions', sortDevice, setSortDevice, 'Impr')}</th>
                  <th className="py-2 pr-4">{header('clicks', sortDevice, setSortDevice, 'Clicks')}</th>
                  <th className="py-2 pr-4">{header('ctr', sortDevice, setSortDevice, 'CTR')}</th>
                  <th className="py-2 pr-4">{header('ecpm', sortDevice, setSortDevice, 'eCPM')}</th>
                  <th className="py-2 pr-4">{header('revenue', sortDevice, setSortDevice, 'Revenue')}</th>
                  <th className="py-2 pr-4">{header('cost', sortDevice, setSortDevice, 'Cost')}</th>
                  <th className="py-2 pr-4">{header('cpc', sortDevice, setSortDevice, 'CPC')}</th>
                  <th className="py-2 pr-4">{header('roi', sortDevice, setSortDevice, 'ROI')}</th>
                </tr>
              </thead>
              <tbody>
                {paginate(sortRows(filterRows(devicesKpi, filterDevice, 'device'), sortDevice), pageDevice).slice.map((r:any, i:number) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 pr-4">{r.device || 'Unknown'}</td>
                    <td className="py-2 pr-4">{String(r.impressions)}</td>
                    <td className="py-2 pr-4">{String(r.clicks)}</td>
                    <td className="py-2 pr-4">{Number(r.ctr).toFixed(2)}%</td>
                    <td className="py-2 pr-4">${Number(r.ecpm).toFixed(2)}</td>
                    <td className="py-2 pr-4">${Number(r.revenue).toFixed(2)}</td>
                    <td className="py-2 pr-4">{r.cost!=null? `$${Number(r.cost).toFixed(2)}`:'—'}</td>
                    <td className="py-2 pr-4">{r.cpc!=null? `$${Number(r.cpc).toFixed(4)}`:'—'}</td>
                    <td className="py-2 pr-4">{r.roi!=null? `${Number(r.roi).toFixed(2)}%`:'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="trk-subtle mt-2">注：成本按日按收入占比分摊，作为近似指标。</div>
          {(() => { const p=paginate(filterRows(devicesKpi, filterDevice, 'device'),pageDevice); return <PageNav p={p.p} pages={p.pages} onChange={setPageDevice} total={p.total} start={p.start} end={p.end} /> })()}
        </div>
        {/* 顶部 Advertisers 表：添加筛选与导出 */}
        <div className="trk-card">
          <div className="trk-card-head"><div className="trk-card-title">Top Advertisers（含分摊成本）</div><div className="flex items-center gap-3"><button className="trk-card-action" onClick={()=>{ exportCsv(advertisersKpi, 'report_advertisers.csv') }}>导出 CSV</button><button className="trk-card-action" onClick={()=>setEditorKey('report.advertiser_table_kpi')}>编辑查询</button></div></div>
          {(() => { try { const allNoCost = (advertisersKpi||[]).length>0 && advertisersKpi.every((r:any)=> r==null || (r.cost==null && r.cpc==null && r.roi==null)); if (missingAdvertiserCosts || allNoCost) return <div className="trk-note mb-2">未检测到成本维度（例如 ad_costs），Cost/ROI/CPC 列为空或未启用 KPI 查询。</div>; } catch {} return null })()}
          <div className="overflow-x-auto">
            <div className="flex items-center justify-between mb-2">
              <input className="border rounded px-2 py-1 text-sm" placeholder="筛选 Advertiser" value={filterAdvertiser} onChange={e=> setFilterAdvertiser(e.target.value)} />
              <div />
            </div>
            <table className="trk-table min-w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Advertiser</th>
                  <th className="py-2 pr-4">Impr</th>
                  <th className="py-2 pr-4">Clicks</th>
                  <th className="py-2 pr-4">CTR</th>
                  <th className="py-2 pr-4">eCPM</th>
                  <th className="py-2 pr-4">Revenue</th>
                  <th className="py-2 pr-4">Cost</th>
                  <th className="py-2 pr-4">CPC</th>
                  <th className="py-2 pr-4">ROI</th>
                </tr>
              </thead>
              <tbody>
                {advertisersKpi.filter(r=> String(r.advertiser||'').toLowerCase().includes(filterAdvertiser.trim().toLowerCase())).map((r:any, i:number) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 pr-4"><a className="text-blue-600 hover:underline" href={`/analytics-enhanced?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`}>{r.advertiser || 'Unknown'}</a></td>
                    <td className="py-2 pr-4">{Number(r.impressions).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Number(r.clicks).toLocaleString()}</td>
                    <td className="py-2 pr-4">{Number(r.ctr).toFixed(2)}%</td>
                    <td className="py-2 pr-4">${Number(r.ecpm).toFixed(2)}</td>
                    <td className="py-2 pr-4">${Number(r.revenue).toFixed(2)}</td>
                    <td className="py-2 pr-4">{r.cost!=null? `$${Number(r.cost).toFixed(2)}`:'—'}</td>
                    <td className="py-2 pr-4">{r.cpc!=null? `$${Number(r.cpc).toFixed(4)}`:'—'}</td>
                    <td className="py-2 pr-4">{r.roi!=null? `${Number(r.roi).toFixed(2)}%`:'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between mt-2">
            <div className="trk-subtle">注：成本按日按收入占比分摊，作为近似指标。</div>
          </div>
        </div>

        {/* 统一放置查询编辑器 */}
        <ChartQueryEditorModal open={!!editorKey} chartKey={editorKey} onClose={()=>setEditorKey(null)} />
          </>
        )}
      </div>
    </div>
  )
}

function defaultLast30() {
  const to = new Date()
  const from = new Date(); from.setDate(from.getDate()-30)
  const f = (d: Date) => d.toISOString().slice(0,10)
  return { from: f(from), to: f(to) }
}

function previousRange(r: {from:string; to:string}) {
  const from = new Date(r.from)
  const to = new Date(r.to)
  const days = Math.max(1, Math.round((to.getTime()-from.getTime())/86400000) + 1)
  const prevTo = new Date(from); prevTo.setDate(prevTo.getDate()-1)
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate()-(days-1))
  const fmt = (d: Date) => d.toISOString().slice(0,10)
  return { from: fmt(prevFrom), to: fmt(prevTo) }
}
