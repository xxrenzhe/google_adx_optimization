import { NextRequest, NextResponse } from 'next/server'
import { prismaRead } from '@/lib/prisma-extended'
import { logInfo, logError, timeStart } from '@/lib/logger'

function toDate(s: string) { return new Date(s) }

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    if (!from || !to) return NextResponse.json({ error: '缺少参数 from/to' }, { status: 400 })

    const end = timeStart('API/HOME', 'summary', { from, to })
    const [adxRows, offerRows, yahooRows, costRows] = await Promise.all([
      prismaRead.$queryRawUnsafe(`SELECT COALESCE(SUM("revenue"),0)::numeric AS v FROM "AdReport" WHERE "dataDate" BETWEEN $1 AND $2`, toDate(from), toDate(to)),
      safeSum(`SELECT COALESCE(SUM("revenue"),0)::numeric AS v FROM "offer_revenue" WHERE "dataDate" BETWEEN $1 AND $2`, [toDate(from), toDate(to)]),
      safeSum(`SELECT COALESCE(SUM("revenue"),0)::numeric AS v FROM "yahoo_revenue" WHERE "dataDate" BETWEEN $1 AND $2`, [toDate(from), toDate(to)]),
      safeSum(`SELECT COALESCE(SUM("cost"),0)::numeric AS c, COALESCE(SUM("clicks"),0)::bigint AS k FROM "ad_costs" WHERE "dataDate" BETWEEN $1 AND $2`, [toDate(from), toDate(to)])
    ]) as any

    const adx = Number(adxRows?.[0]?.v || 0)
    const offer = Number(offerRows?.[0]?.v || 0)
    const yahoo = Number(yahooRows?.[0]?.v || 0)
    const cost = Number(costRows?.[0]?.c || 0)
    const clicks = Number(costRows?.[0]?.k || 0)
    const revenue = adx + offer + yahoo
    const profit = revenue - cost
    const roi = cost > 0 ? (revenue / cost) * 100 : null
    const cpc = clicks > 0 ? (cost / clicks) : null

    const payload = { ok: true, data: { revenue, cost, profit, roi, cpc } }
    end(); logInfo('API/HOME', 'summary ok', { revenue, cost })
    return NextResponse.json(payload)
  } catch (e) {
    logError('API/HOME', 'summary error', e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

async function safeSum(sql: string, params: any[]) {
  try {
    const rows: any[] = await (prismaRead as any).$queryRawUnsafe(sql, ...params)
    return rows
  } catch (e: any) {
    // relation does not exist → treat as zero (optional tables not provisioned yet)
    if (e?.meta?.code === '42P01') return [{ v: 0, c: 0, k: 0 }]
    throw e
  }
}
