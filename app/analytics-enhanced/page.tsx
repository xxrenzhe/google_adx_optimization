'use client'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import TopFilterBar, { DateRange } from '@/components/TopFilterBar'
import ChartQueryEditorModal from '@/components/ChartQueryEditorModal'
const ApexChart: any = dynamic(() => import('react-apexcharts') as any, { ssr: false }) as any

export default function EnhancedAnalyticsPage() {
  const [range, setRange] = useState<DateRange>(() => def())
  const [advertisers, setAdvertisers] = useState<any[]>([])
  const [matrix, setMatrix] = useState<any[]>([])
  const [combos, setCombos] = useState<any[]>([])
  const [editorKey, setEditorKey] = useState<string|null>(null)

  useEffect(() => {
    Promise.all([
      fetch(`/api/charts?key=enhanced.advertisers&from=${range.from}&to=${range.to}`).then(r=>r.json()),
      fetch(`/api/charts?key=enhanced.device_browser_matrix&from=${range.from}&to=${range.to}`).then(r=>r.json()),
      fetch(`/api/charts?key=enhanced.top_combinations&from=${range.from}&to=${range.to}`).then(r=>r.json()),
    ]).then(([a,b,c])=>{
      setAdvertisers(a.data||[])
      setMatrix(b.data||[])
      setCombos(c.data||[])
    })
  }, [range.from, range.to])

  const advOpt = useMemo(()=>({ chart:{type:'bar',height:300}, xaxis:{categories:advertisers.map((x:any)=>x.advertiser||'Unknown')}, series:[{name:'Revenue', data:advertisers.map((x:any)=>Number(x.revenue||0))}], colors:['#8B7EFF'] }),[advertisers])
  // Heatmap series: group by device -> { name: device, data: [{x:browser, y: ecpm}] }
  const heatSeries = useMemo(()=>{
    const map = new Map<string, { name: string, data: any[] }>()
    matrix.forEach((r:any)=>{
      const dev = r.device || 'Unknown'
      const entry = map.get(dev) || { name: dev, data: [] }
      entry.data.push({ x: r.browser || 'Unknown', y: Number(r.ecpm||0) })
      map.set(dev, entry)
    })
    return Array.from(map.values())
  }, [matrix])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="space-y-3">
          <div className="trk-toolbar">
            <h1 className="text-2xl font-bold">高级分析（Only ADX）</h1>
          </div>
          <TopFilterBar range={range} onChange={setRange} />
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="trk-card">
            <h3 className="trk-section-title">Top Advertisers</h3>
            {typeof window!=='undefined' && (<ApexChart options={advOpt} series={advOpt.series} type="bar" height={300} />)}
            <div className="flex justify-end mt-2"><button className="trk-link" onClick={()=>setEditorKey('enhanced.advertisers')}>编辑查询</button></div>
          </div>
          <div className="trk-card">
            <h3 className="trk-section-title">Device-Browser Heatmap（eCPM）</h3>
            {typeof window!=='undefined' && (<ApexChart options={{ chart:{type:'heatmap',height:300} }} series={heatSeries} type="heatmap" height={300} />)}
            <div className="flex justify-end mt-2"><button className="trk-link" onClick={()=>setEditorKey('enhanced.device_browser_matrix')}>编辑查询</button></div>
          </div>
        </div>

        <div className="trk-card">
          <h3 className="trk-section-title">Top Combinations（Country-Device-AdFormat by eCPM）</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Country</th>
                  <th className="py-2 pr-4">Device</th>
                  <th className="py-2 pr-4">AdFormat</th>
                  <th className="py-2 pr-4">eCPM</th>
                  <th className="py-2 pr-4">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {combos.map((r:any,i:number)=> (
                  <tr key={i} className="border-t">
                    <td className="py-2 pr-4">{r.country || 'Unknown'}</td>
                    <td className="py-2 pr-4">{r.device || 'Unknown'}</td>
                    <td className="py-2 pr-4">{r.adformat || r.adFormat || 'Unknown'}</td>
                    <td className="py-2 pr-4">${Number(r.ecpm||0).toFixed(2)}</td>
                    <td className="py-2 pr-4">${Number(r.revenue||0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end mt-2"><button className="trk-link" onClick={()=>setEditorKey('enhanced.top_combinations')}>编辑查询</button></div>
          <ChartQueryEditorModal open={!!editorKey} chartKey={editorKey} onClose={()=>setEditorKey(null)} />
        </div>
      </div>
    </div>
  )
}
function def(){const d=new Date();d.setDate(d.getDate()-7);const from=d.toISOString().slice(0,10);const to=new Date().toISOString().slice(0,10);return {from,to}}
