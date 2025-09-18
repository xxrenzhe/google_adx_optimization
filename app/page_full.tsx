"use client"

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import DateRangeBar, { DateRange } from '@/components/DateRangeBar'
import ChartQueryEditorModal from '@/components/ChartQueryEditorModal'
import { baseOptions, donutOptions } from '@/lib/chart-theme'
import { formatCurrency } from '@/lib/utils'

const ApexChart: any = dynamic(() => import('react-apexcharts') as any, { ssr: false }) as any

export default function HomePage() {
  const [range, setRange] = useState<DateRange>(() => defaultLast30())

  // Series & tables
  const [summary, setSummary] = useState<any[]>([])
  // 不再使用对比序列
  const [offer, setOffer] = useState<any[]>([])
  const [yahoo, setYahoo] = useState<any[]>([])
  const [topDomains, setTopDomains] = useState<any[]>([])
  const [topBreakdown, setTopBreakdown] = useState<Record<string, { adx_revenue?: number; offer_revenue?: number; google_cost?: number; bing_cost?: number }>>({})
  // 数据缺失提示（可选表）
  const [missingOffer, setMissingOffer] = useState(false)
  const [missingYahoo, setMissingYahoo] = useState(false)
  const [missingCosts, setMissingCosts] = useState(false)
  // Top Domains 排序与分页
  type Sort = { key: string; dir: 'asc'|'desc' }
  const [sortTop, setSortTop] = useState<Sort>({ key: 'revenue', dir: 'desc' })
  const [pageTop, setPageTop] = useState(1)
  const pageSizeTop = 15
  // Top Domains 关键词筛选
  const [filterDomain, setFilterDomain] = useState('')
  // Top Domains 展开行
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggleExpand = (w: string) => setExpanded(x => ({ ...x, [w]: !x[w] }))
  // 盈利筛选（小优化）
  const [onlyProfit, setOnlyProfit] = useState(false)
  // Classified Advertiser
  const [classified, setClassified] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [noData, setNoData] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [editorKey, setEditorKey] = useState<string|null>(null)

  // KPIs
  const [kpi, setKpi] = useState<{today:number; last7:number; yesterday:number}>({today:0,last7:0,yesterday:0})
  const [summaryAll, setSummaryAll] = useState<{ revenue:number; cost:number; profit:number; roi:number|null; cpc:number|null }>({ revenue:0, cost:0, profit:0, roi:null, cpc:null })

  const totalADX = useMemo(() => summary.reduce((s:any,x:any)=>s+Number(x.revenue||0),0), [summary])
  const totalOffer = useMemo(() => offer.reduce((s:any,x:any)=>s+Number(x.revenue||0),0), [offer])
  const totalYahoo = useMemo(() => yahoo.reduce((s:any,x:any)=>s+Number(x.revenue||0),0), [yahoo])

  useEffect(() => {
    setLoading(true)
    let hadError = false
    const safe = (p: Promise<Response>) => p.then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() }).catch(() => { hadError = true; return { data: [] } })
    const safeK = (p: Promise<Response>, fallback: any) => p.then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() }).catch(() => { hadError = true; return { data: fallback } })
    Promise.all([
      safe(fetch(`/api/charts?key=home.benefit_summary&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=home.top_domains_kpi&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=home.top_domains_breakdown&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=home.offer_by_day&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=home.yahoo_by_day&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=home.classified_advertiser&from=${range.from}&to=${range.to}`)),
      safeK(fetch(`/api/home/kpi`), { today:0,last7:0,yesterday:0 }),
      safeK(fetch(`/api/home/summary?from=${range.from}&to=${range.to}`), { revenue:0,cost:0,profit:0,roi:null,cpc:null }),
    ]).then(([s, t, tb, o, y, ca, k, sum]) => {
      setSummary(s.data || [])
      setTopDomains(t.data || [])
      const m: Record<string, any> = {}
      ;(tb.data||[]).forEach((row: any) => { if (row?.website) m[row.website] = row })
      setTopBreakdown(m)
      setOffer(o.data || [])
      setYahoo(y.data || [])
      setClassified(ca.data || [])
      if (k.data) setKpi(k.data)
      if (sum.data) setSummaryAll(sum.data)
      // 缺失提示标记（由 /api/charts 在缺表时返回 missing: 'relation'）
      setMissingOffer(Boolean(o?.missing === 'relation'))
      setMissingYahoo(Boolean(y?.missing === 'relation'))
      setMissingCosts(Boolean(t?.missing === 'relation'))
      const hasAny = (s.data&&s.data.length>0) || (t.data&&t.data.length>0) || (o.data&&o.data.length>0) || (y.data&&y.data.length>0) || (Number(sum?.data?.revenue||0)>0)
      setNoData(!hasAny)
      setLoadError(hadError)
    }).finally(() => setLoading(false))
  }, [range.from, range.to])

  function getVal(row: any, key: string): number|string {
    switch (key) {
      case 'profit': return Number(row.revenue||0) - Number(row.cost||0)
      case 'epc': {
        const clicks = Number(row.clicks||0)
        return clicks>0 ? Number(row.revenue||0)/clicks : 0
      }
      case 'arpu': {
        // 近似：无用户维度，暂以 EPC 替代
        const clicks = Number(row.clicks||0)
        return clicks>0 ? Number(row.revenue||0)/clicks : 0
      }
      default: return row[key]
    }
  }
  function sortRows<T extends Record<string, any>>(rows: T[], s: Sort) {
    const data = rows.slice()
    const { key, dir } = s
    data.sort((a,b) => {
      const va = getVal(a, key); const vb = getVal(b, key)
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
  function paginate<T>(rows: T[], page: number, size: number) {
    const total = rows.length
    const pages = Math.max(1, Math.ceil(total / size))
    const p = Math.min(Math.max(1, page), pages)
    const start = (p-1)*size
    const end = Math.min(start + size, total)
    return { slice: rows.slice(start, end), total, pages, p, start: start+1, end }
  }
  function PageNav({ p, pages, onChange, total, start, end }: {p:number; pages:number; onChange:(n:number)=>void; total:number; start:number; end:number}){
    const nums: number[] = []
    if (pages <= 10) { for(let i=1;i<=pages;i++) nums.push(i) } else { nums.push(1,2,3,-1,pages-2,pages-1,pages) }
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
  function header(key: string, s: Sort, set: (n:Sort)=>void, label: string) {
    const active = s.key === key
    const dir = s.dir
    return (
      <div className={`table_h ${active?'active':''}`} onClick={()=>{ set({ key, dir: active && dir==='desc' ? 'asc' : active && dir==='asc' ? 'desc' : 'desc' }); setPageTop(1) }}>
        {label} <span className={`trk-sort ${active ? (dir==='asc'?'asc':'desc') : ''}`}/>
      </div>
    )
  }

  const summaryOptions = useMemo(() => {
    const cats = summary.map((x:any)=>x.day?.slice(0,10))
    const s1 = { name:'ADX', type:'column', data: summary.map((x:any)=>Number(x.revenue||0)) }
    const s2 = { name:'Offer', type:'column', data: cats.map((d:string)=> Number((offer.find((x:any)=> (x.day||'').slice(0,10)===d)?.revenue||0))) }
    const s3 = { name:'Yahoo', type:'column', data: cats.map((d:string)=> Number((yahoo.find((x:any)=> (x.day||'').slice(0,10)===d)?.revenue||0))) }
    const hasOffer = s2.data.reduce((a,b)=>a+b,0) > 0
    const hasYahoo = s3.data.reduce((a,b)=>a+b,0) > 0
    const series = [s1, ...(hasOffer?[s2]:[]), ...(hasYahoo?[s3]:[])] as any
    const opts = baseOptions(`Benefit Summary${(!hasOffer && !hasYahoo)?'（Only ADX）':''}`)
    return { ...opts, chart:{...opts.chart, type:'line', height:300, stacked:true}, xaxis:{ categories: cats }, series }
  }, [summary, offer, yahoo]);

  const donutData = { labels: [], series: [] } as any

  const topRowsSorted = sortRows(
    topDomains
      .filter(x => !filterDomain || String(x.website||'').toLowerCase().includes(filterDomain.toLowerCase()))
      .filter(x => !onlyProfit || ((Number(x.revenue||0) - Number(x.cost||0)) > 0)),
    sortTop
  )
  const pageTopInfo = paginate(topRowsSorted, pageTop, pageSizeTop)

  return (
    <div className="min-h-screen bg-gray-50 pt-2 md:pt-3 px-4 md:px-5 pb-4 md:pb-5">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="trk-toolbar">
            <h1 className="trk-page-title">Dashboard</h1>
            <div className="ml-auto"><DateRangeBar range={range} onChange={setRange} showCompare={false} /></div>
          </div>
        </header>
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
        {!loading && (noData || loadError) && (
          <div className={`border-l-4 p-3 rounded ${loadError ? 'bg-red-50 border-red-400' : 'bg-blue-50 border-blue-400'}`}
               style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div className="text-sm text-gray-800">
              {loadError ? '部分数据接口加载失败，已为你显示可用数据。' : '最近30天内未检测到任何数据，请调整时间范围或上传数据。'}
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 border rounded" onClick={()=>setRange(defaultLast30())}>重置为最近30天</button>
              <a href="/upload" className="px-3 py-1 bg-blue-600 text-white rounded">前往上传</a>
            </div>
          </div>
        )}

        {/* 顶部主区域：左侧（KPI + 图表），右侧（Profit + 小卡片） */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧 2/3 */}
          <div className="lg:col-span-2 space-y-4">
            {/* KPI 三卡 */}
            <div className="trk-kpi-row">
              <div className="trk-kpi-tile">
                <div className="mm_title">Today</div>
                <div className="cart_i_d flex items-center gap-2">
                  <svg viewBox="0 0 1024 1024" width="20" height="20"><path d="M534.08 448C404.8 416 363.2 384 363.2 327.04s57.6-104.96 153.6-104.96 138.88 48.64 142.08 119.68h128a226.56 226.56 0 0 0-184.32-216.96V0H431.68v122.88C321.6 146.56 232.64 218.24 232.64 328.32c0 131.2 108.8 197.12 267.52 234.88C642.24 597.12 670.4 647.68 670.4 700.16c0 39.04-28.16 101.76-153.6 101.76s-163.2-51.84-166.4-119.04H222.4a238.08 238.08 0 0 0 209.28 217.6V1024h170.88v-122.24C713.28 880.64 798.4 816.64 798.4 699.52 798.4 538.24 663.36 483.2 534.08 448z" fill="#86BEEE"></path></svg>
                  <span>{usd(kpi.today)}</span>
                </div>
              </div>
              <div className="trk-kpi-tile">
                <div className="mm_title">Last 7 Days</div>
                <div className="cart_i_d flex items-center gap-2">
                  <svg viewBox="0 0 1024 1024" width="20" height="20"><path d="M534.08 448C404.8 416 363.2 384 363.2 327.04s57.6-104.96 153.6-104.96 138.88 48.64 142.08 119.68h128a226.56 226.56 0 0 0-184.32-216.96V0H431.68v122.88C321.6 146.56 232.64 218.24 232.64 328.32c0 131.2 108.8 197.12 267.52 234.88C642.24 597.12 670.4 647.68 670.4 700.16c0 39.04-28.16 101.76-153.6 101.76s-163.2-51.84-166.4-119.04H222.4a238.08 238.08 0 0 0 209.28 217.6V1024h170.88v-122.24C713.28 880.64 798.4 816.64 798.4 699.52 798.4 538.24 663.36 483.2 534.08 448z" fill="#86BEEE"></path></svg>
                  <span>{usd(kpi.last7)}</span>
                </div>
              </div>
              <div className="trk-kpi-tile">
                <div className="mm_title">Yesterday</div>
                <div className="cart_i_d flex items-center gap-2">
                  <svg viewBox="0 0 1024 1024" width="20" height="20"><path d="M534.08 448C404.8 416 363.2 384 363.2 327.04s57.6-104.96 153.6-104.96 138.88 48.64 142.08 119.68h128a226.56 226.56 0 0 0-184.32-216.96V0H431.68v122.88C321.6 146.56 232.64 218.24 232.64 328.32c0 131.2 108.8 197.12 267.52 234.88C642.24 597.12 670.4 647.68 670.4 700.16c0 39.04-28.16 101.76-153.6 101.76s-163.2-51.84-166.4-119.04H222.4a238.08 238.08 0 0 0 209.28 217.6V1024h170.88v-122.24C713.28 880.64 798.4 816.64 798.4 699.52 798.4 538.24 663.36 483.2 534.08 448z" fill="#86BEEE"></path></svg>
                  <span>{usd(kpi.yesterday)}</span>
                </div>
              </div>
            </div>

            {/* Summary & Donut */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="trk-card">
                {typeof window !== 'undefined' && (
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  <ApexChart options={summaryOptions} series={summaryOptions.series} type="line" height={300} />
                )}
                <div className="flex items-center justify-between mt-2">
                  {(missingOffer || missingYahoo) && (
                    <div className="text-xs text-gray-500">{missingOffer && missingYahoo ? '未检测到 Offer/Yahoo 表，序列仅展示 ADX。' : missingOffer ? '未检测到 Offer 表，已仅展示 ADX/Yahoo。' : '未检测到 Yahoo 表，已仅展示 ADX/Offer。'}</div>
                  )}
                  <div className="flex items-center gap-3">
                    <button className="trk-link" onClick={()=>setEditorKey('home.benefit_summary')}>编辑 ADX</button>
                    <button className="trk-link" onClick={()=>setEditorKey('home.offer_by_day')}>编辑 Offer</button>
                    <button className="trk-link" onClick={()=>setEditorKey('home.yahoo_by_day')}>编辑 Yahoo</button>
                  </div>
                </div>
              </div>
              <div className="trk-card">
                <h3 className="trk-section-title">Proportion Of Income{(totalOffer===0 && totalYahoo===0)?'（Only ADX）':''}</h3>
            {typeof window !== 'undefined' && (
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              <ApexChart options={donutOptions(donutData.labels, donutData.series)} series={donutData.series} type="donut" height={280} />
            )}
                <div className="flex items-center justify-between mt-2">
                  {(missingOffer || missingYahoo) && (
                    <div className="text-xs text-gray-500">{missingOffer && missingYahoo ? '未检测到 Offer/Yahoo 表，饼图仅展示 ADX。' : missingOffer ? '未检测到 Offer 表，饼图不展示 Offer。' : '未检测到 Yahoo 表，饼图不展示 Yahoo。'}</div>
                  )}
                  <div className="flex items-center gap-3">
                    <button className="trk-link" onClick={()=>setEditorKey('home.benefit_summary')}>编辑 ADX</button>
                    <button className="trk-link" onClick={()=>setEditorKey('home.offer_by_day')}>编辑 Offer</button>
                    <button className="trk-link" onClick={()=>setEditorKey('home.yahoo_by_day')}>编辑 Yahoo</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧 1/3 */}
          <div className="space-y-4">
            <div className="trk-card trk-profit-card">
              <div className="trk-section-title">Profit</div>
              <div className="flex items-center gap-6 mt-3">
                <div className="text-green-600 font-semibold text-xl">{summaryAll.profit>=0? '+':''}{usd(summaryAll.profit)}</div>
              </div>
            </div>
            <div className="trk-mini-tile">
              <div className="ti_left">
                {/* Revenue icon */}
                <svg viewBox="0 0 1024 1024" width="30" height="30"><path d="M892 330c4.4 0 8 3.6 8 8v482c0 4.4-3.6 8-8 8H132c-4.4 0-8-3.6-8-8V338c0-4.4 3.6-8 8-8h760m0-60H132c-37.6 0-68 30.4-68 68v482c0 37.6 30.4 68 68 68h760c37.6 0 68-30.4 68-68V338c0-37.6-30.4-68-68-68z" fill="#35BDAA"></path><path d="M203 270l15.7-74.2c0.9-4.2 4.6-6.4 7.8-6.4 0.6 0 1.1 0.1 1.7 0.2L608.4 270H892c3.4 0 6.7 0.3 9.9 0.7L240.6 130.9c-4.7-1-9.5-1.5-14.1-1.5-31.5 0-59.7 22-66.5 54L141.7 270H203zM899.3 508.2v122.5h-202c-33.8 0-61.3-27.5-61.3-61.3s27.5-61.3 61.3-61.3h202m60-59.9h-262c-67 0-121.3 54.3-121.3 121.3s54.3 121.3 121.3 121.3h262V448.2z" fill="#35BDAA"></path><path d="M710.8 534.9c-19.1 0-34.6 15.5-34.6 34.6s15.5 34.6 34.6 34.6 34.6-15.5 34.6-34.6-15.5-34.6-34.6-34.6z" fill="#35BDAA"></path></svg>
              </div>
              <div className="ti_right">
                <div className="fontw">{summaryAll.revenue>=0? '+':''}{usd(summaryAll.revenue)}</div>
                <div className="m_fontw">Revenue</div>
              </div>
            </div>
            <div className="trk-mini-tile">
              <div className="ti_left">
                {/* Cost icon */}
                <svg viewBox="0 0 1024 1024" width="30" height="30"><path d="M512 96c229.76 0 416 186.24 416 416S741.76 928 512 928 96 741.76 96 512 282.24 96 512 96z m0 64C317.589333 160 160 317.589333 160 512S317.589333 864 512 864 864 706.410667 864 512 706.410667 160 512 160z m32 97.216l0.021333 75.477333c73.706667 9.152 126.101333 48.853333 128.64 105.6l0.106667 4.373334h-64c0-24.661333-36.266667-48-98.133333-48-62.912 0-98.133333 19.712-98.133334 48 0 25.386667 30.741333 46.592 91.946667 47.914666l6.186667 0.085334c96.469333 0 162.133333 43.541333 162.133333 112 0 64.512-52.693333 101.994667-128.746667 110.250666l-0.021333 76.544h-64V712.96c-75.114667-8.533333-128.810667-48.533333-131.392-105.962667l-0.085333-4.373333h64c0 24.661333 36.309333 48.021333 98.133333 48.021333 62.890667 0 98.133333-19.733333 98.133333-48 0-25.386667-30.72-46.592-91.925333-47.936l-12.458667-0.128c-93.056-1.856-155.882667-44.992-155.882666-111.936 0-65.301333 53.973333-102.890667 131.498666-110.549333l-0.021333-74.901333h64z" fill="#FFB748"></path></svg>
              </div>
              <div className="ti_right">
                <div className="fontw">{usd(summaryAll.cost)}</div>
                <div className="m_fontw">Cost</div>
              </div>
            </div>
          </div>
        </div>

        {/* Classified Advertiser */}
        <div className="trk-card">
          <div className="trk-card-head"><div className="trk-card-title">Classified Advertiser</div><button className="trk-card-action" onClick={()=>setEditorKey('home.classified_advertiser')}>编辑查询</button></div>
          {classified.length===0 ? (
            <div className="text-sm text-gray-500">暂无广告主数据，可点击右上角编辑查询。</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {classified.map((r:any,i:number)=> (
                <div key={i} className="trk-mini-tile">
                  <div className="ti_right">
                    <div className="fontw">{r.advertiser || 'Unknown'}</div>
                    <div className="text-xs text-gray-600">Rev ${Number(r.revenue||0).toFixed(2)} · eCPM ${Number(r.ecpm||0).toFixed(2)} · Clicks {Number(r.clicks||0).toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Domains table（全宽） */}
        <div className="trk-card">
          <div className="trk-card-head">
            <div className="trk-card-title">Top Domains（含分摊成本）</div>
            <div className="flex items-center gap-3">
              <button className="trk-card-action" onClick={()=>setEditorKey('home.top_domains_breakdown')}>编辑细分</button>
              <button className="trk-card-action" onClick={()=>setEditorKey('home.top_domains_kpi')}>编辑查询</button>
            </div>
          </div>
          {topDomains.length===0 && (
            <div className="text-sm text-gray-500 mb-2">暂无数据。可能是未配置 home.top_domains_kpi 查询或缺少 ad_costs（成本）表。</div>
          )}
          <div className="flex items-center gap-2 mb-3">
            <input value={filterDomain} onChange={e=>{ setFilterDomain(e.target.value); setPageTop(1) }} placeholder="按域名筛选，例如 example.com" className="border rounded px-3 py-1 text-sm w-64" />
            {filterDomain && <button className="px-2 py-1 border rounded text-xs" onClick={()=>{ setFilterDomain(''); setPageTop(1) }}>重置</button>}
            {missingCosts && <span className="text-xs text-yellow-600">提示：未检测到 ad_costs 表，Cost/CPC/ROI 指标不可用。</span>}
            <label className="ml-auto flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" className="accent-blue-600" checked={onlyProfit} onChange={e=>{ setOnlyProfit(e.target.checked); setPageTop(1) }} /> 仅显示盈利
            </label>
            <button className="px-2 py-1 border rounded text-xs" onClick={()=>exportTopDomainsCsv()}>导出CSV</button>
          </div>
          <div className="overflow-x-auto">
            <table className="trk-table min-w-full text-sm">
              <thead className="text-gray-500">
                  <tr>
                    <th className="py-2 pr-2"></th>
                    <th className="py-2 pr-4">{header('website', sortTop, setSortTop, 'Domain')}</th>
                    <th className="py-2 pr-4">{header('impressions', sortTop, setSortTop, 'Impressions')}</th>
                    <th className="py-2 pr-4">{header('clicks', sortTop, setSortTop, 'Clicks')}</th>
                    <th className="py-2 pr-4">{header('ctr', sortTop, setSortTop, 'CTR')}</th>
                    <th className="py-2 pr-4">{header('epc', sortTop, setSortTop, 'Epc')}</th>
                    <th className="py-2 pr-4">{header('ecpm', sortTop, setSortTop, 'eCPM (Avg)')}</th>
                    <th className="py-2 pr-4">{header('revenue', sortTop, setSortTop, 'Revenue')}</th>
                    <th className="py-2 pr-4">{header('cost', sortTop, setSortTop, 'Cost')}</th>
                    <th className="py-2 pr-4">{header('profit', sortTop, setSortTop, 'Profit')}</th>
                    <th className="py-2 pr-4">{header('roi', sortTop, setSortTop, 'ROI')}</th>
                    <th className="py-2 pr-4">{header('cpc', sortTop, setSortTop, 'CPC')}</th>
                    <th className="py-2 pr-4">{header('arpu', sortTop, setSortTop, 'ARPU')}</th>
                  </tr>
                </thead>
                <tbody>
                  {pageTopInfo.slice.map((r:any, i:number) => {
                    const b = topBreakdown[r.website] || {}
                    const roi = r.roi!=null? Number(r.roi) : null
                    const roiClass = roi!=null? (roi>=100? 'just':'burden') : ''
                    const profit = Number(r.revenue||0) - Number(r.cost||0)
                    const epc = Number(r.clicks||0) > 0 ? Number(r.revenue||0)/Number(r.clicks||0) : 0
                    const arpu = epc // 无用户维度，临时以 EPC 近似
                    return (
                      <tr key={i} className="border-t">
                        <td className="py-2 pr-2 text-center align-top">
                          <button title="展开/收起明细" onClick={()=>toggleExpand(r.website)} className="inline-flex items-center justify-center w-6 h-6 border rounded hover:bg-gray-50">{expanded[r.website]? '−' : '+'}</button>
                        </td>
                        <td className="py-2 pr-4 align-top"><a className="text-blue-600 hover:underline" href={`/report?sites=${encodeURIComponent(r.website)}&from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`}>{r.website}</a></td>
                        <td className="py-2 pr-4">{Number(r.impressions).toLocaleString()}</td>
                        <td className="py-2 pr-4">{Number(r.clicks).toLocaleString()}</td>
                        <td className="py-2 pr-4">{Number(r.ctr).toFixed(2)}%</td>
                        <td className="py-2 pr-4">${epc.toFixed(2)}</td>
                        <td className="py-2 pr-4">${Number(r.ecpm).toFixed(2)}</td>
                        <td className="py-2 pr-4">
                          ${Number(r.revenue).toFixed(2)}
                          {expanded[r.website] && (
                            <>
                              <br/>
                              <div className="cost_box">
                                <span className="adx_revenue">{b.adx_revenue!=null? `$${Number(b.adx_revenue).toFixed(2)}` : '—'}</span>
                                <span className="offer_revenue">{b.offer_revenue!=null? `$${Number(b.offer_revenue).toFixed(2)}` : '—'}</span>
                              </div>
                            </>
                          )}
                        </td>
                        <td className="py-2 pr-4">
                          {r.cost!=null? `$${Number(r.cost).toFixed(2)}`:'—'}
                          {expanded[r.website] && (
                            <>
                              <br/>
                              <div className="cost_box">
                                <span className="google_cost">{b.google_cost!=null? `$${Number(b.google_cost).toFixed(2)}` : '—'}</span>
                                <span className="bing_cost">{b.bing_cost!=null? `$${Number(b.bing_cost).toFixed(2)}` : '—'}</span>
                              </div>
                            </>
                          )}
                        </td>
                        <td className={`py-2 pr-4 ${profit>=0? 'just':'burden'}`}>{r.cost!=null? `$${profit.toFixed(2)}` : '—'}</td>
                        <td className={`py-2 pr-4 ${roiClass}`}>{roi!=null? `${roi.toFixed(2)}%`:'—'}</td>
                        <td className="py-2 pr-4">{r.cpc!=null? `$${Number(r.cpc).toFixed(4)}`:'—'}</td>
                        <td className="py-2 pr-4">${arpu.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="trk-subtle mt-2">注：成本按日按站点聚合比例分摊，作为近似指标；ARPU 当前近似等同 EPC（缺少用户维度）。</div>
            <PageNav p={pageTopInfo.p} pages={pageTopInfo.pages} onChange={setPageTop} total={pageTopInfo.total} start={pageTopInfo.start} end={pageTopInfo.end} />
          </div>
        </div>

        <ChartQueryEditorModal open={!!editorKey} chartKey={editorKey} onClose={()=>setEditorKey(null)} />
      </div>
    </div>
  )
}

function defaultLast30() {
  const to = new Date()
  const from = new Date(); from.setDate(from.getDate()-30)
  return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) }
}

// compare 功能已移除

  function usd(n: number) { return `$${Number(n||0).toFixed(2)}` }
