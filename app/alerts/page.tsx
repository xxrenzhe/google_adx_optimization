'use client'
import { useEffect, useState } from 'react'
import TopFilterBar, { DateRange } from '@/components/TopFilterBar'
import ChartQueryEditorModal from '@/components/ChartQueryEditorModal'

type Summary = { revenue: number; impressions: number; clicks: number; ecpm: number; ctr: number }

export default function AlertsPage(){
  const [range, setRange] = useState<DateRange>(()=>def())
  const [summary, setSummary] = useState<Summary>({revenue:0,impressions:0,clicks:0,ecpm:0,ctr:0})
  const [top, setTop] = useState<any[]>([])
  const [editorKey, setEditorKey] = useState<string|null>(null)

  useEffect(()=>{
    Promise.all([
      fetch(`/api/charts?key=alerts.summary&from=${range.from}&to=${range.to}`).then(r=>r.json()),
      fetch(`/api/charts?key=home.top_domains&from=${range.from}&to=${range.to}`).then(r=>r.json()),
    ]).then(([s,t])=>{
      const d = (s.data && s.data[0]) || {}
      setSummary({
        revenue: Number(d.revenue||0),
        impressions: Number(d.impressions||0),
        clicks: Number(d.clicks||0),
        ecpm: Number(d.ecpm||0),
        ctr: Number(d.ctr||0),
      })
      setTop(t.data||[])
    })
  },[range.from, range.to])

  const alerts = buildAlerts(summary, top)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <header className="space-y-3">
          <div className="trk-toolbar">
            <h1 className="text-2xl font-bold">决策提醒</h1>
          </div>
          <TopFilterBar range={range} onChange={setRange} />
        </header>
        <div className="trk-card">
          <h3 className="trk-section-title">Alerts</h3>
          <div className="flex justify-end -mt-2 mb-2"><button className="trk-link" onClick={()=>setEditorKey('alerts.summary')}>编辑聚合查询</button></div>
          <div className="space-y-2">
            {alerts.length === 0 && <div className="trk-subtle">暂无异常</div>}
            {alerts.map((a,i)=> (
              <div key={i} className={`border-l-4 p-3 ${a.type==='warning'?'border-yellow-400 bg-yellow-50':a.type==='error'?'border-red-400 bg-red-50':'border-blue-400 bg-blue-50'}`}>
                <div className="font-medium text-gray-900">{a.title}</div>
                <div className="text-sm text-gray-700">{a.message}</div>
              </div>
            ))}
          </div>
        </div>
        <ChartQueryEditorModal open={!!editorKey} chartKey={editorKey} onClose={()=>setEditorKey(null)} />
      </div>
    </div>
  )
}

function buildAlerts(s: Summary, top: any[]) {
  const arr: any[] = []
  if (s.revenue < 100) arr.push({ type:'warning', title:'收入偏低', message:`当前总收入 $${s.revenue.toFixed(2)}，建议优化广告配置` })
  if (s.ecpm < 1) arr.push({ type:'warning', title:'eCPM 偏低', message:`平均 eCPM 为 $${s.ecpm.toFixed(2)}，低于行业平均` })
  if (s.ctr < 0.5) arr.push({ type:'warning', title:'点击率偏低', message:`平均点击率为 ${s.ctr.toFixed(2)}%` })
  if (top.length>1) {
    const best = top[0], worst = top[top.length-1]
    if (best?.ecpm && worst?.ecpm && Number(worst.ecpm)>0) {
      const ratio = Number(best.ecpm)/Number(worst.ecpm)
      if (ratio>1.5) arr.push({ type:'info', title:'网站表现差异', message:`${best.website} 的 eCPM 是 ${worst.website} 的 ${(ratio).toFixed(1)}x` })
    }
  }
  return arr
}

function def(){const d=new Date();d.setDate(d.getDate()-7);const from=d.toISOString().slice(0,10);const to=new Date().toISOString().slice(0,10);return {from,to}}
