import { NextRequest, NextResponse } from 'next/server'
import { prismaRead } from '@/lib/prisma-extended'
import { bindNamedParams, validateSelectOnly } from '@/lib/sql-guard'
import { getCachedData, setCachedData } from '@/lib/redis-cache'

// 简化版：按 chart key 分派到 Prisma 查询（未来可切换到 ChartQueries 动态SQL）
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const key = searchParams.get('key') || ''
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
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
    const cq = await db.chartQuery.findUnique({ where: { chartKey: key } })
    if (cq && cq.enabled) {
      const val = validateSelectOnly(cq.sqlText)
      if (!val.ok) return NextResponse.json({ error: val.error }, { status: 400 })
      const sqlBound = bindNamedParams(cq.sqlText, { from, to, site: site || undefined })
      const rows: any[] = await prismaRead.$queryRawUnsafe(sqlBound)
      const payload = { ok: true, data: toJSONNumbers(rows) }
      await setCachedData(cacheKey, payload, 120)
      return NextResponse.json(payload)
    }

    // 回退到内置查询
    switch (key) {
      case 'home.benefit_summary':
        const payload1 = {
          ok: true,
          onlyAdx: true,
          data: await benefitSummary(from, to)
        }
        await setCachedData(cacheKey, payload1, 120)
        return NextResponse.json(payload1)
      case 'home.top_domains':
        {
          const payload2 = { ok: true, data: toJSONNumbers(await topDomains(from, to)) }
          await setCachedData(cacheKey, payload2, 120)
          return NextResponse.json(payload2)
        }
      case 'report.timeseries':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        {
          const payload3 = { ok: true, data: toJSONNumbers(await siteTimeseries(site, from, to)) }
          await setCachedData(cacheKey, payload3, 120)
          return NextResponse.json(payload3)
        }
      case 'report.device_browser':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        {
          const payload4 = { ok: true, data: toJSONNumbers(await deviceBrowser(site, from, to)) }
          await setCachedData(cacheKey, payload4, 120)
          return NextResponse.json(payload4)
        }
      case 'report.country_table':
        if (!site) return NextResponse.json({ error: '缺少站点' }, { status: 400 })
        {
          const payload5 = { ok: true, data: toJSONNumbers(await countryTable(site, from, to)) }
          await setCachedData(cacheKey, payload5, 120)
          return NextResponse.json(payload5)
        }
      default:
        return NextResponse.json({ error: '未知的图表 key' }, { status: 400 })
    }
  } catch (e) {
    console.error('charts error:', e)
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
