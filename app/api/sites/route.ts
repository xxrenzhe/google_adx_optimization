import { NextResponse } from 'next/server'
import { prismaRead } from '@/lib/prisma-extended'

export async function GET() {
  try {
    const db = prismaRead as any
    const sites = await db.site.findMany({ orderBy: { lastSeen: 'desc' } })
    return NextResponse.json({ ok: true, items: sites })
  } catch (e) {
    console.error('sites error:', e)
    return NextResponse.json({ error: '无法获取站点列表' }, { status: 500 })
  }
}
