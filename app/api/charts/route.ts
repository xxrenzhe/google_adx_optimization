import { NextRequest, NextResponse } from 'next/server'
import { prismaRead } from '@/lib/prisma-extended'
import { bindNamedParams, validateSelectOnly } from '@/lib/sql-guard'
import { logInfo, logError, timeStart } from '@/lib/logger'
import { getCachedData, setCachedData } from '@/lib/redis-cache'

// 简化版：按 chart key 分派到 Prisma 查询（未来可切换到 ChartQueries 动态SQL）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key') || ''
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    const toEnd = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? new Date(`${to}T23:59:59.999`) : (to ? new Date(to) : null)
    const site = searchParams.get('site') || ''

    if (!from || !to) {
      return NextResponse.json({ error: '缺少时间范围' }, { status: 400 })
    }

    // 结果缓存（短期）
    const cacheKey = `charts:${key}:from:${from}:to:${to}:site:${site || 'all'}`
    const cached = await getCachedData<any>(cacheKey)
    if (cached) return NextResponse.json(cached)

    // 优先使用 ChartQueries（可编辑查询）
    const db = prismaRead as any
    let cq: any | null = null
    try {
      cq = await db.chartQuery.findUnique({ where: { chartKey: key } })
    } catch (e: any) {
      // If chart_queries table does not exist yet, fall back to built-ins
      if (!(e?.code === 'P2021')) throw e
    }
    if (cq && cq.enabled) {
      const val = validateSelectOnly(cq.sqlText)
      if (val.ok) {
        const sqlBound = bindNamedParams(cq.sqlText, { from, to, site: site || undefined })
        const end = timeStart('API/CHARTS', 'query', { key, from, to, site, mode: 'chartQueries' })
        try {
          const rows: any[] = await prismaRead.$queryRawUnsafe(sqlBound)
          const payload = { ok: true, data: toJSONNumbers(rows) }
          await setCachedData(cacheKey, payload, 120)
          end()
          logInfo('API/CHARTS', 'success', { key, rows: rows.length })
          return NextResponse.json(payload)
        } catch (e: any) {
          // 缺表等情况降级为空数据，便于前端展示“无法显示原因”并保留编辑能力
          if (e?.meta?.code === '42P01') {
            const payload = { ok: true, data: [], missing: 'relation' }
            await setCachedData(cacheKey, payload, 60)
            end()
            logInfo('API/CHARTS', 'missing relation', { key })
            return NextResponse.json(payload)
          }
          end()
          // 非预期错误：记录后回退到内置查询
          logError('API/CHARTS', 'query failed, fallback builtin', e, { key })
        }
      } else {
        // 校验失败：不直接 400，回退到内置查询，避免前端空白
        logInfo('API/CHARTS', 'validation failed, fallback builtin', { key, reason: val.error })
      }
    }

    // 回退到内置查询
    const end2 = timeStart('API/CHARTS', 'builtin', { key, from, to, site })
    switch (key) {
      case 'home.benefit_summary':
        const payload1 = {
          ok: true,
          onlyAdx: true,
          data: await benefitSummary(from, toEnd ? toEnd.toISOString() : to)
        }
        await setCachedData(cacheKey, payload1, 120)
        end2()
        logInfo('API/CHARTS', 'success', { key, rows: (payload1.data as any[]).length })
        return NextResponse.json(payload1)
      case 'home.top_domains':
        {
          const payload2 = { ok: true, data: toJSONNumbers(await topDomains(from, to)) }
          await setCachedData(cacheKey, payload2, 120)
          end2(); logInfo('API/CHARTS', 'success', { key, rows: (payload2.data as any[]).length })
          return NextResponse.json(payload2)
        }
      case 'report.timeseries':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        {
          const payload3 = { ok: true, data: toJSONNumbers(await siteTimeseries(site, from, toEnd ? toEnd.toISOString() : to)) }
          await setCachedData(cacheKey, payload3, 120)
          end2(); logInfo('API/CHARTS', 'success', { key, rows: (payload3.data as any[]).length })
          return NextResponse.json(payload3)
        }
      case 'report.device_browser':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        {
          const payload4 = { ok: true, data: toJSONNumbers(await deviceBrowser(site, from, toEnd ? toEnd.toISOString() : to)) }
          await setCachedData(cacheKey, payload4, 120)
          end2(); logInfo('API/CHARTS', 'success', { key, rows: (payload4.data as any[]).length })
          return NextResponse.json(payload4)
        }
      case 'report.kpi_series':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        try {
          const rows = await kpiSeries(site, from, toEnd ? toEnd.toISOString() : to)
          const payload = { ok: true, data: toJSONNumbers(rows) }
          await setCachedData(cacheKey, payload, 120)
          end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
          return NextResponse.json(payload)
        } catch (e: any) {
          if (e?.meta?.code === '42P01') { const payload = { ok: true, data: [], missing: 'relation' }; await setCachedData(cacheKey, payload, 60); end2(); return NextResponse.json(payload) }
          end2(); logError('API/CHARTS', 'builtin kpi_series failed', e, { key }); return NextResponse.json({ error: '查询失败' }, { status: 500 })
        }
      case 'report.country_table_kpi':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        try {
          const rows = await countryTableKpi(site, from, to)
          const payload = { ok: true, data: toJSONNumbers(rows) }
          await setCachedData(cacheKey, payload, 120)
          end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
          return NextResponse.json(payload)
        } catch (e: any) {
          if (e?.meta?.code === '42P01') { const payload = { ok: true, data: [], missing: 'relation' }; await setCachedData(cacheKey, payload, 60); end2(); return NextResponse.json(payload) }
          end2(); logError('API/CHARTS', 'builtin country_table_kpi failed', e, { key }); return NextResponse.json({ error: '查询失败' }, { status: 500 })
        }
      case 'report.device_table_kpi':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        try {
          const rows = await deviceTableKpi(site, from, to)
          const payload = { ok: true, data: toJSONNumbers(rows) }
          await setCachedData(cacheKey, payload, 120)
          end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
          return NextResponse.json(payload)
        } catch (e: any) {
          if (e?.meta?.code === '42P01') { const payload = { ok: true, data: [], missing: 'relation' }; await setCachedData(cacheKey, payload, 60); end2(); return NextResponse.json(payload) }
          end2(); logError('API/CHARTS', 'builtin device_table_kpi failed', e, { key }); return NextResponse.json({ error: '查询失败' }, { status: 500 })
        }
      case 'report.browser_table_kpi':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        try {
          const rows = await browserTableKpi(site, from, toEnd ? toEnd.toISOString() : to)
          const payload = { ok: true, data: toJSONNumbers(rows) }
          await setCachedData(cacheKey, payload, 120)
          end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
          return NextResponse.json(payload)
        } catch (e: any) {
          if (e?.meta?.code === '42P01') { const payload = { ok: true, data: [], missing: 'relation' }; await setCachedData(cacheKey, payload, 60); end2(); return NextResponse.json(payload) }
          end2(); logError('API/CHARTS', 'builtin browser_table_kpi failed', e, { key }); return NextResponse.json({ error: '查询失败' }, { status: 500 })
        }
      case 'report.adunit_table_kpi':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        try {
          const rows = await adunitTableKpi(site, from, toEnd ? toEnd.toISOString() : to)
          const payload = { ok: true, data: toJSONNumbers(rows) }
          await setCachedData(cacheKey, payload, 120)
          end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
          return NextResponse.json(payload)
        } catch (e: any) {
          if (e?.meta?.code === '42P01') { const payload = { ok: true, data: [], missing: 'relation' }; await setCachedData(cacheKey, payload, 60); end2(); return NextResponse.json(payload) }
          end2(); logError('API/CHARTS', 'builtin adunit_table_kpi failed', e, { key }); return NextResponse.json({ error: '查询失败' }, { status: 500 })
        }
      case 'report.advertiser_table_kpi':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        try {
          const rows = await advertiserTableKpi(site, from, toEnd ? toEnd.toISOString() : to)
          const payload = { ok: true, data: toJSONNumbers(rows) }
          await setCachedData(cacheKey, payload, 120)
          end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
          return NextResponse.json(payload)
        } catch (e: any) {
          if (e?.meta?.code === '42P01') { const payload = { ok: true, data: [], missing: 'relation' }; await setCachedData(cacheKey, payload, 60); end2(); return NextResponse.json(payload) }
          end2(); logError('API/CHARTS', 'builtin advertiser_table_kpi failed', e, { key }); return NextResponse.json({ error: '查询失败' }, { status: 500 })
        }
      case 'report.ecpm_series':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        try {
          const rows = await ecpmSeries(site, from, toEnd ? toEnd.toISOString() : to)
          const payload = { ok: true, data: toJSONNumbers(rows) }
          await setCachedData(cacheKey, payload, 120)
          end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
          return NextResponse.json(payload)
        } catch (e: any) {
          if (e?.meta?.code === '42P01') { const payload = { ok: true, data: [], missing: 'relation' }; await setCachedData(cacheKey, payload, 60); end2(); return NextResponse.json(payload) }
          end2(); logError('API/CHARTS', 'builtin ecpm_series failed', e, { key }); return NextResponse.json({ error: '查询失败' }, { status: 500 })
        }
      case 'analytics.revenue_by_day': {
        const rows = await prismaRead.$queryRaw<Array<{ day: Date; revenue: number }>>`
          SELECT date_trunc('day', "dataDate")::date AS day,
                 SUM(COALESCE("revenue",0))::numeric AS revenue
          FROM   "AdReport"
          WHERE  "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
          GROUP  BY 1
          ORDER  BY 1
        `
        const payload = { ok: true, data: toJSONNumbers(rows) }
        await setCachedData(cacheKey, payload, 120)
        end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
        return NextResponse.json(payload)
      }
      case 'analytics.revenue_by_country': {
        const rows = await prismaRead.$queryRaw<Array<{ country: string|null; revenue: number }>>`
          SELECT "country",
                 SUM(COALESCE("revenue",0))::numeric AS revenue
          FROM   "AdReport"
          WHERE  "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
          GROUP  BY 1
          ORDER  BY revenue DESC
          LIMIT  20
        `
        const payload = { ok: true, data: toJSONNumbers(rows) }
        await setCachedData(cacheKey, payload, 120)
        end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
        return NextResponse.json(payload)
      }
      case 'analytics.revenue_by_device': {
        const rows = await prismaRead.$queryRaw<Array<{ device: string|null; revenue: number }>>`
          SELECT "device",
                 SUM(COALESCE("revenue",0))::numeric AS revenue
          FROM   "AdReport"
          WHERE  "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
          GROUP  BY 1
          ORDER  BY revenue DESC
        `
        const payload = { ok: true, data: toJSONNumbers(rows) }
        await setCachedData(cacheKey, payload, 120)
        end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
        return NextResponse.json(payload)
      }
      case 'analytics.ecpm_distribution': {
        const rows = await prismaRead.$queryRaw<Array<{ bucket: string; impressions: bigint }>>`
          WITH rows AS (
            SELECT CASE WHEN COALESCE("impressions",0)>0
                        THEN COALESCE("revenue",0)::numeric/NULLIF(COALESCE("impressions",0),0)::numeric*1000
                        ELSE 0 END AS ecpm,
                   COALESCE("impressions",0) AS impressions
            FROM "AdReport"
            WHERE "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
          )
          SELECT bucket,
                 SUM(impressions)::bigint AS impressions
          FROM (
            SELECT CASE
                     WHEN ecpm < 10 THEN '$0-10'
                     WHEN ecpm < 25 THEN '$10-25'
                     WHEN ecpm < 50 THEN '$25-50'
                     WHEN ecpm < 100 THEN '$50-100'
                     ELSE '$100+'
                   END AS bucket,
                   impressions
            FROM rows
          ) t
          GROUP BY bucket
          ORDER BY CASE bucket WHEN '$0-10' THEN 1 WHEN '$10-25' THEN 2 WHEN '$25-50' THEN 3 WHEN '$50-100' THEN 4 ELSE 5 END
        `
        const payload = { ok: true, data: toJSONNumbers(rows) }
        await setCachedData(cacheKey, payload, 120)
        end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
        return NextResponse.json(payload)
      }
      case 'enhanced.advertisers': {
        const rows = await prismaRead.$queryRaw<Array<any>>`
          SELECT "advertiser",
                 SUM(COALESCE("revenue",0))::numeric AS revenue,
                 SUM(COALESCE("impressions",0))::bigint AS impressions,
                 SUM(COALESCE("clicks",0))::bigint      AS clicks,
                 CASE WHEN SUM(COALESCE("impressions",0))>0
                      THEN SUM(COALESCE("revenue",0))::numeric/SUM(COALESCE("impressions",0))::numeric*1000
                      ELSE 0 END AS ecpm,
                 CASE WHEN SUM(COALESCE("impressions",0))>0
                      THEN SUM(COALESCE("clicks",0))::numeric/SUM(COALESCE("impressions",0))::numeric*100
                      ELSE 0 END AS ctr
          FROM "AdReport"
          WHERE "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
          GROUP BY "advertiser"
          ORDER BY revenue DESC
          LIMIT 20
        `
        const payload = { ok: true, data: toJSONNumbers(rows) }
        await setCachedData(cacheKey, payload, 120)
        end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
        return NextResponse.json(payload)
      }
      case 'enhanced.device_browser_matrix': {
        const rows = await prismaRead.$queryRaw<Array<any>>`
          SELECT "device", "browser",
                 SUM(COALESCE("revenue",0))::numeric    AS revenue,
                 SUM(COALESCE("impressions",0))::bigint AS impressions,
                 CASE WHEN SUM(COALESCE("impressions",0))>0
                      THEN SUM(COALESCE("revenue",0))::numeric/SUM(COALESCE("impressions",0))::numeric*1000
                      ELSE 0 END AS ecpm
          FROM "AdReport"
          WHERE "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
          GROUP BY 1,2
          ORDER BY revenue DESC
          LIMIT 200
        `
        const payload = { ok: true, data: toJSONNumbers(rows) }
        await setCachedData(cacheKey, payload, 120)
        end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
        return NextResponse.json(payload)
      }
      case 'enhanced.top_combinations': {
        const rows = await prismaRead.$queryRaw<Array<any>>`
          SELECT "country", "device", "adFormat",
                 SUM(COALESCE("revenue",0))::numeric    AS revenue,
                 SUM(COALESCE("impressions",0))::bigint AS impressions,
                 CASE WHEN SUM(COALESCE("impressions",0))>0
                      THEN SUM(COALESCE("revenue",0))::numeric/SUM(COALESCE("impressions",0))::numeric*1000
                      ELSE 0 END AS ecpm
          FROM "AdReport"
          WHERE "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
          GROUP BY 1,2,3
          ORDER BY ecpm DESC, revenue DESC
          LIMIT 20
        `
        const payload = { ok: true, data: toJSONNumbers(rows) }
        await setCachedData(cacheKey, payload, 120)
        end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
        return NextResponse.json(payload)
      }
      case 'alerts.summary': {
        const rows = await prismaRead.$queryRaw<Array<any>>`
          SELECT SUM(COALESCE("revenue",0))::numeric    AS revenue,
                 SUM(COALESCE("impressions",0))::bigint AS impressions,
                 SUM(COALESCE("clicks",0))::bigint      AS clicks,
                 CASE WHEN SUM(COALESCE("impressions",0))>0
                      THEN SUM(COALESCE("revenue",0))::numeric/SUM(COALESCE("impressions",0))::numeric*1000
                      ELSE 0 END AS ecpm,
                 CASE WHEN SUM(COALESCE("impressions",0))>0
                      THEN SUM(COALESCE("clicks",0))::numeric/SUM(COALESCE("impressions",0))::numeric*100
                      ELSE 0 END AS ctr
          FROM "AdReport"
          WHERE "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
        `
        const payload = { ok: true, data: toJSONNumbers(rows) }
        await setCachedData(cacheKey, payload, 120)
        end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
        return NextResponse.json(payload)
      }
      case 'report.cpc_series':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        try {
          const rows = await cpcSeries(site, from, toEnd ? toEnd.toISOString() : to)
          const payload = { ok: true, data: toJSONNumbers(rows) }
          await setCachedData(cacheKey, payload, 120)
          end2(); logInfo('API/CHARTS', 'success', { key, rows: rows.length })
          return NextResponse.json(payload)
        } catch (e: any) {
          if (e?.meta?.code === '42P01') { const payload = { ok: true, data: [], missing: 'relation' }; await setCachedData(cacheKey, payload, 60); end2(); return NextResponse.json(payload) }
          end2(); logError('API/CHARTS', 'builtin cpc_series failed', e, { key }); return NextResponse.json({ error: '查询失败' }, { status: 500 })
        }
      case 'report.country_table':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        {
          const payload5 = { ok: true, data: toJSONNumbers(await countryTable(site, from, to)) }
          await setCachedData(cacheKey, payload5, 120)
          end2(); logInfo('API/CHARTS', 'success', { key, rows: (payload5.data as any[]).length })
          return NextResponse.json(payload5)
        }
      default:
        end2();
        logInfo('API/CHARTS', 'unknown key', { key })
        return NextResponse.json({ error: '未知的图表 key' }, { status: 400 })
    }
  } catch (e) {
    logError('API/CHARTS', 'unhandled error', e)
    return NextResponse.json({ error: '查询失败' }, { status: 500 })
  }
}

