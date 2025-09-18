import { NextRequest, NextResponse } from 'next/server'
import { prismaRead } from '@/lib/prisma-extended'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10) || 10, 50)
    const items = await (prismaRead as any).uploadSession.findMany({
      orderBy: { uploadedAt: 'desc' },
      take: limit,
      select: {
        id: true,
        filename: true,
        fileSize: true,
        status: true,
        recordCount: true,
        uploadedAt: true,
        processedAt: true,
        dataType: true,
        source: true,
        errorMessage: true
      }
    })
    return NextResponse.json({ ok: true, items })
  } catch (e) {
    console.error('uploads GET error:', e)
    return NextResponse.json({ error: '无法获取上传历史' }, { status: 500 })
  }
}

