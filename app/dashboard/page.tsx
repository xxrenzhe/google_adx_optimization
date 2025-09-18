"use client"

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import TopFilterBar, { DateRange } from '@/components/TopFilterBar'
import DateRangeBar from '@/components/DateRangeBar'
import ChartQueryEditorModal from '@/components/ChartQueryEditorModal'
import { baseOptions } from '@/lib/chart-theme'
import { formatCurrency } from '@/lib/utils'

const ApexChart: any = dynamic(() => import('react-apexcharts') as any, { ssr: false }) as any

export default function DashboardLegacy() {
  const [range, setRange] = useState<DateRange>(() => defaultYesterday())
  const [summary, setSummary] = useState<any[]>([])
  const [offer, setOffer] = useState<any[]>([])
  const [yahoo, setYahoo] = useState<any[]>([])
  const [topDomains, setTopDomains] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [editorKey, setEditorKey] = useState<string|null>(null)
  const [compare, setCompare] = useState(false)
  const [summaryPrev, setSummaryPrev] = useState<any[]>([])
  const [kpi, setKpi] = useState<{today:number; last7:number; yesterday:number}>({today:0,last7:0,yesterday:0})
  const totalRevenue = useMemo(() => summary.reduce((s:any,x:any)=>s+Number(x.revenue||0),0), [summary])

  useEffect(() => {
    setLoading(true)
    const prev = previousRange(range)
    Promise.all([
      fetch(`/api/charts?key=home.benefit_summary&from=${range.from}&to=${range.to}`).then(r => r.json()),
      compare ? fetch(`/api/charts?key=home.benefit_summary&from=${prev.from}&to=${prev.to}`).then(r => r.json()) : Promise.resolve({data:[]}),
      fetch(`/api/charts?key=home.top_domains_kpi&from=${range.from}&to=${range.to}`).then(r => r.json()),
      fetch(`/api/charts?key=home.offer_by_day&from=${range.from}&to=${range.to}`).then(r => r.json()).catch(()=>({data:[]})),
      fetch(`/api/charts?key=home.yahoo_by_day&from=${range.from}&to=${range.to}`).then(r => r.json()).catch(()=>({data:[]})),
    ]).then(([s, sPrev, t, o, y]) => {
      setSummary(s.data || [])
      setSummaryPrev(sPrev.data || [])
      setTopDomains(t.data || [])
      setOffer(o.data || [])
      setYahoo(y.data || [])
    }).finally(() => setLoading(false))
  }, [range.from, range.to, compare])

  useEffect(() => { fetch('/api/home/kpi').then(r=>r.json()).then(d=>{ if (d.data) setKpi(d.data) }) }, [])

  const summaryOptions = useMemo(() => {
    const cats = summary.map((x:any)=>x.day?.slice(0,10))
    const s1 = { name:'ADX', type:'column', data: summary.map((x:any)=>Number(x.revenue||0)) }
    const s2 = { name:'Offer', type:'column', data: cats.map((d:string)=> Number((offer.find((x:any)=> (x.day||'').slice(0,10)===d)?.revenue||0))) }
    const s3 = { name:'Yahoo', type:'column', data: cats.map((d:string)=> Number((yahoo.find((x:any)=> (x.day||'').slice(0,10)===d)?.revenue||0))) }
    const hasOffer = s2.data.reduce((a,b)=>a+b,0) > 0
    const hasYahoo = s3.data.reduce((a,b)=>a+b,0) > 0
    const series = [s1, ...(hasOffer?[s2]:[]), ...(hasYahoo?[s3]:[])] as any
    if (compare && summaryPrev.length) {
      const prevCats = summaryPrev.map((x:any)=>x.day?.slice(0,10))
      series.push({ name:'ADX (Prev)', type:'line', data: prevCats.map((d:string)=> Number((summaryPrev.find((x:any)=> (x.day||'').slice(0,10)===d)?.revenue||0))) } as any)
    }
    const opts = baseOptions(`Benefit Summary${(!hasOffer && !hasYahoo)?'（Only ADX）':''}`)
    return { ...opts, chart:{...opts.chart, type:'line', height:300, stacked:true}, xaxis:{ categories: cats }, series }
  }, [summary, summaryPrev, compare, offer, yahoo])

  return (
    <div className="min-h-screen bg-gray-50 pt-2 md:pt-3 px-4 md:px-5 pb-4 md:pb-5">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="trk-toolbar">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <div className="ml-auto"><DateRangeBar range={range} onChange={setRange} showCompare={false} /></div>
          </div>
        </header>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="trk-card">
            <div className="trk-subtle">Today</div>
            <div className="trk-kpi">{formatCurrency(kpi.today)}</div>
          </div>
          <div className="trk-card">
            <div className="trk-subtle">Last 7 Days</div>
            <div className="trk-kpi">{formatCurrency(kpi.last7)}</div>
          </div>
          <div className="trk-card">
            <div className="trk-subtle">Yesterday</div>
            <div className="trk-kpi">{formatCurrency(kpi.yesterday)}</div>
          </div>
        </div>

        {loading && <div>加载中…</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="trk-card">
            {typeof window !== 'undefined' && (
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              <ApexChart options={summaryOptions} series={summaryOptions.series} type="line" height={300} />
            )}
            <div className="flex justify-end mt-2"><button className="trk-link" onClick={()=>setEditorKey('home.benefit_summary')}>编辑查询</button></div>
          </div>

          <div className="trk-card">
            <h3 className="trk-section-title">Top Domains（含分摊成本）</h3>
            <div className="overflow-x-auto">
              <table className="trk-table min-w-full text-sm">
                <thead className="text-gray-500">
                  <tr>
                    <th className="py-2 pr-4">Domain</th>
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
                  {topDomains.map((r:any, i:number) => (
                    <tr key={i} className="border-t">
                      <td className="py-2 pr-4">{r.website}</td>
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
              <div className="trk-subtle">注：成本按日按站点聚合，作为近似指标。</div>
              <button className="trk-link" onClick={()=>setEditorKey('home.top_domains_kpi')}>编辑查询</button>
            </div>
          </div>
        </div>

        {/* Proportion Of Income */}
        <div className="trk-card">
          <h3 className="trk-section-title">Proportion Of Income{(offer.length===0 && yahoo.length===0)?'（Only ADX）':''}</h3>
          {typeof window !== 'undefined' && (()=>{
            const totalOffer = offer.reduce((s:any,x:any)=>s+Number(x.revenue||0),0)
            const totalYahoo = yahoo.reduce((s:any,x:any)=>s+Number(x.revenue||0),0)
            const labels = ['ADX', ...(totalOffer>0?['Offer']:[]), ...(totalYahoo>0?['Yahoo']:[])]
            const series = [Number(totalRevenue), ...(totalOffer>0?[totalOffer]:[]), ...(totalYahoo>0?[totalYahoo]:[])]
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            return <ApexChart options={{ labels }} series={series} type="donut" height={280} />
          })()}
        </div>

        <div className="trk-subtle">注：Offer/Yahoo/Cost/ROI 暂未接入，保留扩展位与查询编辑能力。</div>
        <ChartQueryEditorModal open={!!editorKey} chartKey={editorKey} onClose={()=>setEditorKey(null)} />
      </div>
    </div>
  )
}

function defaultYesterday() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const y = d.toISOString().slice(0,10)
  return { from: y, to: y }
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
