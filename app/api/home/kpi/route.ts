import { NextResponse } from 'next/server'
import { prismaRead } from '@/lib/prisma-extended'

function toDate(s: string) { return new Date(s) }
function iso(d: Date) { return d.toISOString().slice(0,10) }

export async function GET() {
  try {
    const today = new Date()
    const y = new Date(); y.setDate(y.getDate()-1)
    const d7 = new Date(); d7.setDate(d7.getDate()-6)
    const d7Start = iso(d7), d7End = iso(today)
    const todayStr = iso(today), yStr = iso(y)

    const [
      [adxToday], [adx7], [adxY],
      offerToday, offer7, offerY,
      yahooToday, yahoo7, yahooY
    ] = await Promise.all([
      prismaRead.$queryRawUnsafe(`SELECT COALESCE(SUM("revenue"),0)::numeric AS v FROM "AdReport" WHERE "dataDate"::date = $1`, toDate(todayStr)),
      prismaRead.$queryRawUnsafe(`SELECT COALESCE(SUM("revenue"),0)::numeric AS v FROM "AdReport" WHERE "dataDate" BETWEEN $1 AND $2`, toDate(d7Start), toDate(d7End)),
      prismaRead.$queryRawUnsafe(`SELECT COALESCE(SUM("revenue"),0)::numeric AS v FROM "AdReport" WHERE "dataDate"::date = $1`, toDate(yStr)),
      safeSum(`SELECT COALESCE(SUM("revenue"),0)::numeric AS v FROM "offer_revenue" WHERE "dataDate"::date = $1`, [toDate(todayStr)]),
      safeSum(`SELECT COALESCE(SUM("revenue"),0)::numeric AS v FROM "offer_revenue" WHERE "dataDate" BETWEEN $1 AND $2`, [toDate(d7Start), toDate(d7End)]),
      safeSum(`SELECT COALESCE(SUM("revenue"),0)::numeric AS v FROM "offer_revenue" WHERE "dataDate"::date = $1`, [toDate(yStr)]),
      safeSum(`SELECT COALESCE(SUM("revenue"),0)::numeric AS v FROM "yahoo_revenue" WHERE "dataDate"::date = $1`, [toDate(todayStr)]),
      safeSum(`SELECT COALESCE(SUM("revenue"),0)::numeric AS v FROM "yahoo_revenue" WHERE "dataDate" BETWEEN $1 AND $2`, [toDate(d7Start), toDate(d7End)]),
      safeSum(`SELECT COALESCE(SUM("revenue"),0)::numeric AS v FROM "yahoo_revenue" WHERE "dataDate"::date = $1`, [toDate(yStr)]),
    ]) as any

    const todaySum = Number(adxToday?.v||0) + Number(offerToday?.v||0) + Number(yahooToday?.v||0)
    const last7 = Number(adx7?.v||0) + Number(offer7?.v||0) + Number(yahoo7?.v||0)
    const yesterday = Number(adxY?.v||0) + Number(offerY?.v||0) + Number(yahooY?.v||0)
    return NextResponse.json({ ok: true, data: { today: todaySum, last7, yesterday } })
  } catch (e) {
    console.error('home kpi error:', e)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}

async function safeSum(sql: string, params: any[]) {
  try {
    const rows: any[] = await (prismaRead as any).$queryRawUnsafe(sql, ...params)
    return rows?.[0] || { v: 0 }
  } catch (e: any) {
    // relation does not exist → treat as zero (optional tables not provisioned yet)
    if (e?.meta?.code === '42P01') return { v: 0 }
    throw e
  }
}