async function benefitSummary(from: string, to: string) {
  const rows = await prismaRead.$queryRaw<Array<{ day: Date; revenue: number }>>`
    SELECT date_trunc('day', "dataDate")::date AS day,
           SUM(COALESCE("revenue",0))::numeric AS revenue
    FROM   "AdReport"
    WHERE  "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
    GROUP  BY 1
    ORDER  BY 1
  `
  return rows
}

async function topDomains(from: string, to: string) {
  const rows = await prismaRead.$queryRaw<Array<{
    website: string;
    impressions: bigint;
    clicks: bigint;
    ctr: number;
    ecpm: number;
    revenue: number;
  }>>`
    SELECT "website",
           SUM(COALESCE("impressions",0))::bigint AS impressions,
           SUM(COALESCE("clicks",0))::bigint      AS clicks,
           CASE WHEN SUM(COALESCE("impressions",0))>0
                THEN (SUM(COALESCE("clicks",0))::numeric / SUM(COALESCE("impressions",0))::numeric) * 100
                ELSE 0 END AS ctr,
           CASE WHEN SUM(COALESCE("impressions",0))>0
                THEN (SUM(COALESCE("revenue",0))::numeric / SUM(COALESCE("impressions",0))::numeric) * 1000
                ELSE 0 END AS ecpm,
           SUM(COALESCE("revenue",0))::numeric AS revenue
    FROM   "AdReport"
    WHERE  "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
    GROUP  BY "website"
    ORDER  BY revenue DESC
    LIMIT  50
  `
  return rows
}

