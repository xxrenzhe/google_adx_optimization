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
    labels: { formatter: (v: number) => '$' + Number(v||0).toFixed(2) }
  }
}
