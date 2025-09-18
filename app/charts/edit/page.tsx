'use client'

import { useEffect, useState } from 'react'

export default function ChartQueryEditor() {
  const [keys, setKeys] = useState<string[]>([
    'home.benefit_summary',
    'home.top_domains',
    'report.timeseries',
    'report.device_browser',
    'report.country_table'
  ])
  const [key, setKey] = useState<string>('home.benefit_summary')
  const [sqlText, setSqlText] = useState('')
  const [enabled, setEnabled] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const urlKey = new URLSearchParams(window.location.search).get('key')
    if (urlKey) setKey(urlKey)
  }, [])

  useEffect(() => {
    if (!key) return
    fetch(`/api/chart-queries?key=${encodeURIComponent(key)}`)
      .then(r => r.json())
      .then(d => {
        if (d.item) {
          setSqlText(d.item.sqlText || '')
          setEnabled(d.item.enabled ?? true)
        } else {
          setSqlText(defaultSQL(key))
          setEnabled(true)
        }
      })
  }, [key])

  const save = async () => {
    setMsg('')
    const res = await fetch(`/api/chart-queries/${encodeURIComponent(key)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sqlText, enabled })
    })
    const data = await res.json()
    if (!res.ok) setMsg(`保存失败：${data.error||'未知错误'}`)
    else setMsg('已保存')
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-2 md:pt-3 px-4 md:px-5 pb-4 md:pb-5">
      <div className="max-w-7xl mx-auto space-y-4">
        <h1 className="trk-page-title">图表查询编辑（只读 SELECT）</h1>
        <div className="bg-white rounded shadow p-4 space-y-3">
          <div className="flex gap-3 items-center">
            <label>Chart Key</label>
            <select className="border rounded px-3 py-2" value={key} onChange={e => setKey(e.target.value)}>
              {keys.map(k => <option key={k} value={k}>{k}</option>)}
            </select>
            <label className="ml-6"><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} /> 启用</label>
          </div>
          <textarea className="w-full h-80 border rounded p-3 font-mono" value={sqlText} onChange={e => setSqlText(e.target.value)} />
          <div className="text-sm text-gray-500">支持命名参数：:from、:to、:site；仅允许以 SELECT 开头的查询，禁止 ; / DML/DDL/DCL。</div>
          <div className="flex gap-3">
            <button onClick={save} className="px-4 py-2 bg-blue-600 text-white rounded">保存</button>
            {msg && <span className="text-sm text-gray-700">{msg}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function defaultSQL(key: string) {
  switch (key) {
    case 'home.benefit_summary':
      return `SELECT dataDate::date AS day, SUM(revenue)::numeric AS adx_revenue FROM "AdReport" WHERE dataDate BETWEEN :from AND :to GROUP BY 1 ORDER BY 1;`
    case 'home.top_domains':
      return `SELECT website, SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks, CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr, CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm, SUM(revenue)::numeric AS revenue FROM "AdReport" WHERE dataDate BETWEEN :from AND :to GROUP BY website ORDER BY revenue DESC LIMIT 50;`
    case 'report.timeseries':
      return `SELECT dataDate::date AS day, SUM(revenue)::numeric AS revenue, SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks, CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm FROM "AdReport" WHERE website = :site AND dataDate BETWEEN :from AND :to GROUP BY 1 ORDER BY 1;`
    case 'report.device_browser':
      return `SELECT device, browser, SUM(revenue)::numeric AS revenue, SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks FROM "AdReport" WHERE website = :site AND dataDate BETWEEN :from AND :to GROUP BY 1,2 ORDER BY revenue DESC LIMIT 100;`
    case 'report.country_table':
      return `SELECT country, SUM(impressions)::bigint AS impressions, SUM(clicks)::bigint AS clicks, CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr, CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm, SUM(revenue)::numeric AS revenue FROM "AdReport" WHERE website = :site AND dataDate BETWEEN :from AND :to GROUP BY country ORDER BY revenue DESC LIMIT 200;`
    default:
      return ''
  }
}
