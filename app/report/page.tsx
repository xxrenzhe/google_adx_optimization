'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import TopFilterBar, { DateRange } from '@/components/TopFilterBar'
import DateRangeBar from '@/components/DateRangeBar'
import ChartQueryEditorModal from '@/components/ChartQueryEditorModal'
import { baseOptions } from '@/lib/chart-theme'
import { formatCurrency } from '@/lib/utils'

const ApexChart: any = dynamic(() => import('react-apexcharts') as any, { ssr: false }) as any

type Site = { id: number; domain: string }

export default function ReportPage() {
  const [sites, setSites] = useState<Site[]>([])
  const [site, setSite] = useState<string>('')
  const [range, setRange] = useState<DateRange>(() => defaultYesterday())
  const [timeseries, setTimeseries] = useState<any[]>([])
  const [devBrowser, setDevBrowser] = useState<any[]>([])
  const [countries, setCountries] = useState<any[]>([])
  const [kpiSeries, setKpiSeries] = useState<any[]>([])
  const [devicesKpi, setDevicesKpi] = useState<any[]>([])
  const [browsersKpi, setBrowsersKpi] = useState<any[]>([])
  const [adunitsKpi, setAdunitsKpi] = useState<any[]>([])
  const [advertisersKpi, setAdvertisersKpi] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [compare, setCompare] = useState(false)
  const [timeseriesPrev, setTimeseriesPrev] = useState<any[]>([])
  const [editorKey, setEditorKey] = useState<string|null>(null)
  const [summaryCards, setSummaryCards] = useState<any>({ revenue:0, cost:0, profit:0, roi:null, cpc:null, adx:0, offer:0, yahoo:0 })

  useEffect(() => {
    fetch('/api/sites').then(r => r.json()).then(d => {
      if (d.items) {
        setSites(d.items)
        const sp = new URLSearchParams(window.location.search)
        const fromUrl = sp.get('sites')
        const rangeParam = sp.get('range')
        const pick = fromUrl || d.items[0]?.domain || ''
        setSite(pick)
        if (rangeParam) {
          const parts = rangeParam.split(/\s*-\s*/)
          if (parts.length === 2) {
            const [from, to] = parts
            if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to)) {
              setRange({ from, to })
            }
          }
        }
      }
    })
  }, [])

  useEffect(() => {
    if (!site) return
    setLoading(true)
    const mk = (key: string, f=range.from, t=range.to) => new URLSearchParams({ key, site, from: f, to: t })
    const prev = previousRange(range)
    Promise.all([
      fetch('/api/charts?' + mk('report.timeseries')).then(r => r.json()),
      compare ? fetch('/api/charts?' + mk('report.timeseries', prev.from, prev.to)).then(r => r.json()) : Promise.resolve({ data: [] }),
      fetch('/api/charts?' + mk('report.device_browser')).then(r => r.json()),
      fetch('/api/charts?' + mk('report.country_table_kpi')).then(r => r.json()).catch(()=>({data:[]})),
      fetch('/api/charts?' + mk('report.device_table_kpi')).then(r => r.json()).catch(()=>({data:[]})),
      fetch('/api/charts?' + mk('report.browser_table_kpi')).then(r => r.json()).catch(()=>({data:[]})),
      fetch('/api/charts?' + mk('report.adunit_table_kpi')).then(r => r.json()).catch(()=>({data:[]})),
      fetch('/api/charts?' + mk('report.advertiser_table_kpi')).then(r => r.json()).catch(()=>({data:[]})),
      fetch('/api/charts?' + mk('report.kpi_series')).then(r => r.json()).catch(()=>({data:[]})),
      fetch(`/api/report/summary?site=${encodeURIComponent(site)}&from=${range.from}&to=${range.to}`).then(r => r.json()).catch(()=>({data:{}})),
    ]).then(([ts, tsPrev, db, ct, dk, bk, ak, rk, ks, sm]) => {
      setTimeseries(ts.data || [])
      setTimeseriesPrev(tsPrev.data || [])
      setDevBrowser(db.data || [])
      setCountries(ct.data || [])
      setDevicesKpi(dk.data || [])
      setBrowsersKpi(bk.data || [])
      setAdunitsKpi(ak.data || [])
      setAdvertisersKpi(rk.data || [])
      setKpiSeries(ks.data || [])
      setSummaryCards(sm.data || {})
    }).finally(() => setLoading(false))
  }, [site, range.from, range.to, compare])

  const tsOptions = useMemo(() => {
    const cats = timeseries.map((x: any) => x.day?.slice(0,10))
    const series: any[] = [
      { name: 'Revenue', type: 'line', data: timeseries.map((x: any) => Number(x.revenue||0)) },
      { name: 'eCPM', type: 'line', data: timeseries.map((x: any) => Number(x.ecpm||0)) },
      { name: 'Clicks', type: 'column', data: timeseries.map((x: any) => Number(x.clicks||0)) },
      { name: 'Impr', type: 'column', data: timeseries.map((x: any) => Number(x.impressions||0)) },
    ]
    if (compare && timeseriesPrev.length) {
      const prevCats = timeseriesPrev.map((x:any)=>x.day?.slice(0,10))
      series.unshift({ name: 'Revenue (Prev)', type: 'line', data: prevCats.map((d:string)=> Number((timeseriesPrev.find((x:any)=> (x.day||'').slice(0,10)===d)?.revenue||0))) })
    }
    const opts = baseOptions('Revenue / eCPM / Clicks / Impr')
    return { ...opts, chart:{...opts.chart, type:'line', height:280}, xaxis:{ categories: cats }, stroke:{ curve:'smooth' }, series, yaxis:[{},{}] }
  }, [timeseries, timeseriesPrev, compare])

  const deviceAgg = useMemo(() => {
    const map = new Map<string, number>()
    devBrowser.forEach((r: any) => {
      const k = r.device || 'Unknown'
      map.set(k, (map.get(k)||0) + Number(r.revenue||0))
    })
    const labels = Array.from(map.keys())
    const series = labels.map(l => Number(map.get(l)||0))
    return { labels, series }
  }, [devBrowser])

  const kpiOptions = useMemo(() => ({
    chart: { type: 'line', height: 280 },
    xaxis: { categories: kpiSeries.map((x: any) => x.day?.slice(0,10)) },
    stroke: { curve: 'smooth' },
    series: [
      { name: 'Profit', type: 'line', data: kpiSeries.map((x: any) => Number(x.profit ?? 0)) },
      { name: 'ROI %', type: 'line', data: kpiSeries.map((x: any) => x.roi != null ? Number(x.roi) : null) },
      { name: 'CPC', type: 'line', data: kpiSeries.map((x: any) => x.cpc != null ? Number(x.cpc) : null) },
    ],
  }), [kpiSeries])

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="space-y-3">
          <div className="trk-toolbar">
            <h1 className="text-2xl font-bold">Report</h1>
          </div>
          <DateRangeBar
            range={range}
            onChange={setRange}
            onCompareChange={setCompare}
            extraLeft={
              <select className="border rounded px-3 py-2" value={site} onChange={e => {
                const val = e.target.value
                setSite(val)
                const url = new URL(window.location.href)
                url.searchParams.set('sites', val)
                url.searchParams.set('range', `${range.from} - ${range.to}`)
                window.history.replaceState({}, '', url)
              }}>
                {sites.map(s => <option key={s.id} value={s.domain}>{s.domain}</option>)}
              </select>
            }
          />
        </header>

        {loading && <div>加载中…</div>}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="trk-card">
            <div className="trk-subtle">Total Revenue</div>
            <div className="trk-kpi">{formatCurrency(Number(summaryCards.revenue||0))}</div>
            <div className="trk-subtle">ADX: ${Number(summaryCards.adx||0).toFixed(2)} | Offer: ${Number(summaryCards.offer||0).toFixed(2)} | Yahoo: ${Number(summaryCards.yahoo||0).toFixed(2)}</div>
          </div>
          <div className="trk-card">
            <div className="trk-subtle">Cost</div>
            <div className="trk-kpi">{formatCurrency(Number(summaryCards.cost||0))}</div>
            <div className="trk-subtle">CPC: {summaryCards.cpc!=null? `$${Number(summaryCards.cpc).toFixed(4)}`:'—'}</div>
          </div>
          <div className="trk-card">
            <div className="trk-subtle">Profit</div>
            <div className="trk-kpi">${Number(summaryCards.profit||0).toFixed(2)}</div>
          </div>
          <div className="trk-card">
            <div className="trk-subtle">ROI</div>
            <div className="trk-kpi">{summaryCards.roi!=null? `${Number(summaryCards.roi).toFixed(2)}%`:'—'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="trk-card">
            <h3 className="trk-section-title">Revenue / eCPM / Clicks / Impr</h3>
            {typeof window !== 'undefined' && (
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              <ApexChart options={tsOptions} series={tsOptions.series} type="line" height={280} />
            )}
            <div className="flex justify-end mt-2"><button className="trk-link" onClick={()=>setEditorKey('report.timeseries')}>编辑查询</button></div>
          </div>
          <div className="trk-card">
            <h3 className="trk-section-title">Device Type（Only ADX）</h3>
            {typeof window !== 'undefined' && (
              // eslint-disable-next-line @typescript-eslint/ban-ts-comment
              // @ts-ignore
              <ApexChart options={{ labels: deviceAgg.labels }} series={deviceAgg.series} type="donut" height={280} />
            )}
            <div className="flex justify-end mt-2"><button className="trk-link" onClick={()=>setEditorKey('report.device_browser')}>编辑查询</button></div>
          </div>
        </div>

        <div className="trk-card">
          <h3 className="trk-section-title">Profit / ROI / CPC（按日）</h3>
          {typeof window !== 'undefined' && (
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            <ApexChart options={kpiOptions} series={kpiOptions.series} type="line" height={280} />
          )}
          <div className="flex justify-end mt-2"><button className="trk-link" onClick={()=>setEditorKey('report.kpi_series')}>编辑查询</button></div>
        </div>

        <div className="trk-card">
          <h3 className="trk-section-title">Top Countries（含分摊成本）</h3>
          <div className="overflow-x-auto">
            <table className="trk-table min-w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Country</th>
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
                {countries.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 pr-4">{r.country || 'Unknown'}</td>
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
            <div className="trk-subtle">注：成本按日按收入占比分摊，作为近似指标。</div>
            <button className="trk-link" onClick={()=>setEditorKey('report.country_table_kpi')}>编辑查询</button>
          </div>
          <ChartQueryEditorModal open={!!editorKey} chartKey={editorKey} onClose={()=>setEditorKey(null)} />
        </div>

        <div className="trk-card">
          <h3 className="trk-section-title">Top Browsers（含分摊成本）</h3>
          <div className="overflow-x-auto">
            <table className="trk-table min-w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Browser</th>
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
                {browsersKpi.map((r:any, i:number) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 pr-4">{r.browser || 'Unknown'}</td>
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
            <div className="trk-subtle">注：成本按日按收入占比分摊，作为近似指标。</div>
            <button className="trk-link" onClick={()=>setEditorKey('report.browser_table_kpi')}>编辑查询</button>
          </div>
        </div>

        <div className="trk-card">
          <h3 className="trk-section-title">Top Ad Units（含分摊成本）</h3>
          <div className="overflow-x-auto">
            <table className="trk-table min-w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-4">AdUnit</th>
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
                {adunitsKpi.map((r:any, i:number) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 pr-4">{r.adunit || r.adUnit || 'Unknown'}</td>
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
            <div className="trk-subtle">注：成本按日按收入占比分摊，作为近似指标。</div>
            <button className="trk-link" onClick={()=>setEditorKey('report.adunit_table_kpi')}>编辑查询</button>
          </div>
        </div>

        <div className="trk-card">
          <h3 className="trk-section-title">Top Advertisers（含分摊成本）</h3>
          <div className="overflow-x-auto">
            <table className="trk-table min-w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Advertiser</th>
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
                {advertisersKpi.map((r:any, i:number) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 pr-4">{r.advertiser || 'Unknown'}</td>
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
            <div className="trk-subtle">注：成本按日按收入占比分摊，作为近似指标。</div>
            <button className="trk-link" onClick={()=>setEditorKey('report.advertiser_table_kpi')}>编辑查询</button>
          </div>
        </div>

        <div className="trk-card">
          <h3 className="trk-section-title">Top Devices（含分摊成本）</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-gray-500">
                <tr>
                  <th className="py-2 pr-4">Device</th>
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
                {devicesKpi.map((r:any, i:number) => (
                  <tr key={i} className="border-t">
                    <td className="py-2 pr-4">{r.device || 'Unknown'}</td>
                    <td className="py-2 pr-4">{String(r.impressions)}</td>
                    <td className="py-2 pr-4">{String(r.clicks)}</td>
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
            <div className="trk-subtle">注：成本按日按收入占比分摊，作为近似指标。</div>
            <button className="trk-link" onClick={()=>setEditorKey('report.device_table_kpi')}>编辑查询</button>
          </div>
        </div>
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
