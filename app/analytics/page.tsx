'use client'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import TopFilterBar, { DateRange } from '@/components/TopFilterBar'
import ChartQueryEditorModal from '@/components/ChartQueryEditorModal'
const ApexChart: any = dynamic(() => import('react-apexcharts') as any, { ssr: false }) as any

export default function AnalyticsPage() {
  const [range, setRange] = useState<DateRange>(() => def())
  const [revDay, setRevDay] = useState<any[]>([])
  const [byCountry, setByCountry] = useState<any[]>([])
  const [byDevice, setByDevice] = useState<any[]>([])
  const [ecpmDist, setEcpmDist] = useState<any[]>([])
  const [editorKey, setEditorKey] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)
  const [noData, setNoData] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setLoading(true)
    let hadError = false
    const safe = (p: Promise<Response>) => p.then(r=>{ if(!r.ok) throw new Error(String(r.status)); return r.json() }).catch(()=>{ hadError = true; return { data: [] } })
    Promise.all([
      safe(fetch(`/api/charts?key=analytics.revenue_by_day&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=analytics.revenue_by_country&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=analytics.revenue_by_device&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=analytics.ecpm_distribution&from=${range.from}&to=${range.to}`)),
    ]).then(([d1,d2,d3,d4])=>{
      const a = d1.data||[]; const b=d2.data||[]; const c=d3.data||[]; const d=d4.data||[]
      setRevDay(a); setByCountry(b); setByDevice(c); setEcpmDist(d)
      setLoadError(hadError)
      setNoData(!(a.length>0 || b.length>0 || c.length>0 || d.length>0))
    }).finally(()=> setLoading(false))
  }, [range.from, range.to])

  const revDayOpt = useMemo(()=>({ chart:{type:'line',height:300}, xaxis:{categories:revDay.map((x:any)=>x.day?.slice(0,10))}, yaxis:{ labels:{ formatter:(v:number)=> String(Math.round(Number(v||0))) } }, series:[{name:'Revenue', data:revDay.map((x:any)=>Number(x.revenue||0))}], colors:['#8B7EFF'] }),[revDay])
  const byCountryOpt = useMemo(()=>({ chart:{type:'bar',height:300}, xaxis:{categories:byCountry.map((x:any)=>x.country||'Unknown')}, yaxis:{ labels:{ formatter:(v:number)=> String(Math.round(Number(v||0))) } }, series:[{name:'Revenue', data:byCountry.map((x:any)=>Number(x.revenue||0))}], colors:['#35BDAA'] }),[byCountry])
  const byDeviceOpt = useMemo(()=>({ chart:{type:'bar',height:300}, xaxis:{categories:byDevice.map((x:any)=>x.device||'Unknown')}, yaxis:{ labels:{ formatter:(v:number)=> String(Math.round(Number(v||0))) } }, series:[{name:'Revenue', data:byDevice.map((x:any)=>Number(x.revenue||0))}], colors:['#FFB748'] }),[byDevice])
  const ecpmOpt = useMemo(()=>({ chart:{type:'bar',height:300}, xaxis:{categories:ecpmDist.map((x:any)=>x.bucket)}, yaxis:{ labels:{ formatter:(v:number)=> String(Math.round(Number(v||0))) } }, series:[{name:'Impressions', data:ecpmDist.map((x:any)=>Number(x.impressions||0))}], colors:['#4240A0'] }),[ecpmDist])

  return (
    <div className="min-h-screen bg-gray-50 pt-2 md:pt-3 px-4 md:px-5 pb-4 md:pb-5">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="trk-toolbar">
            <h1 className="trk-page-title">数据分析（Only ADX）</h1>
            <div className="ml-auto"><TopFilterBar range={range} onChange={setRange} showCompare={false} /></div>
          </div>
        </header>
        {!loading && (noData || loadError) && (
          <div className={`border-l-4 p-3 rounded ${loadError ? 'bg-red-50 border-red-400' : 'bg-blue-50 border-blue-400'}`} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div className="text-sm text-gray-800">
              {loadError ? '部分数据接口加载失败，已为你显示可用数据。' : '所选时间范围内未检测到任何数据，请调整时间范围或上传数据。'}
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-1 border rounded" onClick={()=>setRange(def())}>重置为最近30天</button>
              <a href="/upload" className="px-3 py-1 bg-blue-600 text-white rounded">前往上传</a>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="trk-card">
            <h3 className="trk-section-title">Revenue by Day</h3>
            {typeof window!=='undefined' && (<ApexChart options={revDayOpt} series={revDayOpt.series} type="line" height={300} />)}
            <div className="flex justify-end mt-2"><button className="trk-link" onClick={()=>setEditorKey('analytics.revenue_by_day')}>编辑查询</button></div>
          </div>
          <div className="trk-card">
            <h3 className="trk-section-title">Revenue by Country</h3>
            {typeof window!=='undefined' && (<ApexChart options={byCountryOpt} series={byCountryOpt.series} type="bar" height={300} />)}
            <div className="flex justify-end mt-2"><button className="trk-link" onClick={()=>setEditorKey('analytics.revenue_by_country')}>编辑查询</button></div>
          </div>
          <div className="trk-card">
            <h3 className="trk-section-title">Revenue by Device</h3>
            {typeof window!=='undefined' && (<ApexChart options={byDeviceOpt} series={byDeviceOpt.series} type="bar" height={300} />)}
            <div className="flex justify-end mt-2"><button className="trk-link" onClick={()=>setEditorKey('analytics.revenue_by_device')}>编辑查询</button></div>
          </div>
          <div className="trk-card">
            <h3 className="trk-section-title">eCPM Distribution（按展示加权）</h3>
            {typeof window!=='undefined' && (<ApexChart options={ecpmOpt} series={ecpmOpt.series} type="bar" height={300} />)}
            <div className="flex justify-end mt-2"><button className="trk-link" onClick={()=>setEditorKey('analytics.ecpm_distribution')}>编辑查询</button></div>
          </div>
          <ChartQueryEditorModal open={!!editorKey} chartKey={editorKey} onClose={()=>setEditorKey(null)} />
        </div>
      </div>
    </div>
  )
}
function def(){
  try {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      const f = sp.get('from'); const t = sp.get('to')
      if (f && t && /^\d{4}-\d{2}-\d{2}$/.test(f) && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
        return { from: f, to: t }
      }
      const r = sp.get('range')
      if (r) {
        const m = r.split(/\s*-\s*/)
        if (m.length===2 && /^\d{4}-\d{2}-\d{2}$/.test(m[0]) && /^\d{4}-\d{2}-\d{2}$/.test(m[1])) return { from: m[0], to: m[1] }
      }
    }
  } catch {}
  const to=new Date(); const from=new Date(); from.setDate(from.getDate()-30)
  return {from:from.toISOString().slice(0,10), to:to.toISOString().slice(0,10)}
}
