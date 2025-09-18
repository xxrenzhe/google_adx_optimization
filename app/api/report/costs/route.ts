import { NextRequest, NextResponse } from 'next/server'
import { prismaRead } from '@/lib/prisma-extended'
import { logInfo, logError, timeStart } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const site = searchParams.get('site') || searchParams.get('sites') || ''
    const from = searchParams.get('from') || ''
    const to = searchParams.get('to') || ''
    if (!site || !from || !to) return NextResponse.json({ error: '缺少参数site/from/to' }, { status: 400 })

    const end = timeStart('API/REPORT', 'costs', { site, from, to })
    const rows: Array<{ source: string|null; cost: number }>= await prismaRead.$queryRawUnsafe(
      `SELECT LOWER("source") AS source, SUM(COALESCE("cost",0))::numeric AS cost
       FROM "ad_costs" WHERE "website" = $1 AND "dataDate" BETWEEN $2 AND $3
       GROUP BY 1`, site, new Date(from), new Date(to))
    const by: Record<string, number> = {}
    rows.forEach(r => { by[(r.source||'other')] = Number(r.cost||0) })
    const total = Object.values(by).reduce((s,x)=>s+Number(x||0),0)
    end(); logInfo('API/REPORT', 'costs ok', { site, total })
    return NextResponse.json({ ok: true, data: { total, google: by['google']||0, bing: by['bing']||0, other: by['other']||0 } })
  } catch (e) {
    logError('API/REPORT', 'costs error', e)
    return NextResponse.json({ error: '查询失败' }, { status: 500 })
  }
}

