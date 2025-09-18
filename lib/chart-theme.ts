import { formatCurrency as fCur, formatPercentage as fPct } from '@/lib/utils'

export type Series = { name: string; type?: 'line'|'bar'|'column'|'area'; data: (number|null)[] }

export const palette = ['#8B7EFF','#35BDAA','#FFB748','#4240A0','#BCB4FA','#67C5E8']

export function baseOptions(title?: string): any {
  return {
    chart: { toolbar: { show: false }, foreColor: '#374151' },
    grid: { borderColor: '#E5E7EB', strokeDashArray: 2 },
    dataLabels: { enabled: false },
    stroke: { width: 2, curve: 'smooth' },
    legend: { position: 'top', horizontalAlign: 'right', labels: { colors: '#4B5563' } },
    yaxis: intYAxis(),
    tooltip: {
      shared: true,
      x: { show: true },
      custom: function({ series, seriesIndex, dataPointIndex, w }: any) {
        try {
          const x = w.globals.categoryLabels[dataPointIndex]
          const colors = w.globals.colors || []
          const names = w.globals.seriesNames || []
          const rows = series.map((s: any, i: number) => {
            const v = Number(s[dataPointIndex] || 0)
            const name = names[i] || `S${i+1}`
            const val = /revenue/i.test(name) || i===0 ? fCur(v) : `${v.toFixed(2)}`
            const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:9999px;background:${colors[i]||'#999'};margin-right:8px"></span>`
            return `<div style="display:flex;justify-content:space-between;gap:16px;align-items:center;"><div>${dot}${name}</div><div>${val}</div></div>`
          }).join('')
          return `<div class="apexcharts-theme-tooltip" style="padding:8px 10px;min-width:220px">
            <div class="apexcharts-tooltip-title" style="padding:6px 10px;margin:-8px -10px 8px -10px;">${x||''}</div>
            <div style="display:flex;flex-direction:column;gap:6px;">${rows}</div>
          </div>`
        } catch { return undefined as any }
      }
    },
    title: title ? { text: title, align: 'left', style: { fontWeight: 600, color: '#111827' } } : undefined,
    colors: palette
  }
}

export function currencyYAxis(): any {
  return {
    labels: { formatter: (v: number) => '$' + Math.round(Number(v||0)).toString() }
  }
}

// 纵坐标使用整数展示（无小数）
export function intYAxis(): any {
  return { labels: { formatter: (v: number) => String(Math.round(Number(v||0))) } }
}

export function intYAxisWithTitle(title = 'Amount'): any {
  return {
    labels: { formatter: (v: number) => String(Math.round(Number(v||0))) },
    title: { text: title, style: { color: '#6b7280', fontWeight: 600 } }
  }
}

// 贴近 trk_ui donut 中心大数字样式
export function donutOptions(labels: string[], series: number[], title?: string): any {
  return {
    chart: { type: 'donut', toolbar: { show: false } },
    labels,
    series,
    stroke: { width: 0 },
    legend: { position: 'bottom' },
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: { show: true, fontSize: '12px', color: '#111827' },
            value: { show: true, fontSize: '24px', fontWeight: 700, color: '#111827', formatter: (val: string) => `$${Number(val||0).toFixed(2)}` },
            total: {
              show: true,
              label: 'Total',
              color: '#6B7280',
              fontSize: '12px',
              formatter: (w: any) => {
                try {
                  const sum = (w.globals.seriesTotals || []).reduce((s:number,x:number)=>s+Number(x||0),0)
                  return `$${sum.toFixed(2)}`
                } catch { return '' }
              }
            }
          }
        }
      }
    },
    colors: palette
  }
}

// 右侧图例版本：用于报告页要求“指标说明在饼图右侧”。
export function donutOptionsRight(labels: string[], series: number[], title?: string): any {
  return {
    chart: { type: 'donut', toolbar: { show: false } },
    labels,
    series,
    stroke: { width: 0 },
    legend: { position: 'right', horizontalAlign: 'left', labels: { colors: '#4B5563' }, fontSize: '14px', itemMargin: { horizontal: 8, vertical: 6 } },
    responsive: [
      {
        breakpoint: 768,
        options: { legend: { position: 'bottom', horizontalAlign: 'center' } }
      }
    ],
    plotOptions: {
      pie: {
        donut: {
          size: '70%',
          labels: {
            show: true,
            name: { show: true, fontSize: '12px', color: '#111827' },
            value: { show: true, fontSize: '24px', fontWeight: 700, color: '#111827', formatter: (val: string) => `$${Number(val||0).toFixed(2)}` },
            total: {
              show: true,
              label: 'Total',
              color: '#6B7280',
              fontSize: '12px',
              formatter: (w: any) => {
                try {
                  const sum = (w.globals.seriesTotals || []).reduce((s:number,x:number)=>s+Number(x||0),0)
                  return `$${sum.toFixed(2)}`
                } catch { return '' }
              }
            }
          }
        }
      }
    },
    colors: palette
  }
}
