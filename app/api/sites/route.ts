import { NextResponse } from 'next/server'
import { prismaRead } from '@/lib/prisma-extended'

export async function GET() {
  try {
    const db = prismaRead as any
    const sites = await db.site.findMany({ orderBy: { lastSeen: 'desc' } })
    return NextResponse.json({ ok: true, items: sites })
  } catch (e) {
    // 若表不存在，则返回空列表，避免阻塞首页
    const code = (e as any)?.code
    if (code === 'P2021') return NextResponse.json({ ok: true, items: [] })
    console.error('sites error:', e)
    return NextResponse.json({ error: '无法获取站点列表' }, { status: 500 })
  }
}
