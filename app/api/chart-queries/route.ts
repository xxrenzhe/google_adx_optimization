import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaRead } from '@/lib/prisma-extended'
import { validateSelectOnly } from '@/lib/sql-guard'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const key = searchParams.get('key')
  if (key) {
    const db = prismaRead as any
    const item = await db.chartQuery.findUnique({ where: { chartKey: key } })
    return NextResponse.json({ ok: true, item })
  }
  const db = prismaRead as any
  const items = await db.chartQuery.findMany({ orderBy: { chartKey: 'asc' } })
  return NextResponse.json({ ok: true, items })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { chartKey, sqlText, params, enabled } = body || {}
    if (!chartKey || !sqlText) return NextResponse.json({ error: 'chartKey/sqlText 必填' }, { status: 400 })
    const v = validateSelectOnly(sqlText)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    const db = prisma as any
    const item = await db.chartQuery.upsert({
      where: { chartKey },
      update: { sqlText, params, enabled: enabled ?? true },
      create: { chartKey, sqlText, params, enabled: enabled ?? true }
    })
    // 审计日志
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
    await db.chartQueryAudit.create({ data: { chartKey, sqlText, params, updatedBy: ip } })
    return NextResponse.json({ ok: true, item })
  } catch (e) {
    console.error('chart-queries POST error:', e)
    return NextResponse.json({ error: '保存失败' }, { status: 500 })
  }
}