async function siteTimeseries(site: string, from: string, to: string) {
  const rows = await prismaRead.$queryRaw<Array<{
    day: Date;
    revenue: number;
    impressions: bigint;
    clicks: bigint;
    ecpm: number;
  }>>`
    SELECT date_trunc('day', "dataDate")::date AS day,
           SUM(COALESCE("revenue",0))::numeric AS revenue,
           SUM(COALESCE("impressions",0))::bigint AS impressions,
           SUM(COALESCE("clicks",0))::bigint AS clicks,
           CASE WHEN SUM(COALESCE("impressions",0))>0
                THEN (SUM(COALESCE("revenue",0))::numeric / SUM(COALESCE("impressions",0))::numeric) * 1000
                ELSE 0 END AS ecpm
    FROM   "AdReport"
    WHERE  "website" = ${site}
      AND  "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
    GROUP  BY 1
    ORDER  BY 1
  `
  return rows
}

async function deviceBrowser(site: string, from: string, to: string) {
  const rows = await prismaRead.$queryRaw<Array<{
    device: string | null;
    browser: string | null;
    revenue: number;
    impressions: bigint;
    clicks: bigint;
  }>>`
    SELECT "device", "browser",
           SUM(COALESCE("revenue",0))::numeric AS revenue,
           SUM(COALESCE("impressions",0))::bigint AS impressions,
           SUM(COALESCE("clicks",0))::bigint AS clicks
    FROM   "AdReport"
    WHERE  "website" = ${site}
      AND  "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
    GROUP  BY 1,2
    ORDER  BY revenue DESC
    LIMIT  100
  `
  return rows
}

