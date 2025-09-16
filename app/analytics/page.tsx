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

  useEffect(() => {
    Promise.all([
      fetch(`/api/charts?key=analytics.revenue_by_day&from=${range.from}&to=${range.to}`).then(r=>r.json()),
      fetch(`/api/charts?key=analytics.revenue_by_country&from=${range.from}&to=${range.to}`).then(r=>r.json()),
      fetch(`/api/charts?key=analytics.revenue_by_device&from=${range.from}&to=${range.to}`).then(r=>r.json()),
      fetch(`/api/charts?key=analytics.ecpm_distribution&from=${range.from}&to=${range.to}`).then(r=>r.json()),
    ]).then(([d1,d2,d3,d4])=>{
      setRevDay(d1.data||[])
      setByCountry(d2.data||[])
      setByDevice(d3.data||[])
      setEcpmDist(d4.data||[])
    })
  }, [range.from, range.to])

  const revDayOpt = useMemo(()=>({ chart:{type:'line',height:300}, xaxis:{categories:revDay.map((x:any)=>x.day?.slice(0,10))}, series:[{name:'Revenue', data:revDay.map((x:any)=>Number(x.revenue||0))}], colors:['#8B7EFF'] }),[revDay])
  const byCountryOpt = useMemo(()=>({ chart:{type:'bar',height:300}, xaxis:{categories:byCountry.map((x:any)=>x.country||'Unknown')}, series:[{name:'Revenue', data:byCountry.map((x:any)=>Number(x.revenue||0))}], colors:['#35BDAA'] }),[byCountry])
  const byDeviceOpt = useMemo(()=>({ chart:{type:'bar',height:300}, xaxis:{categories:byDevice.map((x:any)=>x.device||'Unknown')}, series:[{name:'Revenue', data:byDevice.map((x:any)=>Number(x.revenue||0))}], colors:['#FFB748'] }),[byDevice])
  const ecpmOpt = useMemo(()=>({ chart:{type:'bar',height:300}, xaxis:{categories:ecpmDist.map((x:any)=>x.bucket)}, series:[{name:'Impressions', data:ecpmDist.map((x:any)=>Number(x.impressions||0))}], colors:['#4240A0'] }),[ecpmDist])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="space-y-3">
          <div className="trk-toolbar">
            <h1 className="text-2xl font-bold">数据分析（Only ADX）</h1>
          </div>
          <TopFilterBar range={range} onChange={setRange} />
        </header>

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
function def(){const d=new Date();d.setDate(d.getDate()-7);const from=d.toISOString().slice(0,10);const to=new Date().toISOString().slice(0,10);return {from,to}}
