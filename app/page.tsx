"use client"

import { useEffect, useMemo, useState } from 'react'
import DateRangeBar, { DateRange } from '@/components/DateRangeBar'
import dynamic from 'next/dynamic'
import { baseOptions, donutOptions } from '@/lib/chart-theme'
import ChartQueryEditorModal from '@/components/ChartQueryEditorModal'

export default function HomePage() {
  const [range, setRange] = useState<DateRange>(() => defaultLast30())
  const [kpi, setKpi] = useState<{today:number; last7:number; yesterday:number}>({today:0,last7:0,yesterday:0})
  const [summary, setSummary] = useState<any[]>([])
  const [offer, setOffer] = useState<any[]>([])
  const [yahoo, setYahoo] = useState<any[]>([])
  const [missingOffer, setMissingOffer] = useState(false)
  const [missingYahoo, setMissingYahoo] = useState(false)
  const [missingCosts, setMissingCosts] = useState(false)
  const [summaryAll, setSummaryAll] = useState<{ revenue:number; cost:number; profit:number }>({ revenue:0, cost:0, profit:0 })
  const [topDomains, setTopDomains] = useState<any[]>([])
  const [topBreakdown, setTopBreakdown] = useState<Record<string, { adx_revenue?: number; offer_revenue?: number; google_cost?: number; bing_cost?: number }>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const toggleExpand = (w: string) => setExpanded(x => ({ ...x, [w]: !x[w] }))
  const [onlyProfit, setOnlyProfit] = useState(false)
  const [classified, setClassified] = useState<any[]>([])
  type Sort = { key: string; dir: 'asc'|'desc' }
  const [sortTop, setSortTop] = useState<Sort>({ key: 'revenue', dir: 'desc' })
  const [pageTop, setPageTop] = useState(1)
  const pageSizeTop = 15
  const [sortAdv, setSortAdv] = useState<Sort>({ key: 'revenue', dir: 'desc' })
  const [pageAdv, setPageAdv] = useState(1)
  const [filterAdv, setFilterAdv] = useState('')
  const [filterDomain, setFilterDomain] = useState('')
  const [loading, setLoading] = useState(false)
  // 避免水合不一致：仅在客户端挂载后再渲染图表
  const [isClient, setIsClient] = useState(false)
  useEffect(()=>{ setIsClient(true) }, [])
  const [noData, setNoData] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [editorKey, setEditorKey] = useState<string|null>(null)

  const ApexChart: any = useMemo(() => dynamic(() => import('react-apexcharts') as any, { ssr: false }) as any, [])

  useEffect(() => {
    setLoading(true)
    let hadError = false
    fetch(`/api/home/kpi`).then(r=>r.json()).then(d=>{ if (d?.data) setKpi(d.data) }).catch(()=>{})
    const safe = (p: Promise<Response>) => p
      .then(r=>{ if(!r.ok) throw new Error(String(r.status)); return r.json() })
      .catch(()=>{ hadError = true; return { data: [] } })
    Promise.all([
      safe(fetch(`/api/charts?key=home.benefit_summary&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=home.offer_by_day&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=home.yahoo_by_day&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=home.classified_advertiser&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=home.top_domains_kpi&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=home.top_domains_breakdown&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=home.top_domains&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/home/summary?from=${range.from}&to=${range.to}`)),
    ]).then(([s, o, y, ca, tkpi, tb, t, sum]) => {
      setSummary(s.data || [])
      setOffer(o.data || [])
      setYahoo(y.data || [])
      setClassified(ca.data || [])
      const m: Record<string, any> = {}
      ;(tb.data||[]).forEach((row: any) => { if (row?.website) m[row.website] = row })
      setTopBreakdown(m)
      setTopDomains((tkpi?.data && tkpi.data.length>0) ? tkpi.data : (t.data || []))
      if (sum?.data) setSummaryAll(sum.data)
      setMissingOffer(Boolean(o?.missing === 'relation'))
      setMissingYahoo(Boolean(y?.missing === 'relation'))
      setMissingCosts(Boolean(tkpi?.missing === 'relation'))
      const hasAny = (s.data&&s.data.length>0) || ((tkpi.data&&tkpi.data.length>0) || (t.data&&t.data.length>0)) || (Number(sum?.data?.revenue||0)>0) || (ca.data&&ca.data.length>0)
      setNoData(!hasAny)
      setLoadError(hadError)
    }).finally(()=> setLoading(false))
  }, [range.from, range.to])

  function getVal(row: any, key: string): number|string {
    switch (key) {
      case 'profit': return Number(row.revenue||0) - Number(row.cost||0)
      case 'epc': {
        const clicks = Number(row.clicks||0)
        return clicks>0 ? Number(row.revenue||0)/clicks : 0
      }
      case 'arpu': {
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

  function header(key: string, s: Sort, set: (n:Sort)=>void, label: string) {
    const active = s.key === key
    const dir = s.dir
    return (
      <div className={`table_h ${active?'active':''}`} onClick={()=>{ set({ key, dir: active && dir==='desc' ? 'asc' : active && dir==='asc' ? 'desc' : 'desc' }); setPageTop(1) }}>
        {label} <span className={`trk-sort ${active ? (dir==='asc'?'asc':'desc') : ''}`}/>
      </div>
    )
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

  function exportTopDomainsCsv() {
    try {
      const rows = sortRows(
        topDomains
          .filter(x => !filterDomain || String(x.website||'').toLowerCase().includes(filterDomain.toLowerCase()))
          .filter(x => !onlyProfit || ((Number(x.revenue||0) - Number(x.cost||0)) > 0)),
        sortTop
      )
      const header = ['Domain','Impressions','Clicks','CTR','Epc','eCPM','Revenue','Cost','Profit','ROI','CPC','ARPU']
      const lines = [header.join(',')]
      rows.forEach((r:any) => {
        const profit = Number(r.revenue||0)-Number(r.cost||0)
        const epc = Number(r.clicks||0)>0 ? Number(r.revenue||0)/Number(r.clicks||0) : 0
        const arpu = epc
        const row = [
          r.website,
          Number(r.impressions||0),
          Number(r.clicks||0),
          Number(r.ctr||0).toFixed(2)+'%',
          epc.toFixed(2),
          Number(r.ecpm||0).toFixed(2),
          Number(r.revenue||0).toFixed(2),
          r.cost!=null? Number(r.cost||0).toFixed(2) : '',
          r.cost!=null? profit.toFixed(2) : '',
          r.roi!=null? Number(r.roi||0).toFixed(2)+'%' : '',
          r.cpc!=null? Number(r.cpc||0).toFixed(4) : '',
          arpu.toFixed(2)
        ]
        lines.push(row.join(','))
      })
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `top-domains-${range.from}_${range.to}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  function exportAdvertisersCsv() {
    try {
      const rows = sortRows(classified.map((r:any)=>({
        advertiser: r.advertiser || 'Unknown',
        impressions: Number(r.impressions||0),
        clicks: Number(r.clicks||0),
        ctr: (Number(r.impressions||0)>0? Number(r.clicks||0)/Number(r.impressions||0)*100 : 0),
        ecpm: Number(r.ecpm||0),
        revenue: Number(r.revenue||0),
      })).filter(r=> !filterAdv || String(r.advertiser).toLowerCase().includes(filterAdv.toLowerCase())), sortAdv)
      const header = ['Advertiser','Impressions','Clicks','CTR','eCPM','Revenue']
      const lines = [header.join(',')]
      rows.forEach((r:any)=>{
        const row = [
          r.advertiser,
          r.impressions,
          r.clicks,
          r.ctr.toFixed(2)+'%',
          r.ecpm.toFixed(2),
          r.revenue.toFixed(2)
        ]
        lines.push(row.join(','))
      })
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `classified-advertiser-${range.from}_${range.to}.csv`; a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  const summaryOptions = useMemo(() => {
    const cats = summary.map((x:any)=> (x.day||'').slice(0,10))
    const s1 = { name:'ADX', type:'column', data: summary.map((x:any)=> Number(x.revenue||0)) }
    const s2 = { name:'Offer', type:'column', data: cats.map((d:string)=> Number((offer.find((x:any)=> (x.day||'').slice(0,10)===d)?.revenue||0))) }
    const s3 = { name:'Yahoo', type:'column', data: cats.map((d:string)=> Number((yahoo.find((x:any)=> (x.day||'').slice(0,10)===d)?.revenue||0))) }
    const hasOffer = s2.data.reduce((a,b)=>a+b,0) > 0
    const hasYahoo = s3.data.reduce((a,b)=>a+b,0) > 0
    const series = [s1, ...(hasOffer?[s2]:[]), ...(hasYahoo?[s3]:[])] as any
    const opts = baseOptions(`Benefit Summary${(!hasOffer && !hasYahoo)?'（Only ADX）':''}`)
    return { ...opts, chart:{...opts.chart, type:'line', height:300, stacked:true}, xaxis:{ categories: cats }, series }
  }, [summary, offer, yahoo])

  const donutLabels = useMemo(() => {
    const totalOffer = offer.reduce((s:any,x:any)=> s+Number(x.revenue||0), 0)
    const totalYahoo = yahoo.reduce((s:any,x:any)=> s+Number(x.revenue||0), 0)
    return ['ADX', ...(totalOffer>0?['Offer']:[]), ...(totalYahoo>0?['Yahoo']:[])]
  }, [offer, yahoo])
  const donutSeries = useMemo(() => {
    const totalADX = summary.reduce((s:any,x:any)=> s+Number(x.revenue||0), 0)
    const totalOffer = offer.reduce((s:any,x:any)=> s+Number(x.revenue||0), 0)
    const totalYahoo = yahoo.reduce((s:any,x:any)=> s+Number(x.revenue||0), 0)
    return [totalADX, ...(totalOffer>0?[totalOffer]:[]), ...(totalYahoo>0?[totalYahoo]:[])]
  }, [summary, offer, yahoo])

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

        {/* 左侧（KPI 三卡 + Summary/Donut） | 右侧（Profit/Revenue/Cost） */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-stretch">
          {/* 左侧两列 */}
          <div className="xl:col-span-2 space-y-6">
            {/* KPI 三卡 */}
            <div className="trk-kpi-row">
              <div className="trk-kpi-tile primary">
                <div className="mm_title">Today</div>
                <div className="cart_i_d flex items-center gap-2">
                  <span>{usd(kpi.today)}</span>
                  <button className="trk-card-action" onClick={()=>setEditorKey('home.kpi.today')}>编辑查询</button>
                </div>
              </div>
              <div className="trk-kpi-tile primary">
                <div className="mm_title">Last 7 Days</div>
                <div className="cart_i_d flex items-center gap-2">
                  <span>{usd(kpi.last7)}</span>
                  <button className="trk-card-action" onClick={()=>setEditorKey('home.kpi.last7')}>编辑查询</button>
                </div>
              </div>
              <div className="trk-kpi-tile primary">
                <div className="mm_title">Yesterday</div>
                <div className="cart_i_d flex items-center gap-2">
                  <span>{usd(kpi.yesterday)}</span>
                  <button className="trk-card-action" onClick={()=>setEditorKey('home.kpi.yesterday')}>编辑查询</button>
                </div>
              </div>
            </div>
            {/* Summary + Donut */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="trk-card" suppressHydrationWarning>
                {isClient && (
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  <ApexChart options={summaryOptions} series={summaryOptions.series} type="line" height={300} />
                )}
                <div className="flex items-center justify-between mt-2">
                  {(missingOffer || missingYahoo) && (
                    <div className="text-xs text-gray-500">{missingOffer && missingYahoo ? '未检测到 Offer/Yahoo 表，序列仅展示 ADX。' : missingOffer ? '未检测到 Offer 表，已仅展示 ADX/Yahoo。' : '未检测到 Yahoo 表，已仅展示 ADX/Offer。'}</div>
                  )}
                  <button className="trk-card-action" onClick={()=>setEditorKey('home.benefit_summary')}>编辑查询</button>
                </div>
              </div>
              <div className="trk-card" suppressHydrationWarning>
                <h3 className="trk-section-title">Proportion Of Income{(donutSeries.length===1)?'（Only ADX）':''}</h3>
                {isClient && (
                  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                  // @ts-ignore
                  <ApexChart options={donutOptions(donutLabels, donutSeries)} series={donutSeries} type="donut" height={280} />
                )}
                <div className="flex items-center justify-between mt-2">
                  {(missingOffer || missingYahoo) && (
                    <div className="text-xs text-gray-500">{missingOffer && missingYahoo ? '未检测到 Offer/Yahoo 表，饼图仅展示 ADX。' : missingOffer ? '未检测到 Offer 表，饼图不展示 Offer。' : '未检测到 Yahoo 表，饼图不展示 Yahoo。'}</div>
                  )}
                  <button className="trk-card-action" onClick={()=>setEditorKey('home.benefit_summary')}>编辑查询</button>
                </div>
              </div>
            </div>
          </div>

          {/* 右侧一列：Profit + Revenue/Cost */}
          <div className="xl:col-span-1 flex flex-col gap-4 h-full">
            <div className="trk-card trk-profit-card flex-[2] flex flex-col relative">
              {(() => { const roi = summaryAll.cost>0 ? (summaryAll.revenue/summaryAll.cost*100) : 0; const p = Math.max(0, Math.min(100, roi)); return (
                <>
                  <div className="trk-card-head"><div className="trk-card-title">Profit</div><button className="trk-card-action absolute top-2 right-2" onClick={()=>setEditorKey('home.benefit_summary')}>编辑查询</button></div>
                  <div className="flex flex-col items-center justify-center gap-3 flex-1">
                    <div className="text-2xl font-bold">{summaryAll.profit>=0? '+':''}{usd(Math.abs(summaryAll.profit))}</div>
                    <div className="trk-ring" style={{ ['--p' as any]: p }}>
                      <div className="trk-ring-text">{p.toFixed(2)}%</div>
                      <div className="trk-ring-label">ROI</div>
                    </div>
                  </div>
                </>
              ) })()}
            </div>
            <div className="trk-mini-tile success flex-1">
              <div className="ti_left revenue" />
              <div className="ti_right">
                <div className="fontw">{summaryAll.revenue>=0? '+':''}{usd(summaryAll.revenue)}</div>
                <div className="m_fontw">Revenue</div>
              </div>
              <button className="trk-card-action ml-auto" onClick={()=>setEditorKey('home.benefit_summary')}>编辑查询</button>
            </div>
            <div className="trk-mini-tile warning flex-1">
              <div className="ti_left cost" />
              <div className="ti_right">
                <div className="fontw">{usd(summaryAll.cost)}</div>
                <div className="m_fontw">Cost</div>
              </div>
              <button className="trk-card-action ml-auto" onClick={()=>setEditorKey('home.benefit_summary')}>编辑查询</button>
            </div>
          </div>
        </div>

        {/* 表格列表区（Top Domains / Classified Advertiser 调整顺序） */}
        <div className="flex flex-col gap-6">
        {/* Classified Advertiser（表格） */}
        <div className="trk-card order-2">
          <div className="trk-card-head"><div className="trk-card-title">Classified Advertiser</div><button className="trk-card-action" onClick={()=>setEditorKey('home.classified_advertiser')}>编辑查询</button></div>
          {classified.length===0 ? (
            <div className="text-sm text-gray-500">暂无广告主数据，可点击右上角编辑查询。</div>
          ) : (
            <div className="overflow-x-auto">
              <div className="flex items-center gap-2 mb-3">
                <input value={filterAdv} onChange={e=>{ setFilterAdv(e.target.value); setPageAdv(1) }} placeholder="按广告主筛选，例如 Example Inc." className="border rounded px-3 py-1 text-sm w-64" />
                {filterAdv && <button className="px-2 py-1 border rounded text-xs" onClick={()=>{ setFilterAdv(''); setPageAdv(1) }}>重置</button>}
                <button className="px-2 py-1 border rounded text-xs ml-auto" onClick={()=>exportAdvertisersCsv()}>导出CSV</button>
              </div>
              <table className="trk-table min-w-full text-sm">
                <thead className="text-gray-500">
                  <tr>
                    <th className="py-2 pr-4"><div className={`table_h ${sortAdv.key==='advertiser'?'active':''}`} onClick={()=> setSortAdv({ key: 'advertiser', dir: sortAdv.key==='advertiser' && sortAdv.dir==='desc' ? 'asc' : sortAdv.key==='advertiser' && sortAdv.dir==='asc' ? 'desc' : 'desc' })}>Advertiser <span className={`trk-sort ${sortAdv.key==='advertiser' ? (sortAdv.dir==='asc'?'asc':'desc') : ''}`}/></div></th>
                    <th className="py-2 pr-4"><div className={`table_h ${sortAdv.key==='impressions'?'active':''}`} onClick={()=> setSortAdv({ key: 'impressions', dir: sortAdv.key==='impressions' && sortAdv.dir==='desc' ? 'asc' : sortAdv.key==='impressions' && sortAdv.dir==='asc' ? 'desc' : 'desc' })}>Impressions <span className={`trk-sort ${sortAdv.key==='impressions' ? (sortAdv.dir==='asc'?'asc':'desc') : ''}`}/></div></th>
                    <th className="py-2 pr-4"><div className={`table_h ${sortAdv.key==='clicks'?'active':''}`} onClick={()=> setSortAdv({ key: 'clicks', dir: sortAdv.key==='clicks' && sortAdv.dir==='desc' ? 'asc' : sortAdv.key==='clicks' && sortAdv.dir==='asc' ? 'desc' : 'desc' })}>Clicks <span className={`trk-sort ${sortAdv.key==='clicks' ? (sortAdv.dir==='asc'?'asc':'desc') : ''}`}/></div></th>
                    <th className="py-2 pr-4"><div className={`table_h ${sortAdv.key==='ctr'?'active':''}`} onClick={()=> setSortAdv({ key: 'ctr', dir: sortAdv.key==='ctr' && sortAdv.dir==='desc' ? 'asc' : sortAdv.key==='ctr' && sortAdv.dir==='asc' ? 'desc' : 'desc' })}>CTR <span className={`trk-sort ${sortAdv.key==='ctr' ? (sortAdv.dir==='asc'?'asc':'desc') : ''}`}/></div></th>
                    <th className="py-2 pr-4"><div className={`table_h ${sortAdv.key==='ecpm'?'active':''}`} onClick={()=> setSortAdv({ key: 'ecpm', dir: sortAdv.key==='ecpm' && sortAdv.dir==='desc' ? 'asc' : sortAdv.key==='ecpm' && sortAdv.dir==='asc' ? 'desc' : 'desc' })}>eCPM <span className={`trk-sort ${sortAdv.key==='ecpm' ? (sortAdv.dir==='asc'?'asc':'desc') : ''}`}/></div></th>
                    <th className="py-2 pr-4"><div className={`table_h ${sortAdv.key==='revenue'?'active':''}`} onClick={()=> setSortAdv({ key: 'revenue', dir: sortAdv.key==='revenue' && sortAdv.dir==='desc' ? 'asc' : sortAdv.key==='revenue' && sortAdv.dir==='asc' ? 'desc' : 'desc' })}>Revenue <span className={`trk-sort ${sortAdv.key==='revenue' ? (sortAdv.dir==='asc'?'asc':'desc') : ''}`}/></div></th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows = sortRows(classified.map((r:any)=>({
                      advertiser: r.advertiser || 'Unknown',
                      impressions: Number(r.impressions||0),
                      clicks: Number(r.clicks||0),
                      ctr: (Number(r.impressions||0)>0? Number(r.clicks||0)/Number(r.impressions||0)*100 : 0),
                      ecpm: Number(r.ecpm||0),
                      revenue: Number(r.revenue||0),
                    })).filter((r:any)=> !filterAdv || String(r.advertiser).toLowerCase().includes(filterAdv.toLowerCase())), sortAdv)
                    const p = paginate(rows, pageAdv, pageSizeTop)
                    return p.slice.map((r:any, i:number) => (
                      <tr key={i} className="border-t">
                        <td className="py-2 pr-4">{r.advertiser}</td>
                        <td className="py-2 pr-4">{r.impressions.toLocaleString()}</td>
                        <td className="py-2 pr-4">{r.clicks.toLocaleString()}</td>
                        <td className="py-2 pr-4">{r.ctr.toFixed(2)}%</td>
                        <td className="py-2 pr-4">${r.ecpm.toFixed(2)}</td>
                        <td className="py-2 pr-4">${r.revenue.toFixed(2)}</td>
                      </tr>
                    ))
                  })()}
                </tbody>
              </table>
              {(() => { const rows = sortRows(classified, sortAdv); const p = paginate(rows, pageAdv, pageSizeTop); return <PageNav p={p.p} pages={p.pages} onChange={setPageAdv} total={p.total} start={p.start} end={p.end} /> })()}
            </div>
          )}
        </div>

        {/* Top Domains（含分摊成本） */}
        <div className="trk-card order-1">
          <div className="trk-card-head">
            <div className="trk-card-title">Top Domains（含分摊成本）</div>
            <button className="trk-card-action" onClick={()=>setEditorKey('home.top_domains_kpi')}>编辑查询</button>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <input value={filterDomain} onChange={e=>{ setFilterDomain(e.target.value); setPageTop(1) }} placeholder="按域名筛选，例如 example.com" className="border rounded px-3 py-1 text-sm w-64" />
            {filterDomain && <button className="px-2 py-1 border rounded text-xs" onClick={()=>{ setFilterDomain(''); setPageTop(1) }}>重置</button>}
            <label className="ml-auto flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" className="accent-blue-600" checked={onlyProfit} onChange={e=>{ setOnlyProfit(e.target.checked); setPageTop(1) }} /> 仅显示盈利
            </label>
            <button className="px-2 py-1 border rounded text-xs" onClick={()=>exportTopDomainsCsv()}>导出CSV</button>
          </div>
          {/* 缺少成本维度提示：当所有行均无 cost/roi/cpc 时提示 */}
          {(() => {
            try {
              const hasAny = topDomains && topDomains.length > 0
              const allNoCost = hasAny && topDomains.every((r:any) => r == null || (r.cost == null && r.roi == null && r.cpc == null))
              if (missingCosts || allNoCost) {
                return <div className="trk-note mb-2">未检测到成本维度（例如 ad_costs），Cost/ROI/CPC 列为空或未启用 KPI 查询。可点击右上角“编辑细分/编辑查询”调整。</div>
              }
            } catch {}
            return null
          })()}
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
                {(() => {
                  const rows = sortRows(
                    topDomains
                      .filter(x => !filterDomain || String(x.website||'').toLowerCase().includes(filterDomain.toLowerCase()))
                      .filter(x => !onlyProfit || ((Number(x.revenue||0) - Number(x.cost||0)) > 0)),
                    sortTop
                  )
                  const p = paginate(rows, pageTop, pageSizeTop)
                  return p.slice.map((r:any, i:number) => {
                    const b = topBreakdown[r.website] || {}
                    const roi = r.roi!=null? Number(r.roi) : null
                    const roiClass = roi!=null? (roi>=100? 'just':'burden') : ''
                    const profit = Number(r.revenue||0) - Number(r.cost||0)
                    const epc = Number(r.clicks||0) > 0 ? Number(r.revenue||0)/Number(r.clicks||0) : 0
                    const arpu = epc
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
                  })
                })()}
              </tbody>
            </table>
          </div>
          {(() => { const rows = sortRows(topDomains, sortTop); const p = paginate(rows, pageTop, pageSizeTop); return <PageNav p={p.p} pages={p.pages} onChange={setPageTop} total={p.total} start={p.start} end={p.end} /> })()}
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

function usd(n: number) { return `$${Number(n||0).toFixed(2)}` }
