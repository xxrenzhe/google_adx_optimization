import { NextRequest, NextResponse } from 'next/server'
import { prisma, prismaRead } from '@/lib/prisma-extended'
import { validateSelectOnly } from '@/lib/sql-guard'

export async function GET(_: NextRequest, { params }: { params: { key: string } }) {
  const db = prismaRead as any
  const item = await db.chartQuery.findUnique({ where: { chartKey: params.key } })
  return NextResponse.json({ ok: true, item })
}

export async function PUT(req: NextRequest, { params }: { params: { key: string } }) {
  try {
    const body = await req.json()
    const { sqlText, params: p, enabled } = body || {}
    if (!sqlText) return NextResponse.json({ error: 'sqlText 必填' }, { status: 400 })
    const v = validateSelectOnly(sqlText)
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 })
    const db = prisma as any
    const item = await db.chartQuery.upsert({
      where: { chartKey: params.key },
      update: { sqlText, params: p, enabled: enabled ?? true },
      create: { chartKey: params.key, sqlText, params: p, enabled: enabled ?? true }
    })
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
    await db.chartQueryAudit.create({ data: { chartKey: params.key, sqlText, params: p, updatedBy: ip } })
    return NextResponse.json({ ok: true, item })
  } catch (e) {
    console.error('chart-queries PUT error:', e)
    return NextResponse.json({ error: '保存失败' }, { status: 500 })
  }
}