function toJSONNumbers<T extends Record<string, any>>(rows: T[]): any[] {
  return rows.map((r) => {
    const o: any = {}
    for (const k of Object.keys(r)) {
      const v: any = (r as any)[k]
      if (typeof v === 'bigint') o[k] = Number(v)
      else o[k] = v
    }
    return o
  })
}

async function countryTable(site: string, from: string, to: string) {
  const rows = await prismaRead.$queryRaw<Array<{
    country: string | null;
    impressions: bigint;
    clicks: bigint;
    ctr: number;
    ecpm: number;
    revenue: number;
  }>>`
    SELECT "country",
           SUM(COALESCE("impressions",0))::bigint AS impressions,
           SUM(COALESCE("clicks",0))::bigint AS clicks,
           CASE WHEN SUM(COALESCE("impressions",0))>0
                THEN (SUM(COALESCE("clicks",0))::numeric / SUM(COALESCE("impressions",0))::numeric) * 100
                ELSE 0 END AS ctr,
           CASE WHEN SUM(COALESCE("impressions",0))>0
                THEN (SUM(COALESCE("revenue",0))::numeric / SUM(COALESCE("impressions",0))::numeric) * 1000
                ELSE 0 END AS ecpm,
           SUM(COALESCE("revenue",0))::numeric AS revenue
    FROM   "AdReport"
    WHERE  "website" = ${site}
      AND  "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
    GROUP  BY 1
    ORDER  BY revenue DESC
    LIMIT  200
  `
  return rows
}

