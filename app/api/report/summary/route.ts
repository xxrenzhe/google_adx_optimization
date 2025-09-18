import { NextRequest, NextResponse } from 'next/server'
import { prismaRead } from '@/lib/prisma-extended'
import { logInfo, logError, timeStart } from '@/lib/logger'
import { getCachedData, setCachedData } from '@/lib/redis-cache'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const site = searchParams.get('site') || searchParams.get('sites') || ''
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    if (!site || !from || !to) return NextResponse.json({ error: '缺少参数site/from/to' }, { status: 400 })

    const end = timeStart('API/REPORT', 'summary', { site, from, to })
    const cacheKey = `report:summary:${site}:${from}:${to}`
    const cached = await getCachedData<any>(cacheKey)
    if (cached) return NextResponse.json(cached)

    const [adxRows, offerRows, yahooRows, costRows] = await Promise.all([
      prismaRead.$queryRawUnsafe(`SELECT SUM(COALESCE("revenue",0))::numeric AS v FROM "AdReport" WHERE "website" = $1 AND "dataDate" BETWEEN $2 AND $3`, site, new Date(from), new Date(to)),
      prismaRead.$queryRawUnsafe(`SELECT SUM(COALESCE("revenue",0))::numeric AS v FROM "offer_revenue" WHERE "website" = $1 AND "dataDate" BETWEEN $2 AND $3`, site, new Date(from), new Date(to)),
      prismaRead.$queryRawUnsafe(`SELECT SUM(COALESCE("revenue",0))::numeric AS v FROM "yahoo_revenue" WHERE "website" = $1 AND "dataDate" BETWEEN $2 AND $3`, site, new Date(from), new Date(to)),
      prismaRead.$queryRawUnsafe(`SELECT SUM(COALESCE("cost",0))::numeric AS c, SUM(COALESCE("clicks",0))::bigint AS k FROM "ad_costs" WHERE "website" = $1 AND "dataDate" BETWEEN $2 AND $3`, site, new Date(from), new Date(to)),
    ])

    const adx = Number(adxRows?.[0]?.v || 0)
    const offer = Number(offerRows?.[0]?.v || 0)
    const yahoo = Number(yahooRows?.[0]?.v || 0)
    const cost = Number(costRows?.[0]?.c || 0)
    const clicks = Number(costRows?.[0]?.k || 0)
    const revenue = adx + offer + yahoo
    const profit = revenue - cost
    const roi = cost > 0 ? (revenue / cost) * 100 : null
    const cpc = clicks > 0 ? (cost / clicks) : null

    const payload = { ok: true, data: { adx, offer, yahoo, revenue, cost, profit, roi, cpc } }
    await setCachedData(cacheKey, payload, 120)
    end(); logInfo('API/REPORT', 'summary ok', { site, revenue, cost })
    return NextResponse.json(payload)
  } catch (e) {
    logError('API/REPORT', 'summary error', e)
    return NextResponse.json({ error: '汇总失败' }, { status: 500 })
  }
}
