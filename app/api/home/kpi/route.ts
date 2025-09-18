import { NextResponse } from 'next/server'
import { prismaRead } from '@/lib/prisma-extended'
import { validateSelectOnly, bindNamedParams } from '@/lib/sql-guard'
import { logInfo, logError, timeStart } from '@/lib/logger'

function toDate(s: string) { return new Date(s) }
function iso(d: Date) { return d.toISOString().slice(0,10) }

export async function GET() {
  try {
    const end = timeStart('API/HOME', 'kpi')
    const today = new Date()
    const y = new Date(); y.setDate(y.getDate()-1)
    const d7 = new Date(); d7.setDate(d7.getDate()-6)
    const d7Start = iso(d7), d7End = iso(today)
    const todayStr = iso(today), yStr = iso(y)

    // 允许使用 ChartQueries 覆盖 KPI 计算
    const [todaySum, last7, yesterday] = await Promise.all([
      kpiByQuery('home.kpi.today').catch(()=>undefined),
      kpiByQuery('home.kpi.last7').catch(()=>undefined),
      kpiByQuery('home.kpi.yesterday').catch(()=>undefined),
    ]).then(vals => vals.map(v => (typeof v === 'number' && isFinite(v)) ? v : undefined)) as Array<number|undefined>

    // 回退到内置聚合（包含 ADX/Offer/Yahoo）
    const fallback = async () => {
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
      return {
        today: Number(adxToday?.v||0) + Number(offerToday?.v||0) + Number(yahooToday?.v||0),
        last7: Number(adx7?.v||0) + Number(offer7?.v||0) + Number(yahoo7?.v||0),
        yesterday: Number(adxY?.v||0) + Number(offerY?.v||0) + Number(yahooY?.v||0)
      }
    }

    const fb = (todaySum===undefined || last7===undefined || yesterday===undefined)
      ? await fallback()
      : { today: todaySum!, last7: last7!, yesterday: yesterday! }
    const payload = { ok: true, data: { today: todaySum, last7, yesterday } }
    end(); logInfo('API/HOME', 'kpi ok', { today: fb.today, last7: fb.last7, yesterday: fb.yesterday })
    return NextResponse.json({ ok: true, data: fb })
  } catch (e) {
    logError('API/HOME', 'kpi error', e)
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

// 优先读取可编辑查询（ChartQueries），返回单值 v
async function kpiByQuery(key: string): Promise<number> {
  try {
    // 直接查表（避免引入 /api/charts 依赖）
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: any = prismaRead as any
    const cq = await db.chartQuery.findUnique({ where: { chartKey: key } })
    if (!cq || !cq.enabled) throw new Error('no cq')
    const v = validateSelectOnly(cq.sqlText)
    if (!v.ok) throw new Error('invalid sql')
    const sql = bindNamedParams(cq.sqlText, {})
    const rows: any[] = await prismaRead.$queryRawUnsafe(sql)
    const row = rows?.[0]
    if (!row) return 0
    // 优先 v 列，否则取第一列的数值
    if (typeof row.v !== 'undefined') return Number(row.v || 0)
    const first = Object.values(row)[0]
    return Number(first || 0)
  } catch (e: any) {
    // 缺表等直接回退
    return Promise.reject(e)
  }
}