// KPI 序列（按日：profit / roi / cpc）
async function kpiSeries(site: string, from: string, to: string) {
  const rows = await prismaRead.$queryRaw<Array<{ day: Date; profit: number|null; roi: number|null; cpc: number|null }>>`
    WITH rev AS (
      SELECT date_trunc('day', "dataDate")::date AS day, SUM(COALESCE("revenue",0))::numeric AS revenue
      FROM "AdReport" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)} GROUP BY 1
    ), cost AS (
      SELECT date_trunc('day', "dataDate")::date AS day, SUM(COALESCE("cost",0))::numeric AS cost, SUM(COALESCE("clicks",0))::bigint AS clicks
      FROM "ad_costs" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)} GROUP BY 1
    )
    SELECT COALESCE(r.day, c.day) AS day,
           COALESCE(r.revenue,0) - COALESCE(c.cost,0) AS profit,
           CASE WHEN COALESCE(c.cost,0)>0 THEN COALESCE(r.revenue,0)/COALESCE(c.cost,0)*100 ELSE NULL END AS roi,
           CASE WHEN COALESCE(c.clicks,0)>0 THEN COALESCE(c.cost,0)/NULLIF(COALESCE(c.clicks,0),0) ELSE NULL END AS cpc
    FROM rev r FULL OUTER JOIN cost c ON r.day = c.day
    ORDER BY 1
  `
  return rows
}

