'use client'
import { useEffect, useState } from 'react'
import TopFilterBar, { DateRange } from '@/components/TopFilterBar'

export default function AutomationPage(){
  const [range, setRange] = useState<DateRange>(()=>def())
  const [summary, setSummary] = useState<any>({revenue:0,ecpm:0,ctr:0,impressions:0})
  const [loading, setLoading] = useState(false)
  const [noData, setNoData] = useState(false)
  const [loadError, setLoadError] = useState(false)

  useEffect(()=>{
    setLoading(true)
    fetch(`/api/charts?key=alerts.summary&from=${range.from}&to=${range.to}`)
      .then(r=>{ if(!r.ok) throw new Error(String(r.status)); return r.json() })
      .then(d=>{
        const s=(d.data&&d.data[0])||{}
        const next = { revenue:Number(s.revenue||0), ecpm:Number(s.ecpm||0), ctr:Number(s.ctr||0), impressions:Number(s.impressions||0) }
        setSummary(next)
        const hasSum = next.revenue>0 || next.impressions>0 || next.ctr>0
        setNoData(!hasSum)
        setLoadError(false)
      })
      .catch(()=>{ setLoadError(true); setNoData(true) })
      .finally(()=> setLoading(false))
  },[range.from, range.to])

  const actions = buildActions(summary)

  return (
    <div className="min-h-screen bg-gray-50 pt-2 md:pt-3 px-4 md:px-5 pb-4 md:pb-5">
      <div className="max-w-7xl mx-auto space-y-4">
        <header className="space-y-2">
          <div className="trk-toolbar">
            <h1 className="trk-page-title">自动化（建议）</h1>
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
          <h3 className="trk-section-title">待执行操作</h3>
          <div className="space-y-2">
            {actions.length===0 && <div className="trk-subtle">暂无操作</div>}
            {actions.map((a:any,i:number)=> (
              <div key={i} className="border rounded p-3 flex justify-between items-start">
                <div>
                  <div className="font-medium text-gray-900">{a.title}</div>
                  <div className="text-sm text-gray-700">{a.desc}</div>
                </div>
                <span className={`px-2 py-1 text-xs rounded ${a.priority==='HIGH'?'bg-red-100 text-red-800':a.priority==='MEDIUM'?'bg-yellow-100 text-yellow-800':'bg-green-100 text-green-800'}`}>{a.priority}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function buildActions(s:any){
  const arr:any[]=[]
  if ((s.impressions||0)>0){
    const fillRate = 100 // 无请求数，暂不能算真实填充率；保留扩展位
    if (fillRate<30) arr.push({ title:'降低底价', desc:'检测到填充率低于30%，建议降低底价20%以提升填充率', priority:'HIGH' })
  }
  if ((s.ecpm||0)>20) arr.push({ title:'增加库存', desc:'发现高 eCPM 机会，适当增加优质流量投放', priority:'MEDIUM' })
  if ((s.ctr||0)<0.5) arr.push({ title:'优化广告位', desc:'点击率偏低，建议优化广告位置与样式', priority:'MEDIUM' })
  return arr
}

function def(){const to=new Date();const from=new Date();from.setDate(from.getDate()-30);return {from:from.toISOString().slice(0,10), to:to.toISOString().slice(0,10)}}
