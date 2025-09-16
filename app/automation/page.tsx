'use client'
import { useEffect, useState } from 'react'
import TopFilterBar, { DateRange } from '@/components/TopFilterBar'

export default function AutomationPage(){
  const [range, setRange] = useState<DateRange>(()=>def())
  const [summary, setSummary] = useState<any>({revenue:0,ecpm:0,ctr:0,impressions:0})

  useEffect(()=>{
    fetch(`/api/charts?key=alerts.summary&from=${range.from}&to=${range.to}`).then(r=>r.json()).then(d=>{
      const s=(d.data&&d.data[0])||{}
      setSummary({ revenue:Number(s.revenue||0), ecpm:Number(s.ecpm||0), ctr:Number(s.ctr||0), impressions:Number(s.impressions||0) })
    })
  },[range.from, range.to])

  const actions = buildActions(summary)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <header className="space-y-3">
          <div className="trk-toolbar">
            <h1 className="text-2xl font-bold">自动化（建议）</h1>
          </div>
          <TopFilterBar range={range} onChange={setRange} />
        </header>
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

function def(){const d=new Date();d.setDate(d.getDate()-7);const from=d.toISOString().slice(0,10);const to=new Date().toISOString().slice(0,10);return {from,to}}