// Country 表（含按日分摊成本）
async function countryTableKpi(site: string, from: string, to: string) {
  const rows = await prismaRead.$queryRaw<Array<any>>`
    WITH rev_country_day AS (
      SELECT date_trunc('day', "dataDate")::date AS day, "country",
             SUM(COALESCE("revenue",0))::numeric AS revenue,
             SUM(COALESCE("clicks",0))::bigint AS clicks,
             SUM(COALESCE("impressions",0))::bigint AS impressions
      FROM "AdReport" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)} GROUP BY 1, "country"
    ), rev_total_day AS (
      SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_country_day GROUP BY day
    ), cost_day AS (
      SELECT date_trunc('day', "dataDate")::date AS day, SUM(COALESCE("cost",0))::numeric AS cost
      FROM "ad_costs" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)} GROUP BY 1
    ), dist AS (
      SELECT c."country", c.day, c.revenue, c.clicks, c.impressions, t.revenue_total, d.cost,
             CASE WHEN t.revenue_total>0 THEN (c.revenue / t.revenue_total) * COALESCE(d.cost,0) ELSE 0 END AS cost_alloc
      FROM rev_country_day c JOIN rev_total_day t ON t.day = c.day LEFT JOIN cost_day d ON d.day = c.day
    )
    SELECT "country",
           SUM(impressions)::bigint AS impressions,
           SUM(clicks)::bigint AS clicks,
           CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr,
           CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
           SUM(revenue)::numeric AS revenue,
           SUM(cost_alloc)::numeric AS cost,
           CASE WHEN SUM(clicks)>0 THEN SUM(cost_alloc)::numeric/NULLIF(SUM(clicks),0) ELSE NULL END AS cpc,
           CASE WHEN SUM(cost_alloc)>0 THEN SUM(revenue)::numeric/SUM(cost_alloc)*100 ELSE NULL END AS roi
    FROM dist
    GROUP BY "country"
    ORDER BY revenue DESC
    LIMIT 200
  `
  return rows
}

