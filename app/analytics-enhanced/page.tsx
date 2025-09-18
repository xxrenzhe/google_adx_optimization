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
  const [loading, setLoading] = useState(false)
  const [noData, setNoData] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    setLoading(true)
    let hadError = false
    const safe = (p: Promise<Response>) => p.then(r=>{ if(!r.ok) throw new Error(String(r.status)); return r.json() }).catch(()=>{ hadError = true; return { data: [] } })
    Promise.all([
      safe(fetch(`/api/charts?key=enhanced.advertisers&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=enhanced.device_browser_matrix&from=${range.from}&to=${range.to}`)),
      safe(fetch(`/api/charts?key=enhanced.top_combinations&from=${range.from}&to=${range.to}`)),
    ]).then(([a,b,c])=>{
      const A=a.data||[]; const B=b.data||[]; const C=c.data||[]
      setAdvertisers(A); setMatrix(B); setCombos(C)
      setLoadError(hadError)
      setNoData(!(A.length>0 || B.length>0 || C.length>0))
    }).finally(()=> setLoading(false))
  }, [range.from, range.to])

  const advOpt = useMemo(()=>({ chart:{type:'bar',height:300}, xaxis:{categories:advertisers.map((x:any)=>x.advertiser||'Unknown')}, yaxis:{ labels:{ formatter:(v:number)=> String(Math.round(Number(v||0))) } }, series:[{name:'Revenue', data:advertisers.map((x:any)=>Number(x.revenue||0))}], colors:['#8B7EFF'] }),[advertisers])
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
    <div className="min-h-screen bg-gray-50 pt-2 md:pt-3 px-4 md:px-5 pb-4 md:pb-5">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="trk-toolbar">
            <h1 className="trk-page-title">高级分析（Only ADX）</h1>
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
