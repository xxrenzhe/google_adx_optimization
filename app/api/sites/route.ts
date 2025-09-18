import { NextResponse } from 'next/server'
import { prismaRead } from '@/lib/prisma-extended'
import { logInfo, logError } from '@/lib/logger'

export async function GET() {
  try {
    const db = prismaRead as any
    const sites = await db.site.findMany({ orderBy: { lastSeen: 'desc' } })
    logInfo('API/SITES', 'list ok', { count: sites.length })
    return NextResponse.json({ ok: true, items: sites })
  } catch (e) {
    // 若表不存在，则返回空列表，避免阻塞首页
    const code = (e as any)?.code
    if (code === 'P2021') { logInfo('API/SITES', 'table missing, return empty'); return NextResponse.json({ ok: true, items: [] }) }
    logError('API/SITES', 'list error', e as any)
    return NextResponse.json({ error: '无法获取站点列表' }, { status: 500 })
  }
}