// Device 表（含分摊成本）
async function deviceTableKpi(site: string, from: string, to: string) {
  const rows = await prismaRead.$queryRaw<Array<any>>`
    WITH rev_dev_day AS (
      SELECT date_trunc('day', "dataDate")::date AS day, "device",
             SUM(COALESCE("revenue",0))::numeric AS revenue,
             SUM(COALESCE("clicks",0))::bigint AS clicks,
             SUM(COALESCE("impressions",0))::bigint AS impressions
      FROM "AdReport" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)} GROUP BY 1, "device"
    ), rev_total_day AS (
      SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_dev_day GROUP BY day
    ), cost_day AS (
      SELECT date_trunc('day', "dataDate")::date AS day, SUM(COALESCE("cost",0))::numeric AS cost
      FROM "ad_costs" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)} GROUP BY 1
    ), dist AS (
      SELECT d."device", d.day, d.revenue, d.clicks, d.impressions, t.revenue_total, c.cost,
             CASE WHEN t.revenue_total>0 THEN (d.revenue / t.revenue_total) * COALESCE(c.cost,0) ELSE 0 END AS cost_alloc
      FROM rev_dev_day d JOIN rev_total_day t ON t.day = d.day LEFT JOIN cost_day c ON c.day = d.day
    )
    SELECT "device",
           SUM(impressions)::bigint AS impressions,
           SUM(clicks)::bigint AS clicks,
           CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr,
           CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
           SUM(revenue)::numeric AS revenue,
           SUM(cost_alloc)::numeric AS cost,
           CASE WHEN SUM(clicks)>0 THEN SUM(cost_alloc)::numeric/NULLIF(SUM(clicks),0) ELSE NULL END AS cpc,
           CASE WHEN SUM(cost_alloc)>0 THEN SUM(revenue)::numeric/SUM(cost_alloc)*100 ELSE NULL END AS roi
    FROM dist
    GROUP BY "device"
    ORDER BY revenue DESC
    LIMIT 100
  `
  return rows
}

// Browser 表（含分摊成本）
async function browserTableKpi(site: string, from: string, to: string) {
  const rows = await prismaRead.$queryRaw<Array<any>>`
    WITH rev_bro_day AS (
      SELECT date_trunc('day', "dataDate")::date AS day, "browser",
             SUM(COALESCE("revenue",0))::numeric AS revenue,
             SUM(COALESCE("clicks",0))::bigint AS clicks,
             SUM(COALESCE("impressions",0))::bigint AS impressions
      FROM "AdReport" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)} GROUP BY 1, "browser"
    ), rev_total_day AS (
      SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_bro_day GROUP BY day
    ), cost_day AS (
      SELECT date_trunc('day', "dataDate")::date AS day, SUM(COALESCE("cost",0))::numeric AS cost
      FROM "ad_costs" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)} GROUP BY 1
    ), dist AS (
      SELECT b."browser", b.day, b.revenue, b.clicks, b.impressions, t.revenue_total, c.cost,
             CASE WHEN t.revenue_total>0 THEN (b.revenue / t.revenue_total) * COALESCE(c.cost,0) ELSE 0 END AS cost_alloc
      FROM rev_bro_day b JOIN rev_total_day t ON t.day = b.day LEFT JOIN cost_day c ON c.day = b.day
    )
    SELECT "browser",
           SUM(impressions)::bigint AS impressions,
           SUM(clicks)::bigint AS clicks,
           CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr,
           CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
           SUM(revenue)::numeric AS revenue,
           SUM(cost_alloc)::numeric AS cost,
           CASE WHEN SUM(clicks)>0 THEN SUM(cost_alloc)::numeric/NULLIF(SUM(clicks),0) ELSE NULL END AS cpc,
           CASE WHEN SUM(cost_alloc)>0 THEN SUM(revenue)::numeric/SUM(cost_alloc)*100 ELSE NULL END AS roi
    FROM dist
    GROUP BY "browser"
    ORDER BY revenue DESC
    LIMIT 100
  `
  return rows
}

// AdUnit 表（含分摊成本）
async function adunitTableKpi(site: string, from: string, to: string) {
  const rows = await prismaRead.$queryRaw<Array<any>>`
    WITH rev_unit_day AS (
      SELECT date_trunc('day', "dataDate")::date AS day, "adUnit",
             SUM(COALESCE("revenue",0))::numeric AS revenue,
             SUM(COALESCE("clicks",0))::bigint AS clicks,
             SUM(COALESCE("impressions",0))::bigint AS impressions
      FROM "AdReport" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)} GROUP BY 1, "adUnit"
    ), rev_total_day AS (
      SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_unit_day GROUP BY day
    ), cost_day AS (
      SELECT date_trunc('day', "dataDate")::date AS day, SUM(COALESCE("cost",0))::numeric AS cost
      FROM "ad_costs" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)} GROUP BY 1
    ), dist AS (
      SELECT u."adUnit", u.day, u.revenue, u.clicks, u.impressions, t.revenue_total, c.cost,
             CASE WHEN t.revenue_total>0 THEN (u.revenue / t.revenue_total) * COALESCE(c.cost,0) ELSE 0 END AS cost_alloc
      FROM rev_unit_day u JOIN rev_total_day t ON t.day = u.day LEFT JOIN cost_day c ON c.day = u.day
    )
    SELECT "adUnit",
           SUM(impressions)::bigint AS impressions,
           SUM(clicks)::bigint AS clicks,
           CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr,
           CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
           SUM(revenue)::numeric AS revenue,
           SUM(cost_alloc)::numeric AS cost,
           CASE WHEN SUM(clicks)>0 THEN SUM(cost_alloc)::numeric/NULLIF(SUM(clicks),0) ELSE NULL END AS cpc,
           CASE WHEN SUM(cost_alloc)>0 THEN SUM(revenue)::numeric/SUM(cost_alloc)*100 ELSE NULL END AS roi
    FROM dist
    GROUP BY "adUnit"
    ORDER BY revenue DESC
    LIMIT 100
  `
  return rows
}

