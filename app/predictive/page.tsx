'use client'
import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import TopFilterBar, { DateRange } from '@/components/TopFilterBar'
import ChartQueryEditorModal from '@/components/ChartQueryEditorModal'
const ApexChart: any = dynamic(() => import('react-apexcharts') as any, { ssr: false }) as any

export default function PredictivePage(){
  const [range, setRange] = useState<DateRange>(()=>def())
  const [ts, setTs] = useState<any[]>([])
  const [pred, setPred] = useState<any[]>([])
  const [anom, setAnom] = useState<any[]>([])
  const [editorKey, setEditorKey] = useState<string|null>(null)
  const [loading, setLoading] = useState(false)
  const [noData, setNoData] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(()=>{
    setLoading(true)
    fetch(`/api/charts?key=analytics.revenue_by_day&from=${range.from}&to=${range.to}`)
      .then(r=>{ if(!r.ok) throw new Error(String(r.status)); return r.json() })
      .then(d=>{
        const data = d.data||[]
        setTs(data)
        setPred(predictNext7(data))
        setAnom(detectAnomalies(data))
        setNoData(!(data && data.length>0))
        setLoadError(false)
      })
      .catch(()=>{ setLoadError(true); setNoData(true) })
      .finally(()=> setLoading(false))
  },[range.from, range.to])

  const chartOpt = useMemo(()=>({
    chart:{type:'line',height:300},
    xaxis:{categories:[...ts.map((x:any)=>x.day?.slice(0,10)), ...pred.map((x:any)=>x.day?.slice(0,10))]},
    yaxis:{ labels:{ formatter:(v:number)=> String(Math.round(Number(v||0))) } },
    series:[
      { name:'Actual', data: ts.map((x:any)=>Number(x.revenue||0)) },
      { name:'Predicted', data: [...Array(ts.length).fill(null), ...pred.map((x:any)=>Number(x.revenue||0))] }
    ],
    colors:['#35BDAA','#8B7EFF']
  }),[ts,pred])

  return (
    <div className="min-h-screen bg-gray-50 pt-2 md:pt-3 px-4 md:px-5 pb-4 md:pb-5">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="space-y-2">
          <div className="trk-toolbar">
            <h1 className="trk-page-title">预测分析（Only ADX）</h1>
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
        <div className="trk-card">
          <h3 className="trk-section-title">7 日收入预测</h3>
          <div className="flex justify-end -mt-2 mb-2"><button className="trk-link" onClick={()=>setEditorKey('analytics.revenue_by_day')}>编辑基础查询</button></div>
          {typeof window!=='undefined' && (<ApexChart options={chartOpt} series={chartOpt.series} type="line" height={300} />)}
        </div>
        <div className="trk-card">
          <h3 className="trk-section-title">异常检测（近30天）</h3>
          <div className="space-y-2">
            {anom.length===0 && <div className="trk-subtle">暂无异常</div>}
            {anom.map((a:any,i:number)=> (
              <div key={i} className={`border-l-4 p-3 ${a.severity==='HIGH'?'border-red-400 bg-red-50':'border-yellow-400 bg-yellow-50'}`}>
                <div className="font-medium">{a.date}</div>
                <div className="text-sm">实际 ${a.actual.toFixed(2)} | 期望 ${a.expected.toFixed(2)} | 偏差 {a.deviation}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <ChartQueryEditorModal open={!!editorKey} chartKey={editorKey} onClose={()=>setEditorKey(null)} />
    </div>
  )
}

function predictNext7(data:any[]) {
  if (!data || data.length===0) return []
  const last = data[data.length-1]
  const base = new Date(last.day)
  const recent = data.slice(-14)
  const avg = recent.reduce((s:any,x:any)=>s+Number(x.revenue||0),0)/recent.length
  const week = data.slice(-7).reduce((s:any,x:any)=>s+Number(x.revenue||0),0)/Math.max(1,7)
  const prev = data.slice(-14,-7).reduce((s:any,x:any)=>s+Number(x.revenue||0),0)/Math.max(1,7)
  const growth = prev>0 ? (week-prev)/prev : 0
  const out:any[] = []
  for(let i=1;i<=7;i++){
    const d = new Date(base); d.setDate(d.getDate()+i)
    const noise = 0.9 + Math.random()*0.2
    const v = Math.max(0, avg*(1+growth*0.5)*noise)
    out.push({ day: d.toISOString().slice(0,10), revenue: v })
  }
  return out
}

function detectAnomalies(data:any[]) {
  const last30 = data.slice(-30)
  if (last30.length<7) return []
  const arr = last30.map((x:any)=>Number(x.revenue||0))
  const mean = arr.reduce((s,v)=>s+v,0)/arr.length
  const std = Math.sqrt(arr.reduce((s,v)=>s+(v-mean)*(v-mean),0)/arr.length)
  const out:any[] = []
  last30.forEach((x:any)=>{
    const z = std>0 ? Math.abs((Number(x.revenue||0)-mean)/std) : 0
    if (z>2) out.push({ date: x.day, actual: Number(x.revenue||0), expected: mean, severity: z>3?'HIGH':'MEDIUM', deviation: ((Number(x.revenue||0)-mean)/mean*100).toFixed(1)+'%' })
  })
  return out.slice(-5)
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
  const d=new Date(); d.setDate(d.getDate()-30)
  const from=d.toISOString().slice(0,10); const to=new Date().toISOString().slice(0,10)
  return {from,to}
}
