import { NextRequest, NextResponse } from 'next/server'
import { prismaRead } from '@/lib/prisma-extended'
import { logInfo, logError } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const site = searchParams.get('site') || undefined

    const rows = await (site
      ? prismaRead.$queryRawUnsafe(`SELECT MIN("dataDate")::date AS min, MAX("dataDate")::date AS max FROM "AdReport" WHERE "website" = $1`, site)
      : prismaRead.$queryRawUnsafe(`SELECT MIN("dataDate")::date AS min, MAX("dataDate")::date AS max FROM "AdReport"`)
    ) as any[]

    const r = rows?.[0] || {}
    const min: Date | null = r.min || null
    const max: Date | null = r.max || null
    const fmt = (d: Date) => new Date(d).toISOString().slice(0,10)
    const today = new Date(); const t = fmt(today)
    const data = {
      from: min ? fmt(min) : t,
      to: max ? fmt(max) : t
    }
    logInfo('API/DATE-RANGE', 'ok', { site: site || 'all', from: data.from, to: data.to })
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    // 如果表不存在（P2021）或其它错误，返回 today-today，保证前端不崩
    const today = new Date().toISOString().slice(0,10)
    logError('API/DATE-RANGE', 'error', e)
    return NextResponse.json({ ok: true, data: { from: today, to: today } })
  }
}