// Advertiser 表（含分摊成本）
async function advertiserTableKpi(site: string, from: string, to: string) {
  const rows = await prismaRead.$queryRaw<Array<any>>`
    WITH rev_adv_day AS (
      SELECT date_trunc('day', "dataDate")::date AS day, "advertiser",
             SUM(COALESCE("revenue",0))::numeric AS revenue,
             SUM(COALESCE("clicks",0))::bigint AS clicks,
             SUM(COALESCE("impressions",0))::bigint AS impressions
      FROM "AdReport" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)} GROUP BY 1, "advertiser"
    ), rev_total_day AS (
      SELECT day, SUM(revenue)::numeric AS revenue_total FROM rev_adv_day GROUP BY day
    ), cost_day AS (
      SELECT date_trunc('day', "dataDate")::date AS day, SUM(COALESCE("cost",0))::numeric AS cost
      FROM "ad_costs" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)} GROUP BY 1
    ), dist AS (
      SELECT a."advertiser", a.day, a.revenue, a.clicks, a.impressions, t.revenue_total, c.cost,
             CASE WHEN t.revenue_total>0 THEN (a.revenue / t.revenue_total) * COALESCE(c.cost,0) ELSE 0 END AS cost_alloc
      FROM rev_adv_day a JOIN rev_total_day t ON t.day = a.day LEFT JOIN cost_day c ON c.day = a.day
    )
    SELECT "advertiser",
           SUM(impressions)::bigint AS impressions,
           SUM(clicks)::bigint AS clicks,
           CASE WHEN SUM(impressions)>0 THEN SUM(clicks)::numeric/SUM(impressions)*100 ELSE 0 END AS ctr,
           CASE WHEN SUM(impressions)>0 THEN SUM(revenue)::numeric/SUM(impressions)*1000 ELSE 0 END AS ecpm,
           SUM(revenue)::numeric AS revenue,
           SUM(cost_alloc)::numeric AS cost,
           CASE WHEN SUM(clicks)>0 THEN SUM(cost_alloc)::numeric/NULLIF(SUM(clicks),0) ELSE NULL END AS cpc,
           CASE WHEN SUM(cost_alloc)>0 THEN SUM(revenue)::numeric/SUM(cost_alloc)*100 ELSE NULL END AS roi
    FROM dist
    GROUP BY "advertiser"
    ORDER BY revenue DESC
    LIMIT 100
  `
  return rows
}

// eCPM 时序（Only ADX）
async function ecpmSeries(site: string, from: string, to: string) {
  const rows = await prismaRead.$queryRaw<Array<{ day: Date; ecpm: number }>>`
    SELECT date_trunc('day', "dataDate")::date AS day,
           CASE WHEN SUM(COALESCE("impressions",0))>0 THEN SUM(COALESCE("revenue",0))::numeric/NULLIF(SUM(COALESCE("impressions",0)),0)*1000 ELSE 0 END AS ecpm
    FROM "AdReport" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
    GROUP BY 1 ORDER BY 1
  `
  return rows
}

// CPC 时序（Google/Bing）
async function cpcSeries(site: string, from: string, to: string) {
  const rows = await prismaRead.$queryRaw<Array<{ day: Date; source: string|null; cpc: number|null }>>`
    SELECT date_trunc('day', "dataDate")::date AS day, LOWER("source") AS source,
           CASE WHEN SUM(COALESCE("clicks",0))>0 THEN SUM(COALESCE("cost",0))::numeric/NULLIF(SUM(COALESCE("clicks",0)),0) ELSE NULL END AS cpc
    FROM "ad_costs" WHERE "website" = ${site} AND "dataDate" BETWEEN ${new Date(from)} AND ${new Date(to)}
    GROUP BY 1,2 ORDER BY 1
  `
  return rows
}
